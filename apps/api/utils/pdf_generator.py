"""
Dynamic PDF generator for document requests (template-free).

Uses reportlab to render an official-looking document with:
- Government header and municipality name
- Title from document type config
- Body text with simple {{placeholders}} replacement
- Border, watermark (seal/logo if available), and optional QR code

Production Ready:
- PDFs can be generated in memory and uploaded to Supabase Storage
- QR codes embedded directly from memory (no filesystem dependency)
- Falls back to filesystem in development

Entry point: generate_document_pdf(request, document_type, user) -> (abs_path_or_none, url_or_path)
"""
from __future__ import annotations

from apps.api.utils.time import utc_now
import os
import logging
import tempfile
from pathlib import Path
from typing import Dict, Tuple, Optional, Union
from datetime import datetime, timezone
from io import BytesIO

from flask import current_app

from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader
from reportlab.lib import colors
from reportlab.lib.units import mm

logger = logging.getLogger(__name__)


def _slugify(name: str) -> str:
    return (
        (name or "")
        .strip()
        .lower()
        .replace(" ", "_")
        .replace("-", "_")
        .replace(".", "")
    )


def _ensure_dir(p: Path) -> None:
    p.mkdir(parents=True, exist_ok=True)


def _resolve_writable_upload_base() -> Path:
    """Resolve a writable upload base directory for local fallback writes."""
    configured = current_app.config.get('UPLOAD_FOLDER') or 'uploads'
    upload_base = Path(configured)
    try:
        upload_base.mkdir(parents=True, exist_ok=True)
        return upload_base
    except Exception as exc:
        fallback = Path(tempfile.gettempdir()) / 'munlink_uploads' / 'region3'
        fallback.mkdir(parents=True, exist_ok=True)
        current_app.config['UPLOAD_FOLDER'] = fallback
        logger.warning(
            "UPLOAD_FOLDER '%s' is not writable (%s); using fallback '%s'",
            upload_base,
            exc,
            fallback,
        )
        return fallback


def _load_document_types() -> Dict[str, Dict]:
    # Load JSON config with type definitions
    try:
        # apps/api is current_app.root_path
        cfg_path = Path(current_app.root_path) / "config" / "documentTypes.json"
        if not cfg_path.exists():
            return {}
        import json

        return json.loads(cfg_path.read_text(encoding="utf-8"))
    except Exception:
        return {}


def _load_municipality_officials() -> Dict[str, Dict]:
    # Load JSON config with mayor/vice mayor info
    try:
        cfg_path = Path(current_app.root_path) / "config" / "municipalityOfficials.json"
        if not cfg_path.exists():
            return {}
        import json

        return json.loads(cfg_path.read_text(encoding="utf-8"))
    except Exception:
        return {}


def _load_barangay_officials() -> Dict[str, Dict[str, str]]:
    """Load Punong Barangay names per municipality and barangay.

    File format: { "Municipality": { "Barangay Name": "Punong Barangay Name" } }
    """
    try:
        cfg_path = Path(current_app.root_path) / "config" / "barangayOfficials.json"
        if not cfg_path.exists():
            return {}
        import json

        return json.loads(cfg_path.read_text(encoding="utf-8"))
    except Exception:
        return {}

def _resolve_logo_paths(municipality_name: str, province_slug: str | None = None) -> Tuple[Path | None, Path | None]:
    """Return (municipal_logo, province_logo) if available.

    Logo structure (preferred):
      public/logos/municipalities/{province_slug}/{municipality_slug}/*seal*.png
    
    Province logo is resolved from Region 3 province seals under:
      public/logos/provinces/{province_slug}.png
    """
    # Support both layouts:
    # 1) Monorepo: root_path=<repo>/apps/api, logos under <repo>/public/logos
    # 2) API-only container: root_path=/app, optional logos under /app/public/logos
    app_root = Path(current_app.root_path)
    base_candidates: list[Path] = [app_root]
    try:
        if len(app_root.parents) >= 2:
            base_candidates.append(app_root.parents[1])
        elif app_root.parent != app_root:
            base_candidates.append(app_root.parent)
    except Exception:
        pass

    mun_dir: Path | None = None
    prov_dir: Path | None = None
    for base in base_candidates:
        cand_mun = base / "public" / "logos" / "municipalities"
        cand_prov = base / "public" / "logos" / "provinces"
        if cand_mun.exists() or cand_prov.exists():
            mun_dir = cand_mun
            prov_dir = cand_prov
            break

    if mun_dir is None or prov_dir is None:
        fallback_base = base_candidates[0]
        mun_dir = fallback_base / "public" / "logos" / "municipalities"
        prov_dir = fallback_base / "public" / "logos" / "provinces"

    slug = _slugify(municipality_name)
    mun_logo: Path | None = None
    
    # Helper to find seal in a directory
    def find_seal_in_dir(folder: Path) -> Path | None:
        if not folder.exists() or not folder.is_dir():
            return None
        # Priority: files with 'seal' or 'logo' in name
        seal_patterns = ['*seal*.png', '*Seal*.png', '*logo*.png', '*Logo*.png']
        for pattern in seal_patterns:
            matches = sorted(folder.glob(pattern))
            if matches:
                return matches[0]
        # Fallback: any png/jpg
        for ext in ['*.png', '*.jpg']:
            matches = sorted(folder.glob(ext))
            if matches:
                return matches[0]
        return None
    
    # PRIORITY 1: New province-based structure: municipalities/{province_slug}/{municipality_slug}/
    if province_slug and mun_dir.exists():
        province_mun_dir = mun_dir / province_slug
        if province_mun_dir.exists():
            for folder_variant in [slug, municipality_name.lower().replace(' ', '-'), municipality_name.lower().replace(' ', '_')]:
                nested = province_mun_dir / folder_variant
                mun_logo = find_seal_in_dir(nested)
                if mun_logo:
                    break
    
    # PRIORITY 2: Old flat structure: municipalities/{MunicipalityName}/
    if not mun_logo and mun_dir.exists():
        for folder_variant in [municipality_name, slug, municipality_name.replace(' ', ''), municipality_name.replace(' ', '-')]:
            nested = mun_dir / folder_variant
            mun_logo = find_seal_in_dir(nested)
            if mun_logo:
                break
    
    # PRIORITY 3: Flat files directly in municipalities/
    if not mun_logo:
        candidates = [
            mun_dir / f"{municipality_name}.png",
            mun_dir / f"{municipality_name}.jpg",
            mun_dir / f"{slug}.png",
            mun_dir / f"{slug}.jpg",
        ]
        mun_logo = next((p for p in candidates if p.exists()), None)
    
    # PRIORITY 4: Final fallback - search for matching filename
    if not mun_logo and mun_dir.exists():
        try:
            for p in sorted(mun_dir.glob("*.png")):
                if slug in p.name.lower().replace('-', '_'):
                    mun_logo = p
                    break
        except Exception:
            pass

    # Province logo (Region 3)
    prov_logo: Path | None = None
    try:
        if province_slug:
            for ext in (".png", ".jpg", ".jpeg"):
                cand = prov_dir / f"{province_slug}{ext}"
                if cand.exists():
                    prov_logo = cand
                    break
    except Exception:
        prov_logo = None

    # Final fallback: Zambales seal (kept as safe default if province not known)
    if not prov_logo:
        for ext in (".png", ".jpg", ".jpeg"):
            cand = prov_dir / f"zambales{ext}"
            if cand.exists():
                prov_logo = cand
                break

    return mun_logo, prov_logo


def _simple_template(text: str, ctx: Dict[str, str]) -> str:
    # Very small, safe placeholder replacement for {{key}}
    if not text:
        return ""
    out = text
    for k, v in ctx.items():
        out = out.replace(f"{{{{{k}}}}}", str(v) if v is not None else "")
    return out


def _safe_text(value: object) -> str:
    """Return PDF-safe text for built-in ReportLab fonts."""
    text = str(value or "")
    try:
        text.encode("latin-1")
        return text
    except Exception:
        return text.encode("latin-1", "replace").decode("latin-1")


def _draw_border(c: canvas.Canvas, margin_mm: float = 12.0):
    width, height = A4
    m = margin_mm * mm
    c.setStrokeColor(colors.HexColor("#003399"))
    c.setLineWidth(2)
    c.rect(m, m, width - 2 * m, height - 2 * m, stroke=1, fill=0)


def _draw_header(
    c: canvas.Canvas,
    municipality_name: str,
    province_name: str,
    mun_logo: Path | None,
    prov_logo: Path | None,
    *,
    level: str = 'municipal',
    barangay_name: str = '',
):
    width, height = A4
    top_y = height - 30 * mm

    # Left side: Province logo and Municipal logo side by side
    logo_size = 18 * mm
    logo_spacing = 22 * mm  # Horizontal spacing between logos
    left_margin = 20 * mm
    
    # Draw province logo (Zambales) first on the left
    if prov_logo and prov_logo.exists():
        try:
            img = ImageReader(str(prov_logo))
            c.drawImage(img, left_margin, top_y - 18 * mm, width=logo_size, height=logo_size, preserveAspectRatio=True, mask='auto')
        except Exception:
            pass
    
    # Draw municipal logo next to province logo
    if mun_logo and mun_logo.exists():
        try:
            img = ImageReader(str(mun_logo))
            c.drawImage(img, left_margin + logo_spacing, top_y - 18 * mm, width=logo_size, height=logo_size, preserveAspectRatio=True, mask='auto')
        except Exception:
            pass

    # Right/top: header text
    _set_font(c, "Times-Bold", 12)
    c.drawRightString(width - 20 * mm, top_y, _safe_text("Republic of the Philippines"))
    _set_font(c, "Times-Roman", 11)
    c.drawRightString(width - 20 * mm, top_y - 6 * mm, _safe_text(f"Province of {province_name}"))
    _set_font(c, "Times-Bold", 12)
    c.drawRightString(width - 20 * mm, top_y - 12 * mm, _safe_text(f"Municipality of {municipality_name}"))
    if level == 'barangay':
        # Barangay-specific header line
        _set_font(c, "Times-Bold", 11)
        c.drawRightString(width - 20 * mm, top_y - 18 * mm, _safe_text(f"Barangay {barangay_name or 'Hall'}"))
        _set_font(c, "Times-Roman", 11)
        c.drawRightString(width - 20 * mm, top_y - 24 * mm, _safe_text("Office of the Punong Barangay"))
    else:
        _set_font(c, "Times-Roman", 11)
        c.drawRightString(width - 20 * mm, top_y - 18 * mm, _safe_text("Office of the Municipal Mayor"))


def _draw_educational_watermark(c: canvas.Canvas, opacity: float = 0.4):
    """Draw 'FOR EDUCATIONAL PURPOSES ONLY' diagonal watermark across the page.

    This watermark is drawn at 40% opacity, slanted at 45 degrees, centered on the page.
    It appears behind all content to indicate the document is for educational use only.
    """
    width, height = A4
    c.saveState()

    # Position at center of page
    c.translate(width / 2, height / 2)
    c.rotate(45)

    # Set semi-transparent gray/red color
    c.setFillColor(colors.Color(0.7, 0.1, 0.1, alpha=opacity))

    # Draw main text
    try:
        c.setFont("Helvetica-Bold", 36)
    except Exception:
        c.setFont("Helvetica", 36)

    c.drawCentredString(0, 0, "FOR EDUCATIONAL PURPOSES ONLY")

    # Draw smaller subtitle below
    try:
        c.setFont("Helvetica", 14)
    except Exception:
        pass
    c.drawCentredString(0, -25, "This document is not valid for official use")

    c.restoreState()


def _draw_watermark(c: canvas.Canvas, mun_logo: Path | None, opacity: float = 0.25, size_mm: float = 150.0):
    """Draw a semi-transparent watermark centered on the page.

    Uses Pillow to pre-apply opacity so it works even if setFillAlpha is unavailable
    or not honored for images on some ReportLab backends.
    """
    if not mun_logo or not mun_logo.exists():
        return
    width, height = A4
    try:
        logger = getattr(current_app, 'logger', None)
        # Prefer Pillow processing for reliable opacity and background removal
        try:
            from PIL import Image

            with Image.open(str(mun_logo)).convert('RGBA') as im:
                # Remove near-white backgrounds to reveal seal edges on white paper
                r, g, b, a = im.split()
                # Compute a mask of near-white pixels
                # Threshold: values > 245 (almost white)
                white_threshold = 245
                bg_mask = Image.eval(r, lambda x: 255 if x >= white_threshold else 0)
                bg_mask = Image.eval(Image.merge('RGB', (r, g, b)).convert('L'), lambda x: 255 if x >= white_threshold else 0)
                # Invert mask to keep non-white content
                keep_mask = Image.eval(bg_mask, lambda x: 0 if x > 0 else 255)
                # Combine with existing alpha if present
                if im.mode != 'RGBA':
                    a = Image.new('L', im.size, color=255)
                # Remove background
                a = Image.eval(a, lambda px: px)  # copy
                a.paste(0, mask=bg_mask)
                # Apply global fade
                fade = int(max(0, min(255, round(opacity * 255))))
                a = Image.eval(a, lambda px: int(px * (fade / 255.0)))
                im.putalpha(a)
                img = ImageReader(im)
                if logger:
                    logger.debug(f"Watermark prepared via Pillow: {mun_logo}")
        except Exception as pil_err:
            if logger:
                logger.debug(f"Watermark Pillow processing failed: {pil_err}")
            # Fallback: draw original image with canvas alpha (if available)
            img = ImageReader(str(mun_logo))

        c.saveState()
        c.translate(width / 2, height / 2)
        c.rotate(0)
        if hasattr(c, 'setFillAlpha'):
            c.setFillAlpha(opacity)
        size = size_mm * mm
        c.drawImage(img, -size / 2, -size / 2, width=size, height=size, preserveAspectRatio=True, mask='auto')
        c.restoreState()
    except Exception:
        # Silently ignore watermark failures to avoid blocking PDF generation
        pass
def _set_font(c: canvas.Canvas, name: str, size: int):
    """Set font with fallback to Helvetica family if Times is unavailable."""
    try:
        c.setFont(name, size)
    except Exception:
        # Fallback mappings
        fallback = {
            'Times-Roman': 'Helvetica',
            'Times-Bold': 'Helvetica-Bold',
            'Times-Italic': 'Helvetica-Oblique',
        }
        c.setFont(fallback.get(name, 'Helvetica'), size)



def generate_document_pdf(request, document_type, user, admin_user: Optional[object] = None) -> Tuple[Optional[Path], str, bytes]:
    """
    Generate a PDF for a document request and return (absolute_path_or_none, relative_path_or_storage_ref, pdf_bytes).
    """
    # Resolve basics
    municipality_obj = getattr(request, 'municipality', None)
    municipality_name = getattr(municipality_obj, 'name', '') or str(getattr(request, 'municipality_id', '') or '')
    province_obj = getattr(municipality_obj, 'province', None) if municipality_obj else None
    province_name = getattr(province_obj, 'name', '') or 'Central Luzon'
    province_slug = getattr(province_obj, 'slug', None)
    municipality_slug = _slugify(municipality_name)

    # Resolve logos (best-effort; never block PDF generation on asset lookup)
    try:
        mun_logo, prov_logo = _resolve_logo_paths(municipality_name, province_slug=province_slug)
    except Exception as logo_exc:
        logger.warning("Failed to resolve logo paths for PDF generation: %s", logo_exc)
        mun_logo, prov_logo = None, None
    # Debug logging to verify logo resolution
    try:
        if getattr(current_app, 'logger', None):
            current_app.logger.debug(f"PDF: municipality={municipality_name} mun_logo={mun_logo} prov_logo={prov_logo}")
    except Exception:
        pass

    # Prepare data context from request
    resident_full_name = ' '.join(
        filter(None, [getattr(user, 'first_name', None), getattr(user, 'last_name', None)])
    ) or getattr(user, 'username', 'Resident')

    issue_date = datetime.now(timezone.utc)

    # Load document type definitions
    doc_types = _load_document_types()
    code = (getattr(document_type, 'code', None) or getattr(document_type, 'name', 'generic')).lower()
    
    # Try multiple code variants to match config keys
    code_variants = [
        code,
        code.replace(' ', '_'),
        code.replace('_', ' '),
        code.replace('-', '_'),
    ]
    
    spec = None
    for variant in code_variants:
        if variant in doc_types:
            spec = doc_types[variant]
            break
    
    if not spec:
        spec = doc_types.get('generic') or {}
    
    level = (spec.get('level') or 'municipal').lower()
    
    # Debug logging
    try:
        if getattr(current_app, 'logger', None):
            current_app.logger.debug(f"PDF: doc_code={code} spec_found={spec is not None and spec != doc_types.get('generic')} title={spec.get('title')}")
    except Exception:
        pass

    # Derive effective content with precedence: admin_edited_content -> original columns -> resident_input
    import json as _json
    effective_purpose = None
    effective_remarks = None
    effective_civil = None
    effective_age = None
    try:
        edited = getattr(request, 'admin_edited_content', None) or {}
        if isinstance(edited, str):
            try:
                edited = _json.loads(edited)
            except Exception:
                edited = {}
        effective_purpose = (edited.get('purpose') if isinstance(edited, dict) else None) or getattr(request, 'purpose', None)
        effective_remarks = (edited.get('remarks') if isinstance(edited, dict) else None)
        effective_civil = (edited.get('civil_status') if isinstance(edited, dict) else None)
        try:
            ea = (edited.get('age') if isinstance(edited, dict) else None)
            if ea is not None:
                effective_age = int(ea)
        except Exception:
            pass
    except Exception:
        pass
    try:
        if effective_remarks is None:
            # Fallback to additional_notes string
            raw = getattr(request, 'additional_notes', None)
            if raw and isinstance(raw, str):
                # If legacy JSON was stored, try to parse and extract text
                if raw.strip().startswith('{'):
                    try:
                        parsed = _json.loads(raw)
                        if isinstance(parsed, dict):
                            effective_remarks = str(parsed.get('text') or '') or None
                            effective_civil = effective_civil or (str(parsed.get('civil_status')) if parsed.get('civil_status') else None)
                        else:
                            effective_remarks = raw
                    except Exception:
                        effective_remarks = raw
                else:
                    effective_remarks = raw
        # Fallback to resident_input
        ri = getattr(request, 'resident_input', None) or {}
        if isinstance(ri, str):
            try:
                ri = _json.loads(ri)
            except Exception:
                ri = {}
        if not effective_purpose:
            effective_purpose = (ri.get('purpose') if isinstance(ri, dict) else None) or getattr(request, 'purpose', '')
        if effective_remarks is None:
            effective_remarks = (ri.get('remarks') if isinstance(ri, dict) else None)
        if not effective_civil:
            effective_civil = (ri.get('civil_status') if isinstance(ri, dict) else None)
        if effective_age is None:
            try:
                ra = (ri.get('age') if isinstance(ri, dict) else None)
                if ra is not None:
                    effective_age = int(ra)
            except Exception:
                pass
    except Exception:
        pass

    ctx = {
        'residentName': resident_full_name,
        'resident_name': resident_full_name,
        'address': request.delivery_address or '',
        'municipality': municipality_name,
        'documentType': getattr(document_type, 'name', code),
        'purpose': effective_purpose or getattr(request, 'purpose', '') or '',
        'date': issue_date.strftime('%B %d, %Y'),
        'dateRequested': (request.created_at.strftime('%B %d, %Y') if getattr(request, 'created_at', None) else ''),
        'validity': '',
    }

    # Always use document type name from database as the title
    # This ensures the correct title appears even if config doesn't match
    doc_type_name = getattr(document_type, 'name', code)
    title = doc_type_name  # Use database name directly, ignore config title
    body = _simple_template(spec.get('body', ''), ctx)
    footer = _simple_template(spec.get('footer', ''), ctx)
    signatory = (spec.get('signatory') or {})

    # Render
    pdf_buffer = BytesIO()
    c = canvas.Canvas(pdf_buffer, pagesize=A4)

    # Border and watermark
    _draw_border(c)
    barangay_name = getattr(getattr(request, 'barangay', None), 'name', '')
    _draw_header(c, municipality_name, province_name, mun_logo, prov_logo, level=level, barangay_name=barangay_name)
    _draw_watermark(c, mun_logo)
    # Add educational purpose watermark for all documents
    _draw_educational_watermark(c)

    # Title
    width, height = A4
    _set_font(c, "Times-Bold", 18)
    c.drawCentredString(width / 2, height - 60 * mm, _safe_text(str(title).upper()))

    # Body (formal paragraph with simple wrapping)
    def _wrap(text: str, max_chars: int = 95) -> list[str]:
        lines: list[str] = []
        for paragraph in _safe_text(text).split('\n'):
            p = paragraph.strip()
            while len(p) > max_chars:
                split_at = p.rfind(' ', 0, max_chars)
                if split_at <= 0:
                    split_at = max_chars
                lines.append(p[:split_at].strip())
                p = p[split_at:].lstrip()
            if p:
                lines.append(p)
            lines.append('')
        return lines

    # Use effective remarks and civil status
    notes_text = str(effective_remarks or '').strip()
    civil_status = str(effective_civil or '').strip()

    opening = "TO WHOM IT MAY CONCERN:"
    age_phrase = (f"{effective_age} years old" if isinstance(effective_age, int) and effective_age > 0 else '')
    cs_phrase = civil_status
    combined_phrase = ''
    if age_phrase and cs_phrase:
        combined_phrase = f"{age_phrase}, {cs_phrase}"
    elif age_phrase:
        combined_phrase = age_phrase
    elif cs_phrase:
        combined_phrase = cs_phrase

    paragraph = (
        f"This is to certify that {resident_full_name}{(', ' + combined_phrase) if combined_phrase else ''}, "
        f"a bona fide resident of {('Barangay ' + barangay_name + ', ') if level=='barangay' and barangay_name else ''}"
        f"Municipality of {municipality_name}, Province of {province_name}, has requested a "
        f"{getattr(document_type, 'name', code)} for the purpose of {ctx['purpose']}."
    )
    # Append remarks paragraph if provided
    extra = notes_text
    issued = (
        f"Issued this {ctx['date']} at the "
        f"{'Office of the Punong Barangay, Barangay ' + barangay_name if level=='barangay' else 'Office of the Municipal Mayor, Municipality of ' + municipality_name}, Province of {province_name}."
    )

    text_obj = c.beginText(25 * mm, height - 82 * mm)
    text_obj.setFont("Times-Roman", 12)
    for line in [opening, "", *(_wrap(paragraph)), *( _wrap(extra) if extra else [] ), "", *(_wrap(issued))]:
        if line is None:
            continue
        text_obj.textLine(_safe_text(line))
    c.drawText(text_obj)

    # Signatory block (FOR/BY)
    _set_font(c, "Times-Roman", 12)
    official_title = 'Municipal Mayor' if level != 'barangay' else 'Punong Barangay'
    
    # Load municipality officials data
    officials = _load_municipality_officials()
    barangay_officials = _load_barangay_officials()
    mun_officials = officials.get(municipality_name, {})

    # Helper to normalize names for lookup (tolerate accents, punctuation, spacing)
    def _norm(s: str) -> str:
        try:
            import unicodedata as _ud
            s2 = _ud.normalize('NFKD', s or '')
            s2 = ''.join(ch for ch in s2 if not _ud.combining(ch))
        except Exception:
            s2 = (s or '')
        s2 = s2.strip().lower()
        # Remove punctuation we don't care about and unify spacing
        s2 = s2.replace('.', '').replace('-', ' ').replace('(', ' ').replace(')', ' ')
        # Normalize common variants: "(Pob.)" -> "poblacion"
        s2 = s2.replace(' pob ', ' poblacion ')
        s2 = s2.replace(' pob.', ' poblacion')
        s2 = s2.replace(' (pob) ', ' poblacion ')
        s2 = s2.replace(' (pob.) ', ' poblacion ')
        s2 = s2.replace('pob.', 'poblacion')
        while '  ' in s2:
            s2 = s2.replace('  ', ' ')
        return s2

    if level == 'barangay':
        # Prefer explicit Punong Barangay list by municipality + barangay
        pb_name = None
        try:
            muni_map = barangay_officials.get(municipality_name) or {}
            lookup = { _norm(k): v for k, v in muni_map.items() }
            pb_name = lookup.get(_norm(barangay_name))
        except Exception:
            pb_name = None
        # Fallback to municipalityOfficials.json if it contains punong_barangay
        official_name = pb_name or mun_officials.get('punong_barangay') or official_title
    else:
        # Municipal level uses mayor
        official_name = mun_officials.get('mayor') or official_title

    by_name = None
    if admin_user is not None:
        by_name = ' '.join(filter(None, [getattr(admin_user, 'first_name', None), getattr(admin_user, 'last_name', None)])) or getattr(admin_user, 'username', None)
    by_name = by_name or 'Municipal Records Officer'
    # Prefer actual admin user's role label when available
    by_role = None
    if admin_user is not None:
        try:
            admin_role = getattr(admin_user, 'role', None)
            if admin_role == 'superadmin':
                by_role = 'Super Admin'
            elif admin_role == 'municipal_admin':
                by_role = 'Municipal Admin'
        except Exception:
            by_role = None
    if not by_role:
        by_role = 'Municipal Admin' if level != 'barangay' else 'Barangay Admin'

    c.drawString(25 * mm, 42 * mm, _safe_text(f"FOR: {official_name}"))
    c.drawString(25 * mm, 37 * mm, _safe_text(official_title))
    c.drawString(25 * mm, 30 * mm, _safe_text(f"BY: {by_name}"))
    c.drawString(25 * mm, 25 * mm, _safe_text(by_role))

    # Footer note
    _set_font(c, "Times-Italic", 10)
    footer_text = footer or "This is a digitally issued document. No physical signature required. Generated via MunLink Region III System."
    c.drawString(25 * mm, 20 * mm, _safe_text(footer_text))

    # Optional QR code - generate in memory (no filesystem dependency)
    try:
        from apps.api.utils.qr_generator import generate_qr_code_data, get_qr_code_bytesio

        qr_data = generate_qr_code_data(request)
        qr_bytesio = get_qr_code_bytesio(qr_data, size=350)  # Larger size for PDF embedding
        img = ImageReader(qr_bytesio)
        # Increased QR size from 20mm to 35mm for better scannability
        qr_size = 35 * mm
        # Position QR at bottom-right, but shifted left to avoid overlapping blue border
        # Increased left margin from 10mm to 20mm to accommodate larger QR size
        c.drawImage(img, width - (qr_size + 20 * mm), 20 * mm, width=qr_size, height=qr_size, preserveAspectRatio=True, mask='auto')
    except Exception as e:
        logger.warning(f"Failed to embed QR code in PDF: {e}")

    c.showPage()
    c.save()
    pdf_bytes = pdf_buffer.getvalue()

    # Check if we should upload to Supabase Storage
    flask_env = current_app.config.get('FLASK_ENV') or os.getenv('FLASK_ENV', 'development')
    is_production = flask_env == 'production'
    
    if is_production:
        # Upload to Supabase Storage
        try:
            from apps.api.utils.storage_handler import save_generated_document

            stored_ref = save_generated_document(
                pdf_bytes=pdf_bytes,
                request_id=request.id,
                municipality_slug=municipality_slug
            )

            if stored_ref:
                logger.info(f"PDF uploaded to storage: {stored_ref}")
                return None, stored_ref, pdf_bytes
             
        except Exception as e:
            logger.exception(f"Failed to upload PDF to storage: {e}")
            # Fall through to return local path

    # Development or fallback: persist under UPLOAD_FOLDER and return relative path
    upload_base = _resolve_writable_upload_base()
    out_dir = upload_base / 'generated_docs' / municipality_slug
    _ensure_dir(out_dir)
    pdf_path = out_dir / f"{request.id}.pdf"
    with open(str(pdf_path), 'wb') as f:
        f.write(pdf_bytes)

    rel_path = os.path.relpath(pdf_path, upload_base)
    # Normalize to POSIX-style for URLs
    rel_posix = rel_path.replace("\\", "/")
    return pdf_path, rel_posix, pdf_bytes


def generate_admin_terms_pdf() -> bytes:
    """Generate a professional PDF with admin terms of service and privacy policy.

    Returns:
        bytes: PDF file content
    """
    from reportlab.lib.pagesizes import letter
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import inch
    from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak
    from reportlab.lib.colors import HexColor

    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=inch,
        leftMargin=inch,
        topMargin=inch,
        bottomMargin=inch
    )

    # Container for the 'Flowable' objects
    elements = []

    # Define styles
    styles = getSampleStyleSheet()

    # Custom title style
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Title'],
        fontSize=24,
        textColor=HexColor('#1e40af'),
        spaceAfter=30,
        alignment=TA_CENTER,
        fontName='Helvetica-Bold'
    )

    # Custom heading style
    heading_style = ParagraphStyle(
        'CustomHeading',
        parent=styles['Heading1'],
        fontSize=16,
        textColor=HexColor('#1e40af'),
        spaceAfter=12,
        spaceBefore=20,
        fontName='Helvetica-Bold'
    )

    # Custom body style
    body_style = ParagraphStyle(
        'CustomBody',
        parent=styles['BodyText'],
        fontSize=11,
        alignment=TA_JUSTIFY,
        spaceAfter=12,
        leading=16
    )

    # Document title
    elements.append(Paragraph("MunLink Zambales", title_style))
    elements.append(Paragraph("Administrative Staff Agreement", title_style))
    elements.append(Spacer(1, 0.3*inch))

    # Date
    date_str = utc_now().strftime("%B %d, %Y")
    elements.append(Paragraph(f"<i>Effective Date: {date_str}</i>", body_style))
    elements.append(Spacer(1, 0.3*inch))

    # Introduction
    elements.append(Paragraph("Introduction", heading_style))
    elements.append(Paragraph(
        "Welcome to the MunLink Zambales administrative team. This document outlines "
        "the terms of service, responsibilities, and privacy guidelines that govern "
        "your role as an administrative staff member. By accepting this position, you "
        "agree to uphold these standards and maintain the highest level of integrity "
        "in serving the residents of Zambales province.",
        body_style
    ))
    elements.append(Spacer(1, 0.2*inch))

    # Section 1: Terms of Service
    elements.append(Paragraph("1. Terms of Service", heading_style))

    elements.append(Paragraph("1.1 Role and Responsibilities", heading_style))
    elements.append(Paragraph(
        "As an administrative staff member, you are responsible for verifying resident "
        "information, processing document requests, managing announcements, moderating "
        "marketplace listings, and handling issue reports within your assigned jurisdiction. "
        "You must perform these duties diligently, fairly, and in accordance with all "
        "applicable laws and regulations.",
        body_style
    ))

    elements.append(Paragraph("1.2 Code of Conduct", heading_style))
    elements.append(Paragraph(
        "You must maintain professional conduct at all times. This includes treating all "
        "residents with respect, avoiding conflicts of interest, refraining from accepting "
        "bribes or improper payments, and reporting any suspected violations of these terms "
        "or applicable laws to your supervisor immediately.",
        body_style
    ))

    elements.append(Paragraph("1.3 Account Security", heading_style))
    elements.append(Paragraph(
        "You are solely responsible for maintaining the confidentiality of your account "
        "credentials. Do not share your username, password, or access tokens with anyone. "
        "You must use strong, unique passwords and enable two-factor authentication (2FA) "
        "when available. Any actions taken using your account are your responsibility.",
        body_style
    ))

    elements.append(Paragraph("1.4 System Usage", heading_style))
    elements.append(Paragraph(
        "You may only access the MunLink system for legitimate administrative purposes. "
        "Unauthorized access, data mining, automated scraping, or attempts to circumvent "
        "security measures are strictly prohibited and may result in immediate termination "
        "and legal action.",
        body_style
    ))

    elements.append(PageBreak())

    # Section 2: Privacy and Data Protection
    elements.append(Paragraph("2. Privacy and Data Protection", heading_style))

    elements.append(Paragraph("2.1 Resident Privacy Law Compliance", heading_style))
    elements.append(Paragraph(
        "You must comply with all applicable Philippine data protection laws, including "
        "the Data Privacy Act of 2012 (Republic Act No. 10173). Resident information is "
        "highly sensitive and must be protected at all times.",
        body_style
    ))

    elements.append(Paragraph("2.2 Data Minimization", heading_style))
    elements.append(Paragraph(
        "You may only access resident data that is necessary for performing your official "
        "duties. Viewing resident profiles, documents, or personal information out of "
        "curiosity or for personal reasons is strictly prohibited.",
        body_style
    ))

    elements.append(Paragraph("2.3 Data Confidentiality", heading_style))
    elements.append(Paragraph(
        "All resident information must be kept strictly confidential. You may not disclose, "
        "share, sell, or transfer any resident data to third parties without proper "
        "authorization. This includes names, addresses, contact information, government IDs, "
        "selfies, financial information, and any other personal data.",
        body_style
    ))

    elements.append(Paragraph("2.4 Audit Logging", heading_style))
    elements.append(Paragraph(
        "All your actions on the MunLink platform are logged for security and accountability "
        "purposes. These logs include when you view resident IDs, approve or reject requests, "
        "create announcements, or perform any other administrative action. Super administrators "
        "and authorized personnel may review these logs at any time.",
        body_style
    ))

    elements.append(Paragraph("2.5 Data Retention", heading_style))
    elements.append(Paragraph(
        "Do not download, copy, screenshot, or otherwise retain resident data on your "
        "personal devices unless explicitly required for your duties and approved by your "
        "supervisor. Any data stored must be encrypted and deleted when no longer needed.",
        body_style
    ))

    elements.append(PageBreak())

    # Section 3: Legal Framework
    elements.append(Paragraph("3. Legal Framework and Penalties", heading_style))

    elements.append(Paragraph("3.1 Data Privacy Act of 2012 (RA 10173)", heading_style))
    elements.append(Paragraph(
        "Under Philippine law, unauthorized processing of personal data is a criminal offense. "
        "Violations can result in imprisonment of one (1) to six (6) years and a fine of "
        "Five hundred thousand pesos (Php 500,000.00) to Four million pesos (Php 4,000,000.00). "
        "Accessing personal data without authorization or for unauthorized purposes is "
        "specifically prohibited under Section 25 of the Act.",
        body_style
    ))

    elements.append(Paragraph("3.2 Anti-Graft and Corrupt Practices Act (RA 3019)", heading_style))
    elements.append(Paragraph(
        "Public officials and employees who misuse their position for personal gain or "
        "who act with manifest partiality, evident bad faith, or gross inexcusable negligence "
        "may be prosecuted under this law. Penalties include imprisonment and perpetual "
        "disqualification from public office.",
        body_style
    ))

    elements.append(Paragraph("3.3 Revised Penal Code Provisions", heading_style))
    elements.append(Paragraph(
        "Relevant provisions include: Article 171 (Falsification by Public Officer), "
        "Article 226 (Revealing Secrets with Abuse of Office), and Article 229 (Disclosure "
        "of Secrets). Violations carry penalties of imprisonment and fines.",
        body_style
    ))

    # Section 4: Consequences of Violations
    elements.append(Paragraph("4. Consequences of Violations", heading_style))
    elements.append(Paragraph(
        "Violations of these terms may result in: (1) Immediate suspension or termination "
        "of your administrative account; (2) Referral to law enforcement for criminal "
        "prosecution; (3) Civil liability for damages caused to affected residents; "
        "(4) Permanent disqualification from holding administrative positions in the "
        "MunLink system or any government service.",
        body_style
    ))

    elements.append(Spacer(1, 0.3*inch))

    # Section 5: Acknowledgment
    elements.append(Paragraph("5. Acknowledgment and Acceptance", heading_style))
    elements.append(Paragraph(
        "By registering as an administrative staff member, you acknowledge that you have "
        "read, understood, and agree to comply with all terms outlined in this document. "
        "You understand that violations may result in serious legal consequences, and you "
        "commit to upholding the highest standards of integrity, professionalism, and "
        "respect for resident privacy.",
        body_style
    ))

    elements.append(Spacer(1, 0.5*inch))

    # Footer
    elements.append(Paragraph(
        "<i>This document is generated automatically by the MunLink Zambales system. "
        "For questions or concerns, please contact your supervisor or the system administrator.</i>",
        body_style
    ))

    # Build PDF
    doc.build(elements)

    # Get PDF bytes
    pdf_bytes = buffer.getvalue()
    buffer.close()

    return pdf_bytes



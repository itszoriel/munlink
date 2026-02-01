"""
Zambales Province Scope Configuration

This module enforces Zambales-only scope across the entire platform.
All user-facing logic, filters, defaults, validations, and UI text
must assume Zambales as the primary and only selectable province.

Key Rules:
1. Province = Zambales only (province_id = 6)
2. Municipalities = Only those belonging to Zambales
3. Olongapo City is EXPLICITLY EXCLUDED from all logic
4. Region 3 data retained internally for compatibility

DO NOT modify without approval - this is a core platform constraint.
"""

# ============================================================================
# ZAMBALES PROVINCE CONFIGURATION
# ============================================================================

# Zambales province identifier (matches database)
ZAMBALES_PROVINCE_ID = 6
ZAMBALES_PROVINCE_NAME = "Zambales"
ZAMBALES_PROVINCE_SLUG = "zambales"

# ============================================================================
# OLONGAPO EXCLUSION CONFIGURATION
# ============================================================================

# Olongapo City must be excluded from all Zambales-related logic
OLONGAPO_MUNICIPALITY_ID = 130
OLONGAPO_MUNICIPALITY_SLUG = "city-of-olongapo"
OLONGAPO_MUNICIPALITY_NAME = "City of Olongapo"

# List of excluded municipality IDs (for easy extension if needed)
EXCLUDED_MUNICIPALITY_IDS = [OLONGAPO_MUNICIPALITY_ID]
EXCLUDED_MUNICIPALITY_SLUGS = [OLONGAPO_MUNICIPALITY_SLUG]

# ============================================================================
# ZAMBALES MUNICIPALITIES (Valid municipalities - excluding Olongapo)
# ============================================================================

# Municipality IDs for Zambales (from DB, excluding Olongapo)
ZAMBALES_MUNICIPALITY_IDS = [
    108,  # Botolan
    109,  # Cabangan
    110,  # Candelaria
    111,  # Castillejos
    112,  # Iba (capital)
    113,  # Masinloc
    114,  # Palauig
    115,  # San Antonio (Zambales)
    116,  # San Felipe
    117,  # San Marcelino
    118,  # San Narciso
    119,  # Santa Cruz
    120,  # Subic
]

ZAMBALES_MUNICIPALITY_SLUGS = [
    "botolan",
    "cabangan",
    "candelaria",
    "castillejos",
    "iba",
    "masinloc",
    "palauig",
    "san-antonio-zambales",
    "san-felipe",
    "san-marcelino",
    "san-narciso",
    "santa-cruz",
    "subic",
]

# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def is_valid_zambales_municipality(municipality_id: int) -> bool:
    """Check if municipality ID is a valid Zambales municipality (excluding Olongapo)."""
    if municipality_id is None:
        return False
    return int(municipality_id) in ZAMBALES_MUNICIPALITY_IDS


def is_olongapo(municipality_id: int) -> bool:
    """Check if municipality ID is Olongapo (excluded)."""
    if municipality_id is None:
        return False
    return int(municipality_id) == OLONGAPO_MUNICIPALITY_ID


def is_excluded_municipality(municipality_id: int) -> bool:
    """Check if municipality ID is in the exclusion list."""
    if municipality_id is None:
        return False
    return int(municipality_id) in EXCLUDED_MUNICIPALITY_IDS


def get_zambales_municipality_filter():
    """
    Returns SQLAlchemy filter conditions for Zambales municipalities.
    Use with: query.filter(get_zambales_municipality_filter())
    
    Example:
        from models.municipality import Municipality
        municipalities = Municipality.query.filter(
            Municipality.id.in_(ZAMBALES_MUNICIPALITY_IDS)
        ).all()
    """
    return ZAMBALES_MUNICIPALITY_IDS


def validate_municipality_in_zambales(municipality_id: int, raise_error: bool = True) -> bool:
    """
    Validate that a municipality belongs to Zambales (excluding Olongapo).
    
    Args:
        municipality_id: The municipality ID to validate
        raise_error: If True, raises ValueError on invalid municipality
        
    Returns:
        True if valid Zambales municipality, False otherwise
        
    Raises:
        ValueError: If municipality is invalid and raise_error=True
    """
    if municipality_id is None:
        if raise_error:
            raise ValueError("Municipality ID is required")
        return False
    
    municipality_id = int(municipality_id)
    
    if is_olongapo(municipality_id):
        if raise_error:
            raise ValueError("Olongapo City is not available in this system")
        return False
    
    if not is_valid_zambales_municipality(municipality_id):
        if raise_error:
            raise ValueError("Municipality is not within Zambales province")
        return False
    
    return True


def get_default_province():
    """Get the default (and only) province for the system."""
    return {
        "id": ZAMBALES_PROVINCE_ID,
        "name": ZAMBALES_PROVINCE_NAME,
        "slug": ZAMBALES_PROVINCE_SLUG,
    }


def validate_shared_municipalities(municipality_ids: list, raise_error: bool = True) -> bool:
    """
    Validate that all municipality IDs in the sharing list belong to Zambales.

    Args:
        municipality_ids: List of municipality IDs to validate
        raise_error: If True, raises ValueError on invalid municipality

    Returns:
        True if all municipalities are valid Zambales municipalities, False otherwise

    Raises:
        ValueError: If any municipality is invalid and raise_error=True
    """
    if not municipality_ids:
        return True  # Empty list is valid (no sharing)

    if not isinstance(municipality_ids, list):
        if raise_error:
            raise ValueError("shared_with_municipalities must be a list")
        return False

    # Validate each municipality ID
    for muni_id in municipality_ids:
        try:
            muni_id = int(muni_id)
            if is_olongapo(muni_id):
                if raise_error:
                    raise ValueError(f"Cannot share with Olongapo City (ID {muni_id})")
                return False

            if not is_valid_zambales_municipality(muni_id):
                if raise_error:
                    raise ValueError(f"Municipality ID {muni_id} is not within Zambales province")
                return False
        except (TypeError, ValueError) as e:
            if raise_error:
                raise ValueError(f"Invalid municipality ID: {muni_id}")
            return False

    return True


# ============================================================================
# DATABASE QUERY HELPERS
# ============================================================================

def apply_zambales_municipality_filter(query, municipality_model):
    """
    Apply Zambales municipality filter to a SQLAlchemy query.
    
    Args:
        query: SQLAlchemy query object
        municipality_model: The model class with municipality_id column
        
    Returns:
        Filtered query
    """
    return query.filter(
        municipality_model.municipality_id.in_(ZAMBALES_MUNICIPALITY_IDS)
    )


def apply_zambales_scope_to_municipality_query(query, municipality_model):
    """
    Apply Zambales scope filter to Municipality query (filters by ID).
    
    Args:
        query: SQLAlchemy query on Municipality model
        municipality_model: Municipality model class
        
    Returns:
        Filtered query excluding Olongapo and non-Zambales municipalities
    """
    return query.filter(
        municipality_model.id.in_(ZAMBALES_MUNICIPALITY_IDS)
    )


# ============================================================================
# BRANDING / UI TEXT
# ============================================================================

PLATFORM_REGION_NAME = "Zambales"
PLATFORM_FULL_NAME = "MunLink Zambales"
PLATFORM_TAGLINE = "Digital Governance for Zambales"


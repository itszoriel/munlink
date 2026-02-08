"""
MunLink Region III - Flask API Application
Main application entry point
"""
import sys
import os
import json
from pathlib import Path
from dotenv import load_dotenv

# Determine project root (2 levels up from this file)
API_DIR = Path(__file__).parent.resolve()
PROJECT_ROOT = API_DIR.parent.parent.resolve()

# Load environment variables from .env file at project root
env_path = PROJECT_ROOT / '.env'
if env_path.exists():
    load_dotenv(env_path)

# Add project root to path for absolute imports
sys.path.insert(0, str(PROJECT_ROOT))

from flask import Flask, jsonify, send_from_directory, request
from flask_cors import CORS

# Import config - use relative imports
from apps.api.config import Config
from apps.api import db, migrate, jwt, limiter

# Rate limiter is now imported from __init__ to avoid circular imports


def create_app(config_class=Config):
    """Application factory pattern"""
    app = Flask(__name__)
    app.config.from_object(config_class)
    
    # Log database URL for debugging (masked)
    db_url = app.config.get('SQLALCHEMY_DATABASE_URI', '')
    if 'postgresql' in db_url:
        app.logger.info("Database: PostgreSQL (Supabase)")
    elif 'sqlite' in db_url:
        app.logger.info("Database: SQLite (local)")
    
    # Ensure directories and other config-dependent setup are initialized
    try:
        config_class.init_app(app)
    except Exception:
        pass
    
    # Initialize extensions with app
    db.init_app(app)
    migrate.init_app(app, db)
    jwt.init_app(app)
    
    # Initialize rate limiter
    if app.config.get('RATELIMIT_ENABLED', True):
        limiter.init_app(app)
        app.logger.info("Rate limiting enabled")
    else:
        app.logger.warning("Rate limiting is DISABLED - not recommended for production")
    
    # Security Headers Middleware
    @app.after_request
    def add_security_headers(response):
        """Add security headers to all responses."""
        # Prevent MIME type sniffing
        response.headers['X-Content-Type-Options'] = 'nosniff'
        
        # Prevent clickjacking
        response.headers['X-Frame-Options'] = 'DENY'
        
        # XSS protection (legacy, but still useful for older browsers)
        response.headers['X-XSS-Protection'] = '1; mode=block'
        
        # Referrer policy
        response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
        
        # Permissions policy (disable unnecessary browser features)
        response.headers['Permissions-Policy'] = 'geolocation=(), microphone=(), camera=()'
        
        # HSTS - only in production (when not localhost)
        if not app.config.get('DEBUG'):
            response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'
        
        # Content Security Policy - allow self and required external resources
        # Adjust based on your frontend requirements
        csp_directives = [
            "default-src 'self'",
            "script-src 'self'",
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
            "font-src 'self' https://fonts.gstatic.com",
            "img-src 'self' data: blob: https:",
            "connect-src 'self' https://api.sendgrid.com https://dashboard.philsms.com",
            "frame-ancestors 'none'",
            "base-uri 'self'",
            "form-action 'self'",
        ]
        response.headers['Content-Security-Policy'] = '; '.join(csp_directives)

        # Never leak raw exception details in non-debug environments.
        if not app.config.get('DEBUG') and response.status_code >= 400 and response.is_json:
            try:
                payload = response.get_json(silent=True)
                if isinstance(payload, dict) and 'details' in payload:
                    payload.pop('details', None)
                    response.set_data(json.dumps(payload))
                    response.headers['Content-Type'] = 'application/json'
            except Exception:
                pass
        
        return response
    
    # CORS configuration
    # NOTE: Cannot use wildcard ("*") with supports_credentials=True
    # Even in development, we must specify explicit origins for credentialed requests
    cors_origins = []
    is_production = (app.config.get('FLASK_ENV') == 'production') and not app.config.get('DEBUG')

    for key in ('WEB_URL', 'ADMIN_URL'):
        value = (app.config.get(key) or '').strip()
        if value:
            cors_origins.append(value)

    # Optional explicit allowlist: comma-separated origins.
    extra_origins = (os.getenv('CORS_ALLOWED_ORIGINS') or '').split(',')
    cors_origins.extend([o.strip() for o in extra_origins if o.strip()])

    if not is_production:
        cors_origins.extend([
            os.getenv('RAILWAY_WEB_URL', 'https://munlink.up.railway.app'),
            os.getenv('RAILWAY_ADMIN_URL', 'https://admin-munlink.up.railway.app'),
            "https://munlink.up.railway.app",
            "https://admin-munlink.up.railway.app",
            "http://localhost:3000",
            "http://localhost:3001",
            "http://localhost:5173",
            "http://127.0.0.1:3000",
            "http://127.0.0.1:3001",
            "http://127.0.0.1:5173",
        ])

    # Remove duplicates
    cors_origins = list(dict.fromkeys(cors_origins))
    cors_origins = [origin for origin in cors_origins if origin]

    if is_production and not cors_origins:
        raise RuntimeError(
            "CORS configuration error: set WEB_URL/ADMIN_URL or CORS_ALLOWED_ORIGINS in production."
        )
    
    # Apply CORS globally with Flask-CORS
    CORS(app,
         origins=cors_origins,
         methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
         allow_headers=["Content-Type", "Authorization", "X-Requested-With", "X-Admin-Secret"],
         supports_credentials=True,
         expose_headers=["Content-Type", "Authorization"])
    
    # JWT token blacklist check
    @jwt.token_in_blocklist_loader
    def check_if_token_revoked(jwt_header, jwt_payload):
        from apps.api.models.token_blacklist import TokenBlacklist
        jti = jwt_payload['jti']
        return TokenBlacklist.is_token_revoked(jti)
    
    # Register blueprints
    from apps.api.routes import (
        auth_bp,
        provinces_bp,
        municipalities_bp,
        marketplace_bp,
        announcements_bp,
        documents_bp,
        issues_bp,
        benefits_bp,
        special_status_bp,
        stripe_webhook_bp,
    )
    from apps.api.routes.admin import admin_bp
    from apps.api.routes.superadmin import superadmin_bp

    app.register_blueprint(auth_bp)
    app.register_blueprint(provinces_bp)
    app.register_blueprint(municipalities_bp)
    app.register_blueprint(marketplace_bp)
    app.register_blueprint(announcements_bp)
    app.register_blueprint(documents_bp)
    app.register_blueprint(issues_bp)
    app.register_blueprint(benefits_bp)
    app.register_blueprint(special_status_bp)
    app.register_blueprint(stripe_webhook_bp)
    app.register_blueprint(admin_bp)
    app.register_blueprint(superadmin_bp)

    # Health check endpoint
    @app.route('/health', methods=['GET'])
    def health_check():
        """Health check endpoint for monitoring"""
        return jsonify({
            'status': 'ok',
            'service': 'MunLink Region III API',
            'version': '1.0.0'
        }), 200
    
    # Database health check endpoint
    @app.route('/health/db', methods=['GET'])
    def db_health_check():
        """Health check endpoint that tests database connectivity"""
        import time
        start = time.time()
        try:
            # Test database connection with a simple query
            from sqlalchemy import text
            result = db.session.execute(text('SELECT 1'))
            result.fetchone()
            db.session.rollback()  # Don't leave transaction open
            elapsed = time.time() - start
            return jsonify({
                'status': 'healthy',
                'database': 'connected',
                'latency_ms': round(elapsed * 1000, 2),
                'service': 'MunLink Region III API'
            }), 200
        except Exception as e:
            elapsed = time.time() - start
            app.logger.error(f"Database health check failed: {e}")
            return jsonify({
                'status': 'unhealthy',
                'database': 'disconnected',
                'latency_ms': round(elapsed * 1000, 2),
                'error': str(e)[:200]
            }), 503
    
    # Root endpoint
    @app.route('/', methods=['GET'])
    def root():
        """API root endpoint"""
        return jsonify({
            'message': 'MunLink Region III API',
            'version': '1.0.0',
            'region': 'Central Luzon (Region III)',
            'provinces': 7,
            'municipalities': 129,
            'docs': '/api/docs'
        }), 200
    
    # Public verify route (for QR codes)
    @app.route('/verify/<string:request_number>', methods=['GET'])
    def public_verify_direct(request_number: str):
        """Handle verify requests directly (for QR codes pointing to backend)."""
        try:
            from apps.api.models.document import DocumentRequest
            r = DocumentRequest.query.filter_by(request_number=request_number).first()
            if not r:
                return jsonify({'valid': False, 'reason': 'not_found'}), 200
            if (r.delivery_method or '').lower() != 'digital':
                return jsonify({'valid': False, 'reason': 'not_digital'}), 200
            if not r.document_file:
                return jsonify({'valid': False, 'reason': 'no_file'}), 200
            status = (r.status or '').lower()
            if status not in ('ready', 'completed'):
                return jsonify({'valid': False, 'reason': f'status_{status}'}), 200
            muni_name = getattr(getattr(r, 'municipality', None), 'name', None)
            doc_name = getattr(getattr(r, 'document_type', None), 'name', None)
            issued_at = r.ready_at.isoformat() if getattr(r, 'ready_at', None) else None
            return jsonify({
                'valid': True,
                'request_number': r.request_number,
                'status': r.status,
                'muni_name': muni_name,
                'doc_name': doc_name,
                'issued_at': issued_at,
            }), 200
        except Exception as e:
            app.logger.error("Public verify failed for %s: %s", request_number, e)
            return jsonify({'valid': False, 'error': 'verification_failed'}), 500
    
    # Serve uploaded files
    @app.route('/uploads/<path:filename>')
    def serve_uploaded_file(filename):
        """Serve only non-sensitive uploaded files."""
        try:
            normalized = str(filename or '').replace('\\', '/').lstrip('/')
            if not normalized or '..' in normalized.split('/'):
                return jsonify({'error': 'Invalid file path'}), 400

            # Sensitive categories must never be publicly served.
            protected_prefixes = (
                'verification/',
                'document_requests/',
                'generated_docs/',
                'claims/',
                'manual-payments/',
                'benefits/',
            )
            if any(normalized.startswith(prefix) for prefix in protected_prefixes):
                return jsonify({'error': 'Forbidden'}), 403

            # Restrict to explicit public-safe media categories.
            public_prefixes = (
                'profiles/',
                'marketplace/',
                'announcements/',
                'benefit_programs/',
                'issues/',
            )
            if not any(normalized.startswith(prefix) for prefix in public_prefixes):
                return jsonify({'error': 'Forbidden'}), 403

            upload_dir = app.config.get('UPLOAD_FOLDER', 'uploads')
            directory = str(upload_dir)
            return send_from_directory(directory, normalized)
        except FileNotFoundError:
            return jsonify({'error': 'File not found'}), 404
    
    # Error handlers
    @app.errorhandler(404)
    def not_found(error):
        return jsonify({'error': 'Resource not found'}), 404
    
    @app.errorhandler(500)
    def internal_error(error):
        db.session.rollback()
        return jsonify({'error': 'Internal server error'}), 500
    
    @app.errorhandler(401)
    def unauthorized(error):
        return jsonify({'error': 'Unauthorized'}), 401
    
    @app.errorhandler(403)
    def forbidden(error):
        return jsonify({'error': 'Forbidden'}), 403

    # Flask-Limiter rate limit handler (ensure JSON, not HTML)
    try:
        from flask_limiter.errors import RateLimitExceeded

        @app.errorhandler(RateLimitExceeded)
        def ratelimit_handler(error):  # pragma: no cover
            payload = {'error': 'Rate limit exceeded'}
            try:
                desc = getattr(error, 'description', None)
                if desc:
                    payload['details'] = str(desc)
            except Exception:
                pass
            resp = jsonify(payload)
            resp.status_code = 429
            # Preserve limiter-provided headers when available
            try:
                for k, v in error.get_headers():
                    if str(k).lower() == 'content-type':
                        continue
                    resp.headers[k] = v
            except Exception:
                pass
            return resp
    except Exception:
        pass
    
    return app


# Create app instance
app = create_app()

if __name__ == '__main__':
    app.run(
        host='0.0.0.0',
        port=5000,
        debug=app.config['DEBUG']
    )

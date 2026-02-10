"""
MunLink Zambales - Configuration
Application configuration management
"""
import os
import logging
import tempfile
from datetime import timedelta
from pathlib import Path
from urllib.parse import urlparse, parse_qs, urlencode, urlunparse

# Resolve base directory for both monorepo and API-only deployments.
# Monorepo layout: <repo>/apps/api/config.py -> BASE_DIR=<repo>
# API-only layout: /app/config.py -> BASE_DIR=/app
_THIS_DIR = Path(__file__).parent.resolve()
_MONOREPO_ROOT = _THIS_DIR.parent.parent
if (_MONOREPO_ROOT / 'apps' / 'api').exists():
    BASE_DIR = _MONOREPO_ROOT.resolve()
else:
    BASE_DIR = _THIS_DIR


def _require_env(name: str, default: str = None, allow_default_in_dev: bool = True) -> str:
    """
    Get environment variable, failing loudly in production if not set.
    
    Args:
        name: Environment variable name
        default: Default value (only used in development)
        allow_default_in_dev: Whether to allow default in development mode
    
    Returns:
        The environment variable value
        
    Raises:
        RuntimeError: If variable is not set in production
    """
    value = os.getenv(name)
    is_production = os.getenv('FLASK_ENV', 'development') == 'production'
    
    if value:
        return value
    
    if is_production:
        # In production, critical secrets MUST be set
        if default is None or name in ('SECRET_KEY', 'JWT_SECRET_KEY', 'ADMIN_SECRET_KEY'):
            raise RuntimeError(
                f"SECURITY ERROR: {name} environment variable is required in production. "
                f"Set it in your deployment environment (Railway Dashboard, etc.)"
            )
        logging.warning(f"Using default value for {name} in production - consider setting explicitly")
        return default
    
    # Development mode - allow defaults
    if default is not None and allow_default_in_dev:
        logging.debug(f"Using default value for {name} in development")
        return default
    
    raise RuntimeError(f"{name} environment variable is required")


def get_database_url():
    """
    Get and process the database URL for proper connection handling.
    - Ensures SSL is enabled for PostgreSQL connections (required by Supabase)
    - Handles URL scheme conversion (postgres:// -> postgresql://)
    - Adds connection parameters for better reliability
    """
    url = os.getenv('DATABASE_URL')

    if not url:
        # In platform environments where DB isn't provided (e.g., healthcheck-only boot),
        # fall back to a lightweight SQLite DB so the app can start and serve /health.
        fallback = 'sqlite:///tmp/healthcheck.db'
        logging.warning("DATABASE_URL not set; using fallback %s for startup/healthchecks", fallback)
        return fallback
    
    # Handle Heroku/Render style postgres:// URLs (SQLAlchemy requires postgresql://)
    if url.startswith('postgres://'):
        url = url.replace('postgres://', 'postgresql://', 1)
    
    # For PostgreSQL connections, ensure SSL is configured
    if url.startswith('postgresql://'):
        try:
            parsed = urlparse(url)
            query_params = parse_qs(parsed.query)
            
            # Add sslmode=require if not already set (required for Supabase)
            if 'sslmode' not in query_params:
                query_params['sslmode'] = ['require']
            
            # Rebuild the URL with updated query params
            new_query = urlencode(query_params, doseq=True)
            url = urlunparse((
                parsed.scheme,
                parsed.netloc,
                parsed.path,
                parsed.params,
                new_query,
                parsed.fragment
            ))
        except ValueError as e:
            # URL parsing failed - likely due to special characters in password
            # Just append sslmode if not present and return
            logging.warning(f"Could not parse DATABASE_URL (special chars?): {e}")
            if 'sslmode=' not in url:
                separator = '&' if '?' in url else '?'
                url = f"{url}{separator}sslmode=require"
    
    return url


def get_engine_options():
    """
    Get SQLAlchemy engine options based on the database type.
    PostgreSQL requires specific connection settings for Supabase.
    
    NOTE: Supabase pooler (port 6543) is recommended over direct (port 5432) because:
    - Pooler doesn't require IP allowlisting
    - Pooler handles connection management better
    - Direct connection may have IPv6/IPv4 connectivity issues from some cloud providers
    
    For Render free tier: We use aggressive connection settings to handle
    intermittent network issues between Render and Supabase.
    """
    db_url = get_database_url()

    # Base options for all databases
    options = {
        'pool_pre_ping': True,  # Verify connections before use (handles stale connections)
    }
    
    # PostgreSQL-specific options for Supabase connection
    if db_url.startswith('postgresql://'):
        # Check if using Supabase pooler (port 6543) vs direct (port 5432)
        is_pooler = ':6543' in db_url or 'pooler.supabase.com' in db_url
        
        if is_pooler:
            # Transaction pooler mode - use NullPool (no persistent connections)
            # because PgBouncer in transaction mode doesn't play well with connection pooling
            from sqlalchemy.pool import NullPool
            options.update({
                'poolclass': NullPool,  # Don't pool connections - let Supabase pooler handle it
                'connect_args': {
                    'connect_timeout': 30,      # 30 second connection timeout (increased for Render->Supabase)
                    'keepalives': 1,            # Enable TCP keepalives
                    'keepalives_idle': 30,      # Start keepalives after 30s idle
                    'keepalives_interval': 10,  # Send keepalive every 10s
                    'keepalives_count': 5,      # Try 5 times before giving up
                    'options': '-c statement_timeout=60000',  # 60 second query timeout
                    'application_name': 'munlink-api',  # For connection tracking in Supabase
                }
            })
        else:
            # Direct connection - use minimal pooling and shorter timeouts
            # Note: Direct connections may have IP restrictions or IPv6 issues
            # Consider using pooler (port 6543) if you experience connection problems
            options.update({
                'pool_recycle': 180,    # Recycle connections every 3 minutes (shorter for direct)
                'pool_timeout': 20,     # Wait up to 20 seconds for a connection from pool
                'pool_size': 1,         # Keep only 1 connection (direct connections are more limited)
                'max_overflow': 2,      # Allow up to 2 additional connections
                'connect_args': {
                    'connect_timeout': 20,      # 20 second connection timeout (shorter)
                    'keepalives': 1,            # Enable TCP keepalives
                    'keepalives_idle': 20,      # Seconds before sending keepalive
                    'keepalives_interval': 5,   # Seconds between keepalives (more frequent)
                    'keepalives_count': 3,      # Number of keepalives before giving up
                    'options': '-c statement_timeout=20000',  # 20 second query timeout
                }
            })
    
    # For SQLite fallback keep the options minimal (no pooling)
    if db_url.startswith('sqlite://'):
        from sqlalchemy.pool import NullPool
        options = {'poolclass': NullPool}

    return options


def derive_cookie_domain():
    """
    Derive a shared cookie domain automatically from configured URLs.
    Falls back to COOKIE_DOMAIN env if provided, otherwise attempts to
    use the parent domain of ADMIN_URL/WEB_URL so refresh cookies work
    across api/admin subdomains (e.g., *.up.railway.app).
    """
    explicit = os.getenv('COOKIE_DOMAIN')
    if explicit:
        return explicit

    for key in ('ADMIN_URL', 'WEB_URL', 'BASE_URL'):
        url = os.getenv(key)
        if not url:
            continue
        try:
            host = urlparse(url).hostname
            if not host:
                continue
            parts = host.split('.')
            if len(parts) >= 3:
                return '.'.join(parts[-3:])  # e.g., up.railway.app
            if len(parts) >= 2:
                return '.'.join(parts[-2:])  # fallback: example.com
        except Exception:
            continue
    return None


class Config:
    """Base configuration"""
    
    # Flask - SECRET_KEY is REQUIRED in production
    SECRET_KEY = _require_env('SECRET_KEY', 'dev-secret-key-for-local-development-only')
    DEBUG = os.getenv('DEBUG', 'False') == 'True'
    FLASK_ENV = os.getenv('FLASK_ENV', 'development')
    
    # Database
    SQLALCHEMY_DATABASE_URI = get_database_url()
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ECHO = DEBUG
    
    # SQLAlchemy Engine Options - dynamically configured based on database type
    SQLALCHEMY_ENGINE_OPTIONS = get_engine_options()
    
    # Supabase Configuration (optional - for Supabase features like auth, storage, real-time)
    SUPABASE_URL = os.getenv('SUPABASE_URL', '')
    SUPABASE_KEY = os.getenv('SUPABASE_KEY', '')
    SUPABASE_SERVICE_KEY = os.getenv('SUPABASE_SERVICE_KEY', '')
    
    # JWT - JWT_SECRET_KEY is REQUIRED in production
    JWT_SECRET_KEY = _require_env('JWT_SECRET_KEY', 'jwt-dev-secret-for-local-development-only')
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(
        seconds=int(os.getenv('JWT_ACCESS_TOKEN_EXPIRES', 86400))
    )
    JWT_ALGORITHM = 'HS256'
    # Enable JWT in headers and cookies; use cookies for refresh token
    JWT_TOKEN_LOCATION = ['headers', 'cookies']
    # Cookie settings for refresh token (and optionally access later)
    # Default to secure cross-site cookies in production so admin web (separate subdomain)
    # can send refresh cookies to the API domain.
    JWT_COOKIE_SECURE = (os.getenv('JWT_COOKIE_SECURE', 'False' if DEBUG else 'True') == 'True')
    JWT_COOKIE_SAMESITE = os.getenv('JWT_COOKIE_SAMESITE', 'Lax' if DEBUG else 'None')
    JWT_COOKIE_DOMAIN = derive_cookie_domain()  # e.g., .up.railway.app
    JWT_ACCESS_COOKIE_PATH = '/'
    JWT_REFRESH_COOKIE_PATH = '/'
    # CSRF protection for cookie-based auth (recommended: True in production)
    JWT_COOKIE_CSRF_PROTECT = (os.getenv('JWT_COOKIE_CSRF_PROTECT', 'False') == 'True')
    
    # Admin Security - ADMIN_SECRET_KEY is REQUIRED in production
    ADMIN_SECRET_KEY = _require_env('ADMIN_SECRET_KEY', 'admin-dev-secret-for-local-development-only')
    
    # Rate Limiting Configuration
    RATELIMIT_ENABLED = os.getenv('RATELIMIT_ENABLED', 'True') == 'True'
    RATELIMIT_STORAGE_URI = os.getenv('RATELIMIT_STORAGE_URI', 'memory://')
    if FLASK_ENV == 'production' and RATELIMIT_ENABLED and RATELIMIT_STORAGE_URI.strip().lower() == 'memory://':
        raise RuntimeError(
            "RATELIMIT_STORAGE_URI must use a shared backend (e.g., Redis) in production."
        )
    RATELIMIT_DEFAULT = os.getenv('RATELIMIT_DEFAULT', '200 per day, 50 per hour')
    RATELIMIT_HEADERS_ENABLED = True
    
    # File Uploads
    MAX_CONTENT_LENGTH = int(os.getenv('MAX_FILE_SIZE', 10 * 1024 * 1024))  # 10MB
    UPLOAD_FOLDER = BASE_DIR / os.getenv('UPLOAD_FOLDER', 'uploads/region3')
    ALLOWED_EXTENSIONS = set(
        os.getenv('ALLOWED_EXTENSIONS', 'pdf,jpg,jpeg,png,doc,docx').split(',')
    )
    # Allowed file domains for secure document serving (prevents open redirect)
    ALLOWED_FILE_DOMAINS = [
        domain.strip()
        for domain in os.getenv('ALLOWED_FILE_DOMAINS', '').split(',')
        if domain.strip()
    ]

    # Email Configuration
    # SendGrid API (for production on Render where SMTP is blocked)
    SENDGRID_API_KEY = os.getenv('SENDGRID_API_KEY', '')
    # SMTP (for development with Gmail)
    SMTP_SERVER = os.getenv('SMTP_SERVER', '')
    SMTP_PORT = int(os.getenv('SMTP_PORT', 587))
    SMTP_USERNAME = os.getenv('SMTP_USERNAME', '')
    SMTP_PASSWORD = os.getenv('SMTP_PASSWORD', '')
    # Sender email address (used by both SendGrid and SMTP)
    FROM_EMAIL = os.getenv('FROM_EMAIL', '')

    # Password Reset
    PASSWORD_RESET_TOKEN_TTL_MINUTES = int(os.getenv('PASSWORD_RESET_TOKEN_TTL_MINUTES', 30))

    # SMS / Notifications
    SMS_PROVIDER = os.getenv('SMS_PROVIDER', 'disabled')  # philsms | console | disabled
    PHILSMS_API_KEY = os.getenv('PHILSMS_API_KEY', '')
    PHILSMS_SENDER_ID = os.getenv('PHILSMS_SENDER_ID', '')
    PHILSMS_BASE_URL = os.getenv('PHILSMS_BASE_URL', 'https://dashboard.philsms.com/api/v3')
    SMS_CAPABILITY_CACHE_SECONDS = int(os.getenv('SMS_CAPABILITY_CACHE_SECONDS', 90))

    # Manual QR Payment (global)
    MANUAL_QR_IMAGE_PATH = os.getenv(
        'MANUAL_QR_IMAGE_PATH',
        'public/payment/paymentQR_fallback.jpg'
    )
    MANUAL_PAYMENT_INSTRUCTIONS = os.getenv(
        'MANUAL_PAYMENT_INSTRUCTIONS',
        'Scan the QR, pay the exact amount shown, upload proof, then enter the Payment ID sent to your email.'
    )
    MANUAL_PAY_TO_NAME = os.getenv('MANUAL_PAY_TO_NAME', '')
    MANUAL_PAY_TO_NUMBER = os.getenv('MANUAL_PAY_TO_NUMBER', '09764859463')
    SUPABASE_PRIVATE_BUCKET = os.getenv('SUPABASE_PRIVATE_BUCKET', 'munlinkprivate-files')
    
    # QR Codes
    # Default to WEB_URL + /verify, or use QR_BASE_URL if set
    QR_BASE_URL = os.getenv('QR_BASE_URL') or None  # Will fallback to WEB_URL + /verify
    QR_EXPIRY_DAYS = int(os.getenv('QR_EXPIRY_DAYS', 30))
    
    # Application
    # Default name aligns with Zambales-only scope; override via APP_NAME env if needed
    APP_NAME = os.getenv('APP_NAME', 'MunLink Zambales')
    
    # Frontend URLs (for CORS and QR codes)
    # Note: WEB_URL is used for email verification links and QR codes
    # In production, set this to your actual frontend URL
    WEB_URL = os.getenv('WEB_URL', 'http://localhost:5173')
    ADMIN_URL = os.getenv('ADMIN_URL', 'http://localhost:3001')
    
    # Location Data - use API-local data folder (works on Render)
    # API_DIR is where apps/api is located
    API_DIR = Path(__file__).parent.resolve()
    LOCATION_DATA_FILE = API_DIR / 'data' / 'locations' / 'philippines_full_locations.json'
    REGION3_DATA_FILE = API_DIR / 'data' / 'locations' / 'region3_locations.json'
    
    # Asset Paths
    MUNICIPAL_LOGOS_DIR = BASE_DIR / 'public' / 'logos' / 'municipalities'
    PROVINCE_LOGOS_DIR = BASE_DIR / 'public' / 'logos' / 'provinces'
    LANDMARKS_DIR = BASE_DIR / 'public' / 'landmarks'
    
    # Region 3 Provinces (Central Luzon)
    REGION3_PROVINCES = [
        'Aurora', 'Bataan', 'Bulacan', 'Nueva Ecija', 
        'Pampanga', 'Tarlac', 'Zambales'
    ]
    
    @staticmethod
    def init_app(app):
        """Initialize application configuration"""
        # Create upload directories if they don't exist. If configured path is
        # not writable in container runtime, fall back to /tmp.
        configured_upload = app.config.get('UPLOAD_FOLDER', Config.UPLOAD_FOLDER)
        upload_dir = Path(configured_upload)
        try:
            upload_dir.mkdir(parents=True, exist_ok=True)
        except Exception as exc:
            fallback_dir = Path(tempfile.gettempdir()) / 'munlink_uploads' / 'region3'
            fallback_dir.mkdir(parents=True, exist_ok=True)
            app.config['UPLOAD_FOLDER'] = fallback_dir
            upload_dir = fallback_dir
            app.logger.warning(
                "UPLOAD_FOLDER '%s' is not writable (%s); using fallback '%s'",
                configured_upload,
                exc,
                fallback_dir,
            )
        else:
            app.config['UPLOAD_FOLDER'] = upload_dir
        
        # Create municipality upload directories will be created dynamically
        # based on seeded municipalities from Region 3 provinces
        
        # Create marketplace upload directory
        try:
            (upload_dir / 'marketplace' / 'items').mkdir(parents=True, exist_ok=True)
        except Exception as exc:
            fallback_dir = Path(tempfile.gettempdir()) / 'munlink_uploads' / 'region3'
            fallback_dir.mkdir(parents=True, exist_ok=True)
            app.config['UPLOAD_FOLDER'] = fallback_dir
            (fallback_dir / 'marketplace' / 'items').mkdir(parents=True, exist_ok=True)
            app.logger.warning(
                "Marketplace upload path setup failed under '%s' (%s); switched to '%s'",
                upload_dir,
                exc,
                fallback_dir,
            )


class DevelopmentConfig(Config):
    """Development configuration"""
    DEBUG = True
    SQLALCHEMY_ECHO = True


class ProductionConfig(Config):
    """Production configuration"""
    DEBUG = False
    SQLALCHEMY_ECHO = False


class TestingConfig(Config):
    """Testing configuration"""
    TESTING = True
    SQLALCHEMY_DATABASE_URI = 'sqlite:///:memory:'
    SQLALCHEMY_ENGINE_OPTIONS = {'pool_pre_ping': True}  # SQLite doesn't need PostgreSQL options
    WTF_CSRF_ENABLED = False


# Config dictionary
config_by_name = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'testing': TestingConfig,
    'default': DevelopmentConfig
}

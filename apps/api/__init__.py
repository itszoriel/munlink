"""
MunLink Region 3 API Package
"""
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_jwt_extended import JWTManager
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

__version__ = '1.0.0'

# Initialize extensions (will be initialized with app in create_app)
db = SQLAlchemy()
migrate = Migrate()
jwt = JWTManager()

# Initialize rate limiter (will be configured with app in create_app)
limiter = Limiter(
    key_func=get_remote_address,
    default_limits=["2000 per day", "500 per hour"],
    storage_uri="memory://",
    strategy="fixed-window"
)

__all__ = ['db', 'migrate', 'jwt', 'limiter']


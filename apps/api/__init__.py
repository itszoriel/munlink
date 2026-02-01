"""
MunLink Region 3 API Package
"""
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_jwt_extended import JWTManager

__version__ = '1.0.0'

# Initialize extensions (will be initialized with app in create_app)
db = SQLAlchemy()
migrate = Migrate()
jwt = JWTManager()

__all__ = ['db', 'migrate', 'jwt']


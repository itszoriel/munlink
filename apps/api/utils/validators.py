"""Validation utilities for input data."""
import re
from datetime import datetime

# Regex patterns
EMAIL_REGEX = re.compile(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$')
USERNAME_REGEX = re.compile(r'^[a-zA-Z0-9_]{3,30}$')
PHONE_REGEX = re.compile(r'^\+?63[0-9]{10}$|^09[0-9]{9}$')
NAME_REGEX = re.compile(r'^[a-zA-ZñÑ\s\'-]{1,50}$')

# Municipality names (Zambales only - EXACTLY 13)
ZAMBALES_MUNICIPALITIES = [
    'Botolan',
    'Cabangan',
    'Candelaria',
    'Castillejos',
    'Iba',
    'Masinloc',
    'Palauig',
    'San Antonio',
    'San Felipe',
    'San Marcelino',
    'San Narciso',
    'Santa Cruz',
    'Subic',
]

# File upload limits
MAX_FILE_SIZE_MB = 10
MAX_IMAGE_SIZE_MB = 5
ALLOWED_IMAGE_EXTENSIONS = {'jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif', 'hevc'}
ALLOWED_DOCUMENT_EXTENSIONS = {'pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png', 'heic', 'heif', 'hevc'}


class ValidationError(Exception):
    """Custom validation error."""
    def __init__(self, field, message):
        self.field = field
        self.message = message
        super().__init__(f"{field}: {message}")


def validate_email(email):
    """Validate email format."""
    if not email:
        raise ValidationError('email', 'Email is required')
    
    if not EMAIL_REGEX.match(email):
        raise ValidationError('email', 'Invalid email format')
    
    return email.lower().strip()


def validate_username(username):
    """Validate username format."""
    if not username:
        raise ValidationError('username', 'Username is required')
    
    if not USERNAME_REGEX.match(username):
        raise ValidationError('username', 'Username must be 3-30 characters, alphanumeric and underscore only')
    
    return username.lower().strip()


def validate_password(password):
    """Validate password strength."""
    if not password:
        raise ValidationError('password', 'Password is required')
    
    if len(password) < 8:
        raise ValidationError('password', 'Password must be at least 8 characters')
    
    if len(password) > 128:
        raise ValidationError('password', 'Password must be less than 128 characters')
    
    # Check for at least one uppercase, one lowercase, one number
    if not re.search(r'[A-Z]', password):
        raise ValidationError('password', 'Password must contain at least one uppercase letter')
    
    if not re.search(r'[a-z]', password):
        raise ValidationError('password', 'Password must contain at least one lowercase letter')
    
    if not re.search(r'[0-9]', password):
        raise ValidationError('password', 'Password must contain at least one number')
    
    return password


def validate_phone(phone, field_name='phone_number'):
    """Validate Philippine phone number."""
    if not phone:
        return None  # Phone is optional
    
    # Remove spaces and dashes
    phone = phone.replace(' ', '').replace('-', '')
    
    if not PHONE_REGEX.match(phone):
        raise ValidationError(field_name, 'Invalid Philippine phone number format')
    
    # Normalize to +63 format
    if phone.startswith('09'):
        phone = '+63' + phone[1:]
    elif not phone.startswith('+63'):
        phone = '+63' + phone
    
    return phone


def validate_name(name, field_name='name'):
    """Validate name fields."""
    if not name:
        raise ValidationError(field_name, f'{field_name} is required')
    
    name = name.strip()
    
    if not NAME_REGEX.match(name):
        raise ValidationError(field_name, f'Invalid {field_name} format')
    
    return name.title()


def validate_date_of_birth(dob):
    """Validate date of birth."""
    if not dob:
        raise ValidationError('date_of_birth', 'Date of birth is required')
    
    # If string, parse it
    if isinstance(dob, str):
        try:
            dob = datetime.strptime(dob, '%Y-%m-%d').date()
        except ValueError:
            raise ValidationError('date_of_birth', 'Invalid date format. Use YYYY-MM-DD')
    
    # Check if date is in the past
    if dob >= datetime.utcnow().date():
        raise ValidationError('date_of_birth', 'Date of birth must be in the past')
    
    # Check if age is reasonable (not more than 150 years old)
    age = datetime.utcnow().date().year - dob.year
    if age > 150:
        raise ValidationError('date_of_birth', 'Invalid date of birth')
    
    return dob


def validate_municipality(municipality_name):
    """Validate municipality name."""
    if not municipality_name:
        raise ValidationError('municipality', 'Municipality is required')
    
    # Normalize the name
    municipality_name = municipality_name.strip().title()
    
    if municipality_name not in ZAMBALES_MUNICIPALITIES:
        raise ValidationError('municipality', f'Invalid municipality. Must be one of the 13 Zambales municipalities')
    
    return municipality_name


def validate_file_size(file_size, max_size_mb=MAX_FILE_SIZE_MB):
    """Validate file size."""
    max_size_bytes = max_size_mb * 1024 * 1024
    
    if file_size > max_size_bytes:
        raise ValidationError('file', f'File size must not exceed {max_size_mb}MB')
    
    return True


def validate_file_extension(filename, allowed_extensions=None):
    """Validate file extension."""
    if allowed_extensions is None:
        allowed_extensions = ALLOWED_DOCUMENT_EXTENSIONS
    
    if '.' not in filename:
        raise ValidationError('file', 'File must have an extension')
    
    extension = filename.rsplit('.', 1)[1].lower()
    
    if extension not in allowed_extensions:
        raise ValidationError('file', f'File type not allowed. Allowed types: {", ".join(allowed_extensions)}')
    
    return extension


def validate_required_fields(data, required_fields):
    """Validate that all required fields are present."""
    missing_fields = []
    
    for field in required_fields:
        if field not in data or not data[field]:
            missing_fields.append(field)
    
    if missing_fields:
        raise ValidationError('required_fields', f'Missing required fields: {", ".join(missing_fields)}')
    
    return True


def sanitize_string(text, max_length=None):
    """Sanitize and clean string input."""
    if not text:
        return text
    
    # Strip whitespace
    text = text.strip()
    
    # Remove multiple spaces
    text = ' '.join(text.split())
    
    # Truncate if needed
    if max_length and len(text) > max_length:
        text = text[:max_length]
    
    return text


def validate_transaction_type(transaction_type):
    """Validate marketplace transaction type."""
    valid_types = ['donate', 'lend', 'sell']
    
    if transaction_type not in valid_types:
        raise ValidationError('transaction_type', f'Invalid transaction type. Must be one of: {", ".join(valid_types)}')
    
    return transaction_type


def validate_item_condition(condition):
    """Validate item condition."""
    valid_conditions = ['new', 'like_new', 'good', 'fair', 'poor']
    
    if condition not in valid_conditions:
        raise ValidationError('condition', f'Invalid condition. Must be one of: {", ".join(valid_conditions)}')
    
    return condition


def validate_price(price, transaction_type):
    """Validate price for sell items."""
    if transaction_type == 'sell':
        if not price or float(price) <= 0:
            raise ValidationError('price', 'Price is required for sell items and must be greater than 0')
    
    if price:
        try:
            price = float(price)
            if price < 0:
                raise ValidationError('price', 'Price cannot be negative')
            if price > 1000000:
                raise ValidationError('price', 'Price is unreasonably high')
            return price
        except (ValueError, TypeError):
            raise ValidationError('price', 'Invalid price format')
    
    return None


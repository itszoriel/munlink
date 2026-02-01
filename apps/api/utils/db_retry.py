"""
Database connection retry utilities for handling intermittent connection issues.
Particularly useful for Render free tier -> Supabase connectivity.
"""
import time
import functools
from flask import current_app, jsonify
from sqlalchemy.exc import OperationalError, InterfaceError, TimeoutError as SQLTimeoutError


# Exceptions that indicate a connection issue (should retry)
RETRIABLE_EXCEPTIONS = (
    OperationalError,
    InterfaceError, 
    SQLTimeoutError,
    ConnectionError,
    TimeoutError,
)


def with_db_retry(max_retries=3, initial_delay=1.0, backoff_factor=2.0):
    """
    Decorator that retries database operations on connection failures.
    
    Args:
        max_retries: Maximum number of retry attempts (default: 3)
        initial_delay: Initial delay between retries in seconds (default: 1.0)
        backoff_factor: Multiply delay by this factor after each retry (default: 2.0)
    
    Usage:
        @with_db_retry(max_retries=3)
        def my_route():
            # Database operations here
            return jsonify(data)
    """
    def decorator(func):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            last_exception = None
            delay = initial_delay
            
            for attempt in range(max_retries + 1):
                try:
                    return func(*args, **kwargs)
                except RETRIABLE_EXCEPTIONS as e:
                    last_exception = e
                    
                    if attempt < max_retries:
                        # Log the retry attempt
                        current_app.logger.warning(
                            f"Database connection failed (attempt {attempt + 1}/{max_retries + 1}): {str(e)[:100]}. "
                            f"Retrying in {delay:.1f}s..."
                        )
                        time.sleep(delay)
                        delay *= backoff_factor
                        
                        # Try to reset the connection
                        try:
                            from __init__ import db
                            db.session.rollback()
                            db.session.remove()
                        except Exception:
                            pass
                    else:
                        # All retries exhausted
                        current_app.logger.error(
                            f"Database connection failed after {max_retries + 1} attempts: {str(e)}"
                        )
            
            # Return error response after all retries failed
            return jsonify({
                'error': 'Database connection temporarily unavailable',
                'message': 'Please try again in a few moments',
                'details': str(last_exception)[:200] if current_app.debug else None
            }), 503
        
        return wrapper
    return decorator


def execute_with_retry(db, operation, max_retries=3, initial_delay=1.0, backoff_factor=2.0):
    """
    Execute a database operation with retry logic.
    
    Args:
        db: The SQLAlchemy db instance
        operation: A callable that performs the database operation
        max_retries: Maximum number of retry attempts
        initial_delay: Initial delay between retries in seconds
        backoff_factor: Multiply delay by this factor after each retry
    
    Returns:
        The result of the operation
        
    Raises:
        The last exception if all retries fail
        
    Usage:
        result = execute_with_retry(
            db,
            lambda: Province.query.filter_by(is_active=True).all()
        )
    """
    last_exception = None
    delay = initial_delay
    
    for attempt in range(max_retries + 1):
        try:
            return operation()
        except RETRIABLE_EXCEPTIONS as e:
            last_exception = e
            
            if attempt < max_retries:
                current_app.logger.warning(
                    f"DB operation failed (attempt {attempt + 1}/{max_retries + 1}): {str(e)[:100]}. "
                    f"Retrying in {delay:.1f}s..."
                )
                time.sleep(delay)
                delay *= backoff_factor
                
                # Try to reset the connection
                try:
                    db.session.rollback()
                    db.session.remove()
                except Exception:
                    pass
            else:
                current_app.logger.error(
                    f"DB operation failed after {max_retries + 1} attempts: {str(e)}"
                )
                raise
    
    raise last_exception


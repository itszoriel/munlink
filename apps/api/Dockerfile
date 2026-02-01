# MunLink Region 3 API - Dockerfile
FROM python:3.12-slim

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    libpq-dev \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create upload directories
RUN mkdir -p uploads/region3/marketplace/items \
    uploads/region3/profiles \
    uploads/region3/verification \
    uploads/region3/generated_docs

# Create startup script
RUN echo '#!/bin/sh' > /start.sh && \
    echo 'set -e' >> /start.sh && \
    echo 'export PYTHONPATH=$PYTHONPATH:/app' >> /start.sh && \
    echo 'echo "Starting MunLink API..."' >> /start.sh && \
    echo 'echo "Running database migrations..."' >> /start.sh && \
    echo 'flask db upgrade heads || echo "Warning: Migration failed or skipped"' >> /start.sh && \
    echo 'echo "Starting Notification Worker..."' >> /start.sh && \
    echo 'nohup python scripts/notification_worker.py > /dev/stdout 2>&1 &' >> /start.sh && \
    echo 'echo "Starting Gunicorn on port ${PORT:-5000}..."' >> /start.sh && \
    echo 'exec gunicorn app:app --bind 0.0.0.0:${PORT:-5000} --workers 2 --threads 2 --timeout 120 --max-requests 1000 --max-requests-jitter 50 --access-logfile - --error-logfile -' >> /start.sh && \
    chmod +x /start.sh

# Expose port
EXPOSE 5000

# Run startup script
CMD ["/start.sh"]

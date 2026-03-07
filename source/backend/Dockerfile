FROM python:3.11-slim

WORKDIR /app

RUN pip install --no-cache-dir fastapi pika

COPY backend/backend.py .
COPY models/ ./models

RUN touch ./models/__init__.py

CMD ["python", "backend.py"]
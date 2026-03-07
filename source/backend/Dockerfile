FROM python:3.11-slim

WORKDIR /app

RUN pip install --no-cache-dir fastapi aio-pika uvicorn websockets

COPY backend/backend.py .
COPY models/ ./models

RUN touch ./models/__init__.py

EXPOSE 8000

CMD ["uvicorn", "backend:app", "--host", "0.0.0.0", "--port", "8000"]
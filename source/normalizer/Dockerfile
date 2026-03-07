FROM python:3.11-slim

WORKDIR /app

RUN pip install --no-cache-dir pika pydantic[email]

COPY normalizer/normalizer.py .
COPY models ./models

RUN touch ./models/__init__.py

CMD ["python", "normalizer.py"]
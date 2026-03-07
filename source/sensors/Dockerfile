FROM python:3.11-slim

WORKDIR /app

RUN pip install --no-cache-dir requests pydantic[email] pika

COPY sensors/sensors.py .
COPY models ./models

RUN touch ./models/__init__.py

CMD ["python", "sensors.py"]
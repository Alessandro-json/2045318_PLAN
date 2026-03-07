FROM python:3.11-slim

WORKDIR /app

RUN pip install --no-cache-dir requests pydantic[email] websocket-client pika

COPY telemetry/telemetry.py .
COPY models/ ./models

RUN touch ./models/__init__.py

CMD ["python", "telemetry.py"]
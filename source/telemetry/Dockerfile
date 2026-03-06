FROM python:3.11-slim

WORKDIR /app

RUN pip install --no-cache-dir requests pydantic[email] websocket-client

COPY telemetry.py .

CMD ["python", "telemetry.py"]
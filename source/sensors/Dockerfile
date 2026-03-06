FROM python:3.11-slim

WORKDIR /app

RUN pip install --no-cache-dir requests pydantic[email]

COPY sensors.py .

CMD ["python", "sensors.py"]
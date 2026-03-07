FROM python:3.11-slim

WORKDIR /app

RUN pip install --no-cache-dir pydantic[email] fastapi uvicorn websockets sqlalchemy websocket-client httpx

COPY rules/manager.py .
COPY rules/database.py .
COPY models ./models

RUN touch ./models/__init__.py

RUN mkdir -p /app/data && chmod 777 /app/data

EXPOSE 8000

CMD ["uvicorn", "manager:app", "--host", "0.0.0.0", "--port", "9000"]
FROM python:3.11-slim

WORKDIR /app

RUN pip install --no-cache-dir pydantic[email] fastapi uvicorn websockets sqlalchemy websocket-client

COPY manager/manager.py .
COPY models ./models

RUN touch ./models/__init__.py

EXPOSE 8000

CMD ["uvicorn", "manager:app", "--host", "0.0.0.0", "--port", "9000"]
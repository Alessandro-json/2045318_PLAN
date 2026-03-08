import os
import asyncio

from models.models import NormalizedData
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from aio_pika import connect_robust, ExchangeType
from websockets.exceptions import ConnectionClosedOK


RABBIT_HOST = os.getenv('RABBIT_HOST', 'localhost')
EXCHANGE_NAME = os.getenv('NORMALIZED_DATA_EXCHANGE', 'normalized_data')

app = FastAPI()


class ConnectionManager:
    def __init__(self):
        self.connections = []

    async def connect(self, websocket):
        await websocket.accept()
        self.connections.append(websocket)

    def disconnect(self, websocket):
        self.connections.remove(websocket)

    async def broadcast(self, message):
        for connection in self.connections[:]:
            try:
                await connection.send_text(message)
            except (WebSocketDisconnect, ConnectionClosedOK, RuntimeError):
                self.connections.remove(connection)


manager = ConnectionManager()


@app.on_event('startup')
async def startup_event():
    asyncio.create_task(_rabbitmq_consumer())


@app.websocket('/ws/dashboard')
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)


async def _rabbitmq_consumer():
    connection = await connect_robust(f'amqp://guest:guest@{RABBIT_HOST}/')

    try:
        async with connection:
            channel = await connection.channel()
            await channel.declare_exchange(EXCHANGE_NAME, ExchangeType.TOPIC)

            queue = await channel.declare_queue(exclusive=True)
            await queue.bind(exchange=EXCHANGE_NAME, routing_key='data.#')

            async with queue.iterator() as queue_iter:
                async for message in queue_iter:
                    async with message.process():
                        payload = message.body.decode()
                        await manager.broadcast(payload)
    except Exception as e:
        print(f'error: rabbitmq consumer encountered an error: {e}')

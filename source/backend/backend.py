import os
import asyncio

from models.models import NormalizedData
from fastapi import FastAPI, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from aio_pika import connect_robust, ExchangeType


RABBIT_HOST = os.getenv('RABBIT_HOST', 'localhost')
EXCHANGE_NAME = os.getenv('NORMALIZED_DATA_EXCHANGE', 'normalized_data')

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ConnectionManager:
    def __init__(self):
        self.connections = []

    async def connect(self, websocket):
        await websocket.accept()
        self.connections.append(websocket)

    def disconnect(self, websocket):
        self.connections.remove(websocket)

    async def broadcast(self, message):
        for connection in self.connections:
            await connection.send_text(message)


manager = ConnectionManager()


@app.on_event('startup')
async def startup_event():
    asyncio.create_task(_rabbitmq_consumer())


@app.websocket('/ws/dashboard')
async def websocket_endpoint(websocket):
    await manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)


async def _rabbitmq_consumer():
    connection = await connect_robust(f'amqp://guest:guest@{RABBIT_HOST}/')

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


# def _on_message(channel, method, properties, body):
#     print(body)


# def _setup_rabbitmq():
#     parameters = pika.ConnectionParameters(host=RABBIT_HOST)

#     for attempt in range(1, 11):
#         try:
#             connection = pika.BlockingConnection(parameters)

            # channel = connection.channel()
            # channel.exchange_declare(
            #     exchange=EXCHANGE_NAME,
            #     exchange_type='topic',
            # )

            # result = channel.queue_declare(queue='', exclusive=True)
            # queue_name = result.method.queue

            # channel.queue_bind(
            #     exchange=EXCHANGE_NAME,
            #     queue=queue_name,
            #     routing_key='data.#',
            # )

            # print(' [*] Backend waiting for data... Press CTRL+C to exit')

            # channel.basic_consume(
            #     queue=queue_name,
            #     on_message_callback=_on_message,
            #     auto_ack=True
            # )

            # channel.start_consuming()

    #         return connection
    #     except pika.exceptions.AMQPConnectionError as e:
    #         print(f'error: failed to connect to rabbitmq: {e}. Retrying in 5s...')  # noqa: E501
    #         time.sleep(5)

    # raise SystemExit('fatal error: failed to connect to rabbitmq...')


# def main():
    # try:
    #     _setup_rabbitmq()
    # except KeyboardInterrupt:
    #     print('Stopping backend...')


# if __name__ == '__main__':
#     raise SystemExit(main())

import os
import websocket
import json
import threading
import time
import pika

from pydantic import BaseModel
from typing import List, Literal
from datetime import datetime
from functools import partial
from models.models import PowerResponse, EnvironmentResponse, ThermalLoopResponse, AirlockResponse  # noqa: E501

# websocket.enableTrace(True)

ENDPOINT = os.getenv('TELEMETRY_ENDPOINT', 'ws://host.docker.internal:8080/api/telemetry/ws')  # noqa: E501
POLLING_RATE = 3

RABBIT_HOST = os.getenv('RABBIT_HOST', 'localhost')
EXCHANGE_NAME = os.getenv('UNORMALIZED_DATA_EXCHANGE', 'unormalized_data')

TOPICS = [
    ('solar_array', 'power'),
    ('power_bus', 'power'),
    ('power_consumption', 'power'),
    ('radiation', 'environment'),
    ('life_support', 'environment'),
    ('thermal_loop', 'thermal_loop'),
    ('airlock', 'airlock'),
]


class TelemetrySubscriber:
    def __init__(self, topic, base_url, on_message):
        # self.connection = connection
        self.topic = topic
        self.url = f'{base_url}?topic=mars/telemetry/{topic}'
        self.on_message = on_message

    def on_error(self, ws, error):
        print(f'error: {error}')

    def on_close(self, ws, close_status_code, close_message):
        print(f'connection closed ({close_message}, {close_status_code}), retrying in 5s...')  # noqa: E501

    def run(self):
        while True:
            try:
                params = pika.ConnectionParameters(RABBIT_HOST, heartbeat=600)
                connection = pika.BlockingConnection(params)
                channel = connection.channel()

                channel.exchange_declare(
                    exchange=EXCHANGE_NAME,
                    exchange_type='topic',
                )

                wrapped_callback = partial(
                    self.on_message,
                    channel=channel
                )

                self.ws = websocket.WebSocketApp(
                    self.url,
                    on_message=wrapped_callback,
                    on_error=self.on_error,
                    on_close=self.on_close,
                )
                self.ws.run_forever(reconnect=5)
            except Exception as e:
                print(f"Thread for {self.topic} failed to connect: {e}. Retrying...", flush=True)  # noqa: E501
                time.sleep(5)


def power_on_message(ws, message, channel):
    json_response = json.loads(message)
    power_response = PowerResponse(**json_response)

    _publish_to_queue(
        channel,
        'power',
        power_response.subsystem,
        power_response,
    )


def environment_on_message(ws, message, channel):
    json_response = json.loads(message)
    environment_response = EnvironmentResponse(**json_response)

    _publish_to_queue(
        channel,
        'environment',
        environment_response.source.system,
        environment_response,
    )


def thermal_loop_on_message(ws, message, channel):
    json_response = json.loads(message)
    thermal_loop_response = ThermalLoopResponse(**json_response)

    _publish_to_queue(
        channel,
        'thermal_loop',
        thermal_loop_response.loop,
        thermal_loop_response,
    )


def airlock_on_message(ws, message, channel):
    json_response = json.loads(message)
    airlock_response = AirlockResponse(**json_response)

    _publish_to_queue(
        channel,
        'airlock',
        airlock_response.airlock_id,
        airlock_response,
    )


def _callback_from_type(type):
    if type == 'power':
        return power_on_message
    elif type == 'environment':
        return environment_on_message
    elif type == 'thermal_loop':
        return thermal_loop_on_message
    elif type == 'airlock':
        return airlock_on_message


def _setup_rabbitmq():
    parameters = pika.ConnectionParameters(host=RABBIT_HOST)

    for attempt in range(1, 11):
        try:
            return pika.BlockingConnection(parameters)
        except pika.exceptions.AMQPConnectionError as e:
            print(f'error: failed to connect to rabbitmq: {e}. Retrying in 5s...')  # noqa: E501
            time.sleep(5)

    raise SystemExit('fatal error: failed to connect to rabbitmq...')


def _publish_to_queue(channel, schema_type, sensor_id, data):
    routing_key = f"telemetry.{schema_type}.{sensor_id}"
    channel.basic_publish(
        exchange=EXCHANGE_NAME,
        routing_key=routing_key,
        body=data.model_dump_json()
    )


def main():
    # connection = _setup_rabbitmq()

    for topic, type in TOPICS:
        subscriber = TelemetrySubscriber(
            # connection,
            topic,
            ENDPOINT,
            _callback_from_type(type),
        )

        thread = threading.Thread(target=subscriber.run, daemon=True)
        thread.start()
        print(f'Started background thread for topic {topic}...')

    try:
        while True:
            time.sleep(POLLING_RATE)
    except KeyboardInterrupt:
        print('Stopping all listeners...')


if __name__ == '__main__':
    raise SystemExit(main())

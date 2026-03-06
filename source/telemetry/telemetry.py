import os
import websocket
import json
import threading
import time

from pydantic import BaseModel
from typing import List, Literal
from datetime import datetime


# websocket.enableTrace(True)

ENDPOINT = os.getenv('TELEMETRY_ENDPOINT', 'ws://host.docker.internal:8080/api/telemetry/ws')  # noqa: E501
POLLING_RATE = 3

TOPICS = [
    ('solar_array', 'power'),
    ('power_bus', 'power'),
    ('power_consumption', 'power'),
    ('radiation', 'environment'),
    ('life_support', 'environment'),
    ('thermal_loop', 'thermal_loop'),
    ('airlock', 'airlock'),
]


class Measurement(BaseModel):
    metric: str
    value: float
    unit: str


class PowerResponse(BaseModel):
    topic: str
    event_time: datetime
    subsystem: str
    power_kw: float
    voltage_v: float
    current_a: float
    cumulative_kwh: float


class Properties(BaseModel):
    system: str
    segment: str


class EnvironmentResponse(BaseModel):
    topic: str
    event_time: datetime
    source: Properties
    measurements: List[Measurement]
    status: Literal['ok', 'warning']


class ThermalLoopResponse(BaseModel):
    topic: str
    event_time: datetime
    loop: str
    temperature_c: float
    flow_l_min: float
    status: Literal['ok', 'warning']


class AirlockResponse(BaseModel):
    topic: str
    event_time: datetime
    airlock_id: str
    cycles_per_hour: float
    last_state: Literal['IDLE', 'PRESSURIZING', 'DEPRESSURIZING']


class TelemetrySubscriber:
    def __init__(self, topic, base_url, on_message):
        self.topic = topic
        self.url = f'{base_url}?topic=mars/telemetry/{topic}'
        print(self.url)
        # self.url = f'{base_url}?topic={topic}'
        self.ws = websocket.WebSocketApp(
            self.url,
            on_message=on_message,
            on_error=self.on_error,
            on_close=self.on_close,
        )

    def on_error(self, ws, error):
        print(f'error: {error}')

    def on_close(self, ws, close_status_code, close_message):
        print(f'connection closed ({close_message}, {close_status_code}), retrying in 5s...')  # noqa: E501

    def run(self):
        self.ws.run_forever(reconnect=5)


def power_on_message(ws, message):
    json_response = json.loads(message)
    power_response = PowerResponse(**json_response)
    print(power_response, flush=True)


def environment_on_message(ws, message):
    json_response = json.loads(message)
    environment_response = EnvironmentResponse(**json_response)
    print(environment_response, flush=True)


def thermal_loop_on_message(ws, message):
    json_response = json.loads(message)
    thermal_loop_response = ThermalLoopResponse(**json_response)
    print(thermal_loop_response, flush=True)


def airlock_on_message(ws, message):
    json_response = json.loads(message)
    airlock_response = AirlockResponse(**json_response)
    print(airlock_response, flush=True)


def _callback_from_type(type):
    if type == 'power':
        return power_on_message
    elif type == 'environment':
        return environment_on_message
    elif type == 'thermal_loop':
        return thermal_loop_on_message
    elif type == 'airlock':
        return airlock_on_message


def main():
    for topic, type in TOPICS:
        subscriber = TelemetrySubscriber(
            topic,
            ENDPOINT,
            _callback_from_type(type)
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

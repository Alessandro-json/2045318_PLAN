import os
import websocket
import json

from pydantic import BaseModel
from typing import List, Literal
from datetime import datetime

ENDPOINT = os.getenv('TELEMETRY_ENDPOINT', 'http://host.docker.internal:8080/api/telemetry/ws')  # noqa: E501
POLLING_RATE = 5

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
    source: List[Properties]
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
    last_state: Literal['idle', 'pressurizing', 'depressurizing']


class TelemetrySubscriber:
    def __init__(self, topic, base_url, on_message):
        self.topic = topic,
        self.url = f'{base_url}?topic=mars/telemetry/{topic}'
        print(self.url)
        # self.url = f'{base_url}?topic={topic}'
        self.ws = websocket.WebSocketApp(
            self.url,
            on_message=on_message,
            on_error=self.on_error,
            on_close=self.on_close,
        )

    def on_error(ws, error):
        print(f'error: {error}')

    def on_close(ws, close_status_code, close_message):
        print(f'connection closed ({close_message}, {close_status_code}), retrying in 5s...')  # noqa: E501

    def run(self):
        self.ws.run_forever(reconnect=5)


def power_on_message(ws, message):
    power_response = PowerResponse(**message)
    print(power_response)


def environment_on_message(ws, message):
    environment_response = EnvironmentResponse(**message)
    print(environment_response)


def thermal_loop_on_message(ws, message):
    thermal_loop_response = ThermalLoopResponse(**message)
    print(thermal_loop_response)


def airlock_on_message(ws, message):
    airlock_response = AirlockResponse(**message)
    print(airlock_response)


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
    subscribers = []
    for topic, type in TOPICS:
        subscribers.append(TelemetrySubscriber(
            topic,
            ENDPOINT,
            _callback_from_type(type)
        ))

    for subscriber in subscribers:
        subscriber.run()


if __name__ == '__main__':
    raise SystemExit(main())

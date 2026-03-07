import os
import pika
import json
import time

from pydantic import ValidationError, BaseModel
from datetime import datetime
from models.models import ScalarResponse, ChemistryResponse, ParticulateResponse, \
    LevelResponse, PowerResponse, EnvironmentResponse, ThermalLoopResponse, \
    AirlockResponse, NormalizedData
from typing import Literal


RABBIT_HOST = os.getenv('RABBIT_HOST', 'localhost')
EXCHANGE_NAME = os.getenv('UNORMALIZED_DATA_EXCHANGE', 'unormalized_data')


MODEL_MAP = {
    'scalar': ScalarResponse,
    'chemistry': ChemistryResponse,
    'particulate': ParticulateResponse,
    'level': LevelResponse,
    'power': PowerResponse,
    'environment': EnvironmentResponse,
    'thermal_loop': ThermalLoopResponse,
    'airlock': AirlockResponse,
}


def _normalize_data(model):
    normalized = []

    if isinstance(model, ScalarResponse):
        normalized.append(NormalizedData(
            id=model.sensor_id,
            timestamp=model.captured_at,
            source=model.sensor_id,
            metric=model.metric,
            unit=model.unit,
            value=model.value,
            status=model.status
        ))
    elif isinstance(model, ChemistryResponse):
        for measurement in model.measurements:
            normalized.append(NormalizedData(
                id=model.sensor_id,
                timestamp=model.captured_at,
                source=model.sensor_id,
                metric=measurement.metric,
                unit=measurement.unit,
                value=measurement.value,
                status=model.status
            ))
    elif isinstance(model, ParticulateResponse):
        normalized.append(NormalizedData(
                id=model.sensor_id,
                timestamp=model.captured_at,
                source=model.sensor_id,
                metric='pm1',
                unit='ug_m3',
                value=model.pm1_ug_m3,
                status=model.status
            )
        )

        normalized.append(NormalizedData(
                id=model.sensor_id,
                timestamp=model.captured_at,
                source=model.sensor_id,
                metric='pm25',
                unit='ug_m3',
                value=model.pm25_ug_m3,
                status=model.status
            )
        )

        normalized.append(NormalizedData(
                id=model.sensor_id,
                timestamp=model.captured_at,
                source=model.sensor_id,
                metric='pm10',
                unit='ug_m3',
                value=model.pm10_ug_m3,
                status=model.status
            )
        )
    elif isinstance(model, LevelResponse):
        normalized.append(NormalizedData(
                id=model.sensor_id,
                timestamp=model.captured_at,
                source=model.sensor_id,
                metric='pct',
                unit='%',
                value=model.level_pct,
                status=model.status
            )
        )

        normalized.append(NormalizedData(
                id=model.sensor_id,
                timestamp=model.captured_at,
                source=model.sensor_id,
                metric='liters',
                unit='l',
                value=model.level_liters,
                status=model.status
            )
        )
    elif isinstance(model, PowerResponse):
        normalized.append(NormalizedData(
            id=model.topic,
            timestamp=model.event_time,
            source=model.subsystem,
            metric='power',
            unit='kw',
            value=model.power_kw,
            status='ok',
        ))

        normalized.append(NormalizedData(
            id=model.topic,
            timestamp=model.event_time,
            source=model.subsystem,
            metric='voltage',
            unit='v',
            value=model.voltage_v,
            status='ok',
        ))

        normalized.append(NormalizedData(
            id=model.topic,
            timestamp=model.event_time,
            source=model.subsystem,
            metric='current',
            unit='a',
            value=model.current_a,
            status='ok',
        ))

        normalized.append(NormalizedData(
            id=model.topic,
            timestamp=model.event_time,
            source=model.subsystem,
            metric='consumption',
            unit='kwh',
            value=model.cumulative_kwh,
            status='ok',
        ))
    elif isinstance(model, EnvironmentResponse):
        for measurement in model.measurements:
            normalized.append(NormalizedData(
                id=model.topic,
                timestamp=model.event_time,
                source=f'{model.source.system}.{model.source.segment}',
                metric=measurement.metric,
                unit=measurement.unit,
                value=measurement.value,
                status=model.status,
            ))
    elif isinstance(model, ThermalLoopResponse):
        normalized.append(NormalizedData(
            id=model.topic,
            timestamp=model.event_time,
            source=model.loop,
            metric='temperature',
            unit='c',
            value=model.temperature_c,
            status=model.status,
        ))
        normalized.append(NormalizedData(
            id=model.topic,
            timestamp=model.event_time,
            source=model.loop,
            metric='flow',
            unit='l/min',
            value=model.flow_l_min,
            status=model.status,
        ))
    elif isinstance(model, AirlockResponse):
        normalized.append(NormalizedData(
            id=model.topic,
            timestamp=model.event_time,
            source=model.airlock_id,
            metric='cycles_per_hour',
            unit='cycles/hour',
            value=model.cycles_per_hour,
            status=model.status,
        ))
    else:
        print('error: unrecognized model type')

    return normalized


def _on_message(channel, method, properties, body):
    routing_key = method.routing_key
    routing_key_parts = routing_key.split('.')

    if len(routing_key_parts) < 2:
        print(f'error: received malformed routing key: {routing_key}')
        return

    schema_type = routing_key_parts[1]
    try:
        data = json.loads(body)
        model = MODEL_MAP.get(schema_type)

        if not model:
            print(f'error: model mapping not found for {schema_type}')
            return

        normalized = _normalize_data(model(**data))
        if len(normalized) >= 1:
            print(normalized)

        # TODO: push to backend exchange with RabbitMQ

    except json.JSONDecodeError:
        print('error: failed to decode JSON')
    except ValidationError as e:
        print(f'error: failed to validate {schema_type}: {e}')


def _setup_rabbitmq():
    parameters = pika.ConnectionParameters(host=RABBIT_HOST)

    for attempt in range(1, 11):
        try:
            connection = pika.BlockingConnection(parameters)

            channel = connection.channel()
            channel.exchange_declare(
                exchange=EXCHANGE_NAME,
                exchange_type='topic',
            )

            result = channel.queue_declare(queue='', exclusive=True)
            queue_name = result.method.queue

            channel.queue_bind(
                exchange=EXCHANGE_NAME,
                queue=queue_name,
                routing_key='sensor.#',
            )

            print(' [*] Normalizer waiting for data... Press CTRL+C to exit')

            channel.basic_consume(
                queue=queue_name,
                on_message_callback=_on_message,
                auto_ack=True
            )

            channel.start_consuming()

            return channel
        except pika.exceptions.AMQPConnectionError as e:
            print(f'error: failed to connect to rabbitmq: {e}. Retrying in 5s...')  # noqa: E501
            time.sleep(5)

    raise SystemExit('fatal error: failed to connect to rabbitmq...')


def main():
    try:
        _setup_rabbitmq()
    except KeyboardInterrupt:
        print('Stopping normalizer...')


if __name__ == '__main__':
    raise SystemExit(main())

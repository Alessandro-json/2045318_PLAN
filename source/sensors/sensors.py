import os
import requests
import time
import json
import pika
from models.models import ScalarResponse, ChemistryResponse, ParticulateResponse, LevelResponse  # noqa: E501

from datetime import datetime
from typing import List, Literal
from pydantic import BaseModel, Field


ENDPOINT = os.getenv('SENSORS_ENDPOINT', 'http://host.docker.internal:8080/api/sensors')  # noqa: E501
POLLING_RATE = 0.1

RABBIT_HOST = os.getenv('RABBIT_HOST', 'localhost')
EXCHANGE_NAME = os.getenv('UNORMALIZED_DATA_EXCHANGE', 'unormalized_data')

SENSORS = [
    ('greenhouse_temperature', 'scalar'),
    ('entrance_humidity', 'scalar'),
    ('co2_hall', 'scalar'),
    ('hydroponic_ph', 'chemistry'),
    ('water_tank_level', 'level'),
    ('corridor_pressure', 'scalar'),
    ('air_quality_pm25', 'particulate'),
    ('air_quality_voc', 'chemistry'),
]


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

            return channel
        except pika.exceptions.AMQPConnectionError as e:
            print(f'error: failed to connect to rabbitmq: {e}. Retrying in 5s...')  # noqa: E501
            time.sleep(5)

    raise SystemExit('fatal error: failed to connect to rabbitmq...')


def _publish_to_queue(channel, schema_type, sensor_id, data):
    routing_key = f"data.{schema_type}.{sensor_id}"
    channel.basic_publish(
        exchange=EXCHANGE_NAME,
        routing_key=routing_key,
        body=data.model_dump_json()
    )


def main():
    channel = _setup_rabbitmq()

    start_time = time.time()
    while True:
        try:

            for (sensor, type) in SENSORS:
                response = requests.get(f'{ENDPOINT}/{sensor}', timeout=0.05)
                data = response.json()

                obj = None
                if type == 'scalar':
                    obj = ScalarResponse(**data)
                    # print(scalar_response)
                elif type == 'chemistry':
                    obj = ChemistryResponse(**data)
                    # print(chemistry_response)
                elif type == 'particulate':
                    obj = ParticulateResponse(**data)
                    # print(particulate_response)
                elif type == 'level':
                    obj = LevelResponse(**data)
                    # print(level_response)
                else:
                    print(f'error: unrecognized schema {type}')
                    continue

                if obj is not None:
                    _publish_to_queue(channel, type, sensor, obj)

            print(response.json())
        except Exception as e:
            print(f'error: {e}')

        elapsed = time.time() - start_time
        time.sleep(max(0, POLLING_RATE - elapsed))


if __name__ == '__main__':
    raise SystemExit(main())

import os
import requests
import time
import json

from datetime import datetime
from typing import List, Literal
from pydantic import BaseModel, Field


ENDPOINT = os.getenv('SENSORS_ENDPOINT', 'http://host.docker.internal:8080/api/sensors')  # noqa: E501
POLLING_RATE = 0.1

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


class ScalarResponse(BaseModel):
    sensor_id: str
    captured_at: datetime
    metric: str
    value: float
    unit: str
    status: Literal['ok', 'warning']


class Measurement(BaseModel):
    metric: str
    value: float
    unit: str


class ChemistryResponse(BaseModel):
    sensor_id: str
    captured_at: datetime
    measurements: List[Measurement]
    status: Literal['ok', 'warning']


class ParticulateResponse(BaseModel):
    sensor_id: str
    captured_at: datetime
    pm1_ug_m3: float
    pm25_ug_m3: float
    pm10_ug_m3: float
    status: Literal['ok', 'warning']


class LevelResponse(BaseModel):
    sensor_id: str
    captured_at: datetime
    level_pct: float
    level_liters: float
    status: Literal['ok', 'warning']


def main():
    start_time = time.time()
    while True:
        try:

            for (sensor, type) in SENSORS:
                response = requests.get(f'{ENDPOINT}/{sensor}', timeout=0.05)
                response = response.json()

                if type == 'scalar':
                    scalar_response = ScalarResponse(**response)
                    print(scalar_response)
                elif type == 'chemistry':
                    chemistry_response = ChemistryResponse(**response)
                    print(chemistry_response)
                elif type == 'particulate':
                    particulate_response = ParticulateResponse(**response)
                    print(particulate_response)
                elif type == 'level':
                    level_response = LevelResponse(**response)
                    print(level_response)
                else:
                    print(f'error: unrecognized schema {type}')

            print(response.json())
        except Exception as e:
            print(f'error: {e}')

        elapsed = time.time() - start_time
        time.sleep(max(0, POLLING_RATE - elapsed))


if __name__ == '__main__':
    raise SystemExit(main())

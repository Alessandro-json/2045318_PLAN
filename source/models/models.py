from pydantic import BaseModel
from datetime import datetime
from typing import List, Literal


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


class NormalizedData(BaseModel):
    id: str
    timestamp: datetime
    source: str
    metric: str
    unit: str
    value: float
    status: Literal['ok', 'warning', 'DEPRESSURIZING', 'IDLE', 'PRESSURIZING']
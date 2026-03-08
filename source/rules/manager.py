import uuid
import websockets
import asyncio
import json
import operator
import httpx
import os

from database import engine, SessionLocal, Base
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import Column, String, Float, Boolean, inspect, text
from pydantic import BaseModel, Field
from typing import Literal, Optional

Base.metadata.create_all(bind=engine)

app = FastAPI()

origins = [
    "http://localhost:3000",
    "http://localhost:9000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

cached_rules = []
DEFAULT_TRIGGER_STATE = os.getenv("RULE_TRIGGER_STATE", "ON").upper()

OPS = {
    '>': operator.gt,
    '>=': operator.ge,
    '<': operator.lt,
    '<=': operator.le,
    '==': operator.eq
}


class RulesTable(Base):
    __tablename__ = 'rules'

    id = Column(String, primary_key=True, index=True)
    sensor_id = Column(String, index=True)
    sensor_metric = Column(String, nullable=True)
    condition = Column(String)
    threshold = Column(Float)
    actuator_id = Column(String)
    name = Column(String, default="Unnamed Rule")
    action = Column(String, default="ON")
    is_active = Column(Boolean, default=True)


class Rule(BaseModel):
    name: str = Field(min_length=1)
    sensor_id: str
    sensor_metric: Optional[str] = None
    condition: Literal['>', '>=', '<', '<=', '==']
    threshold: float
    actuator_id: str
    action: Literal['ON', 'OFF']


class RuleCreate(Rule):
    pass


class RuleResponse(Rule):
    id: str
    is_active: bool

    class Config:
        from_attributes = True


def ensure_rules_schema_columns():
    inspector = inspect(engine)
    existing_columns = {
        column["name"]
        for column in inspector.get_columns("rules")
    }

    statements = []
    if "name" not in existing_columns:
        statements.append(
            "ALTER TABLE rules ADD COLUMN name VARCHAR DEFAULT 'Unnamed Rule'"
        )
    if "action" not in existing_columns:
        statements.append(
            "ALTER TABLE rules ADD COLUMN action VARCHAR DEFAULT 'ON'"
        )
    if "sensor_metric" not in existing_columns:
        statements.append(
            "ALTER TABLE rules ADD COLUMN sensor_metric VARCHAR"
        )

    has_name_column = "name" in existing_columns or (
        "ALTER TABLE rules ADD COLUMN name VARCHAR DEFAULT 'Unnamed Rule'"
        in statements
    )
    has_action_column = "action" in existing_columns or (
        "ALTER TABLE rules ADD COLUMN action VARCHAR DEFAULT 'ON'"
        in statements
    )

    with engine.begin() as connection:
        for statement in statements:
            connection.execute(text(statement))

        if has_name_column:
            connection.execute(
                text(
                    "UPDATE rules SET name = 'Unnamed Rule' "
                    "WHERE name IS NULL OR TRIM(name) = ''"
                )
            )

        if has_action_column:
            connection.execute(
                text(
                    "UPDATE rules SET action = 'ON' "
                    "WHERE action IS NULL "
                    "OR UPPER(action) NOT IN ('ON', 'OFF')"
                )
            )


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@app.post("/api/rules", response_model=RuleResponse)
async def create_rule(rule: RuleCreate, db: Session = Depends(get_db)):
    payload = rule.dict()
    payload["name"] = payload["name"].strip()
    payload["action"] = payload["action"].upper()
    payload["sensor_metric"] = (
        payload["sensor_metric"].strip()
        if payload.get("sensor_metric")
        else None
    )

    db_rule = RulesTable(
        id=str(uuid.uuid4()),
        **payload
    )
    db.add(db_rule)
    db.commit()
    db.refresh(db_rule)

    await refresh_rule_cache()
    return db_rule


@app.get("/api/rules")
def list_rules(db: Session = Depends(get_db)):
    return db \
        .query(RulesTable) \
        .all()


@app.delete("/api/rules")
async def delete_all_rules(db: Session = Depends(get_db)):
    db.query(RulesTable).delete()
    db.commit()

    await refresh_rule_cache()
    return {"message": "All rules deleted"}


@app.patch("/api/rules/enable-all")
async def enable_all_rules(db: Session = Depends(get_db)):
    db.query(RulesTable).update({"is_active": True})
    db.commit()

    await refresh_rule_cache()
    return {"message": "All rules enabled"}


@app.patch("/api/rules/disable-all")
async def disable_all_rules(db: Session = Depends(get_db)):
    db.query(RulesTable).update({"is_active": False})
    db.commit()

    await refresh_rule_cache()
    return {"message": "All rules disabled"}


@app.delete("/api/rules/{rule_id}")
async def delete_rule(rule_id: str, db: Session = Depends(get_db)):
    db \
        .query(RulesTable) \
        .filter(RulesTable.id == rule_id) \
        .delete()

    db.commit()

    await refresh_rule_cache()
    return {"message": "Rule deleted"}


@app.patch("/api/rules/{rule_id}", response_model=RuleResponse)
async def update_rule(rule_id: str, rule: Rule, db: Session = Depends(get_db)):
    db_rule = db.query(RulesTable).filter(RulesTable.id == rule_id).first()

    if not db_rule:
        raise HTTPException(status_code=404, detail="Rule not found")

    db_rule.name = rule.name.strip()
    db_rule.sensor_id = rule.sensor_id
    db_rule.sensor_metric = (
        rule.sensor_metric.strip()
        if rule.sensor_metric
        else None
    )
    db_rule.condition = rule.condition
    db_rule.threshold = rule.threshold
    db_rule.actuator_id = rule.actuator_id
    db_rule.action = rule.action.upper()

    db.commit()
    db.refresh(db_rule)

    await refresh_rule_cache()
    return db_rule


@app.put("/api/rules/{rule_id}", response_model=RuleResponse)
async def update_rule_put(rule_id: str, rule: Rule, db: Session = Depends(get_db)):  # noqa: E501
    db_rule = db.query(RulesTable).filter(RulesTable.id == rule_id).first()

    if not db_rule:
        raise HTTPException(status_code=404, detail="Rule not found")

    db_rule.name = rule.name.strip()
    db_rule.sensor_id = rule.sensor_id
    db_rule.sensor_metric = (
        rule.sensor_metric.strip()
        if rule.sensor_metric
        else None
    )
    db_rule.condition = rule.condition
    db_rule.threshold = rule.threshold
    db_rule.actuator_id = rule.actuator_id
    db_rule.action = rule.action.upper()

    db.commit()
    db.refresh(db_rule)

    await refresh_rule_cache()
    return db_rule


async def refresh_rule_cache():
    global cached_rules
    db = SessionLocal()
    try:
        cached_rules = db.query(RulesTable) \
            .filter(RulesTable.is_active.is_(True)) \
            .all()
        # print(f"Cache refreshed: {len(cached_rules)} active rules loaded.")
    finally:
        db.close()


@app.patch("/api/rules/{rule_id}/toggle", response_model=RuleResponse)
async def toggle_rule(rule_id: str, db: Session = Depends(get_db)):
    db_rule = db.query(RulesTable).filter(RulesTable.id == rule_id).first()

    if not db_rule:
        raise HTTPException(status_code=404, detail="Rule not found")

    db_rule.is_active = not db_rule.is_active

    db.commit()
    db.refresh(db_rule)

    await refresh_rule_cache()

    return db_rule


async def evaluate_and_trigger(data: dict, active_rules: list):
    sensor_id = data.get("id")
    sensor_metric = data.get("metric")
    raw_value = data.get("value")

    if sensor_id is None or raw_value is None:
        return

    try:
        value = float(raw_value)
    except (TypeError, ValueError):
        return

    for rule in active_rules:
        if rule.sensor_id != sensor_id:
            continue

        rule_metric = (rule.sensor_metric or "").strip()
        if rule_metric and rule_metric != sensor_metric:
            continue

        op_func = OPS.get(rule.condition)
        if op_func and op_func(value, rule.threshold):
            await trigger_actuator(rule.actuator_id, rule.action)
            # print(
            #     f"Rule Matched: {sensor_id}/{sensor_metric} "
            #     f"{rule.condition} {rule.threshold}"
            # )


async def trigger_actuator(
    actuator_id: str,
    state: str = DEFAULT_TRIGGER_STATE
):
    url = f"http://oci-container:8080/api/actuators/{actuator_id}"
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(url, json={"state": state})
            if response.status_code >= 400:
                print(
                    f"Failed to trigger actuator {actuator_id}: "
                    f"{response.status_code} {response.text}"
                )
    except Exception as e:
        print(f"Failed to trigger actuator: {e}")


@app.on_event("startup")
async def startup_event():
    Base.metadata.create_all(bind=engine)
    ensure_rules_schema_columns()

    await refresh_rule_cache()
    asyncio.create_task(telemetry_listener())


async def telemetry_listener():
    uri = "ws://backend:8000/ws/dashboard"
    while True:
        try:
            async with websockets.connect(uri) as websocket:
                print("Connected to telemetry stream.")
                while True:
                    message = await websocket.recv()
                    data = json.loads(message)

                    asyncio.create_task(
                        evaluate_and_trigger(data, cached_rules)
                    )
        except Exception as e:
            print(f"Listener error: {e}. Retrying in 5s...")
            await asyncio.sleep(5)

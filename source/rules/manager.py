import uuid
import websockets
import asyncio
import json
import operator
import httpx

from database import engine, SessionLocal, Base
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import Column, String, Float, Boolean
from pydantic import BaseModel
from typing import Literal

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

cached_active_rules = []

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
    condition = Column(String)
    threshold = Column(Float)
    actuator_id = Column(String)
    is_active = Column(Boolean, default=True)


class Rule(BaseModel):
    sensor_id: str
    condition: Literal['>', '>=', '<', '<=', '==']
    threshold: float
    actuator_id: str


class RuleCreate(Rule):
    pass


class RuleResponse(Rule):
    id: str
    is_active: bool

    class Config:
        from_attributes = True


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@app.post("/api/rules", response_model=RuleResponse)
async def create_rule(rule: RuleCreate, db: Session = Depends(get_db)):
    db_rule = RulesTable(
        id=str(uuid.uuid4()),
        **rule.dict()
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


@app.delete("/api/rules/{rule_id}")
async def delete_rule(rule_id: str, db: Session = Depends(get_db)):
    db \
        .query(RulesTable) \
        .filter(RulesTable.id == rule_id) \
        .delete()

    db.commit()

    await refresh_rule_cache()
    return {"message": "Rule deleted"}


async def refresh_rule_cache():
    global cached_rules
    db = SessionLocal()
    try:
        cached_rules = db.query(RulesTable) \
            .filter(RulesTable.is_active is True) \
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
    value = data.get("value")

    for rule in active_rules:
        if rule.sensor_id == sensor_id:
            op_func = OPS.get(rule.condition)
            if op_func and op_func(value, rule.threshold):
                await trigger_actuator(rule.actuator_id, rule.action)
                # print(f"Rule Matched: {sensor_id} {rule.condition} {rule.threshold}")


async def trigger_actuator(actuator_id: str, action: str):
    url = f"http://oci-container:8080/api/actuators/{actuator_id}"
    try:
        async with httpx.AsyncClient() as client:
            await client.post(url, json={"command": action})
    except Exception as e:
        print(f"Failed to trigger actuator: {e}")


@app.on_event("startup")
async def startup_event():
    Base.metadata.create_all(bind=engine)

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

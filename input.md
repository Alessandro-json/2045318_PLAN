# PLAN

## System overview

PLAN(ET) is the official dashboard for the latest SpaceY Mars exploration mission.
It displays data gathered by sensors onboard the spaceship, with the ultimate goal
of easing the workload of the explorer in regards to monitoring the healthiness
of the habitat.

The dashboard is organized in three tabs:
- sensors: latest and historical value along with the latest state
- telemetry: latest and historical value along with the latest state
- actuators: current state, manual activation and rule activation detection

The system is coupled with a Rule Automation Engine which allows you to configure
persistent rules to be triggered on specific conditions met by sensors or telemetry data.

The pipeline is architectured in such a way to be able to handle an high polling rate,
in order to be able to provide the user always the most accurate data.

## User stories

1. As a user, I want to visualize the latest data reported by each sensor.
2. As a user, I want to visualize the historical values for each sensor, so that I can see the evolution of the situation over time.
3. As a user, I want to be able to manually trigger actuators, so that I can take action in emergency situations.
4. As a user, I want to specify rules based on values reported by the sensor and take action through the actuators, so that i can automate my work.
5. As a user, I want to delete previously specified rules.
6. As a user, I want to be able to temporarily toggle a rule, so that I can perform maintenance.
7. As a user, I want the system to identify which rule activated an actuator, so that everything is transparent.
8. As a user, I want to give names to rules, so that I can easily identify rules.
9. As a user, I want to be able to edit a rule.
10. As a user, I want to see at a glance the overall health of the system.
11. As a user, I want to be able to control the polling rate of the data from the sensors, so that I can reduce the power consumption of the system.
12. As a user, I want to be able to quickly see the trend of sensed data, so that I can quickly monitor the situation.
13. As a user, I want to be able to remove all rules at once.
14. As a user, I want to be able to enable/disable all rules at once.
15. As a user, I want to be able to see the status of each sensor.


## Unified internal event schema
The data is provided to us in an heterogeneous manner. In order reduce coupling
and improve the overall scalability of the system, the stream of data is normalized
in the following unified internal event schema.


```json
{
    "type": "object",
    "required": [
        "id",
        "timestamp",
        "source",
        "metric",
        "unit",
        "value",
        "status"
    ],
    "properties": {
        "id": { "type": "string" },
        "timestamp": {
            "type": "string",
            "format": "date-time"
        },
        "source": { "type": "string" },
        "metric": { "type": "string" },
        "unit": { "type": "string" },
        "value": { "type": "number" },
        "status": {
            "type": "string",
            "enum": ["ok", "warning", "DEPRESSURIZING", "IDLE", "PRESSURIZING"]
        }
    }
}
```

An attempt was made to use two different schema: one to normalize sensor data and
one to normalize telemetry data. The main reason behind this idea was that some
fields are not necessary to one type of data or the other. Moreover new telemetry
is acquired every 5s, whereas new sensor data is continuously flowing. Therefore
splitting the schemas was an opportunity to optimize for this matter. Ultimately
we found a good way to represent both streams in a unified manner, without too much
overhead.


## Rule model
This is the model used to construct the respective table in the database engine.
It contains all the necessary information to be able to correctly take action
on the actuators based on the condition.

```json
{
  "type": "object",
  "required": [
    "id",
    "sensor_id",
    "condition",
    "threshold",
    "actuator_id"
  ],
  "properties": {
    "id": { "type": "string" },
    "sensor_id": { "type": "string" },
    "sensor_metric": { "type": ["string", "null"] },
    "condition": { "type": "string" },
    "threshold": { "type": "number" },
    "actuator_id": { "type": "string" },
    "name": {
      "type": "string",
      "default": "Unnamed Rule"
    },
    "action": {
      "type": "string",
      "default": "ON"
    },
    "is_active": {
      "type": "boolean",
      "default": true
    }
  }
}
```

_Note_: SQLite was chosen as a database engine since the only place persistency
is required throughout the system is in the rule automation engine. Furthmore
this specific table is not expected to grow to the point to which performance
could be an issue. Finally as we are the only users of the system no concurrent
accesses are performed to the database and mostly of them are read operations.
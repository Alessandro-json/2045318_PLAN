# System description

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

# User stories

1. As a user, I want to visualize the latest data reported by each sensor.
2. As a user, I want to visualize the historical values for each sensor, so that I can see the evolution of the situation over time.
3. As a user, I want to be able to manually trigger actuators, so that I can take action in emergency situations.
4. As a user, I want to specify rules based on values reported by the sensor and take action through the actuators, so that i can automate my work.
5. As a user, I want to delete previously specified rules.
6. As a user, I want to be able to temporarily toggle a rule, so that I can perform maintenance.
7. As a user, I want the system identify which rule activated an actuator, so that everything is transparent.
8. As a user, I want to give names to rules, so that I can easily identify rules.
9. As a user, I want to be able to edit a rule.
10. As a user, I want to see at a glance the overall health of the system.
11. As a user, I want to be able to control the polling rate of the data from the sensors, so that I can reduce the power consumption of the system.
12. As a user, I want to be able to quickly see the trend of sensed data, so that I can quickly monitor the situation.
13. As a user, I want to be able to remove all rules at once.
14. As a user, I want to be able to enable/disable all rules at once.
15. As a user, I want to be able to see the status of each sensor.

# Containers

## sensors-poller

### Description
This container is responsible for polling the sensors data from the REST API
provided by `mars-iot-simulator` container and dispatching it to the unormalized
data exchange within RabbitMQ.

### User stories

1. As a user, I want to visualize the latest data reported by each sensor.
2. As a user, I want to visualize the historical values for each sensor, so that I can see the evolution of the situation over time.
12. As a user, I want to be able to quickly see the trend of sensed data, so that I can quickly monitor the situation.
15. As a user, I want to be able to see the status of each sensor.

### External services connections
This container connects to the `mars-iot-simulator` service and the RabbitMQ service in order to transfer data down the pipeline.

### Microservices

#### sensors
- *Type*: backend
- *Description*: polls the sensors data stream and pushes it into RabbitMQ exchange.
- *Technological specification*: the microservice uses `requests` to make REST API requests to `mars-iot-simulator`, `pika` to manage the connection to RabbitMQ and `pydantic` to validate the data in a type-safe manner following predefined models.
- *Service architecture*: the service uses a single file fulfill its requirements, apart from `pydantic` models, which are stored in another file, as they are shared between microservices.

## telemetry-poller

### Description
This container is responsible for polling telemetry data from the WebSocket endpoints provided by `mars-iot-simulator` container and dispatching it to the unormalized data exchange within RabbitMQ.

### User stories

1. As a user, I want to visualize the latest data reported by each sensor.
2. As a user, I want to visualize the historical values for each sensor, so that I can see the evolution of the situation over time.
12. As a user, I want to be able to quickly see the trend of sensed data, so that I can quickly monitor the situation.
15. As a user, I want to be able to see the status of each sensor.

### External services connections
This container connects to the `mars-iot-simulator` service and the RabbitMQ service in order to transfer data down the pipeline.

### Microservices

#### telemetry
- *Type*: backend
- *Description*: listens for websocket events and pushes the incoming data into the RabbitMQ unormalized data exchange.
- *Technological Specification*: the microservice uses the `threading` library to spawn a new thread, which, through the `websocket` module, creates a connection per telemetry topic and listens to message events, which get structed
in a type-safe way using `pydantic` models, finally pushed into RabbitMQ exchange using `pika`.
- *Service architecture*: the service uses a single file to fulfill its requirements, apart from `pydantic` models, which are stored in another file, as they are shared between microservices.

## normalizer

### Description
This container is responsible for consuming data from the unormalized data
exchange in the RabbitMQ service, normalizing them following the unified internal
event schema and finally pushing them in the normalize data exchange, once again
via RabbitMQ protocol.

### User stories

1. As a user, I want to visualize the latest data reported by each sensor.
2. As a user, I want to visualize the historical values for each sensor, so that I can see the evolution of the situation over time.
12. As a user, I want to be able to quickly see the trend of sensed data, so that I can quickly monitor the situation.
15. As a user, I want to be able to see the status of each sensor.

### External services connections
This container connects to the `mars-iot-simulator` service and the RabbitMQ service in order to transfer data down the pipeline.

### Microservices

#### normalizer
- *Type*: backend
- *Description*: consumes data from the unormalized data exchange in RabbitMQ, then after parsing the data it normalizes it in the unified internal event schema, finally pushing it into the normalized data exchange.
- *Technological Specification*: the microservice uses `pika` to manage the connection to RabbitMQ and both consuming as well as pushing data to exchanges; incoming data is structured in a type-safe way using `pydantic` models, normalized into another `pydantic` model and then pushed.
- *Service architecture*: the service uses a single file to fulfill its requirements, apart from `pydantic` models, which are stored in another file, as they are shared between microservices.

## backend

### Description
The backend, also called backend for frontend, is the container responsible for
providing the API that the frontend can call to get the data to display.

### User stories

1. As a user, I want to visualize the latest data reported by each sensor.
2. As a user, I want to visualize the historical values for each sensor, so that I can see the evolution of the situation over time.
12. As a user, I want to be able to quickly see the trend of sensed data, so that I can quickly monitor the situation.
15. As a user, I want to be able to see the status of each sensor.

### External services connections
This container connects to the RabbitMQ service in order to expose data for the
frontend.

### Microservices

#### backend
- *Type*: backend
- *Description*: exposes a WebSocket endpoint for the frontend to connect to, in order to receive the data, from the normalized data exchange, to display on the dashboard.
- *Ports*: 8000
- *Technological Specification*: the microservice uses `fastapi` to create the websocket endpoint, `aio_pika` to connect asynchronously to RabbitMQ, and `asyncio` to spawn asynchronous task to manage requests from the `frontend` to not block the system.
- *Service architecture*: the service uses a single file to fulfill its requirements, apart from `pydantic` models, which are stored in another file, as they are shared between microservices.
- *Endpoints*: the only endpoint exposed is `/ws/dashboard` which simply sends in broadcast to all active connections the data stream from the normalize data
exchange.

<!-- ## Container name

### Description

### User stories

### Persistance evaluation

### External services connections

### Microservices

#### Microservice name

- *Type*:
- *Description*:
- *Ports*:
- *Technological Specification*:
- *Service architecture*:
- *Endpoints*: -->
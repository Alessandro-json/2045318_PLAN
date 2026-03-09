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

## frontend

### Description
The frontend is the container responsible for serving the web dashboard through which users can monitor normalized sensor data in real time, visualize historical trends, manage automation rules and manually trigger actuators.

### User stories
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

### External services connections
This container connects to the backend service to receive normalized data, to the rules service to manage automation rules, and to the `mars-iot-simulator` service in order to retrieve actuator status, activate actuators and check system health.

### Microservices

#### frontend
- *Type*: frontend
- *Description*: serves the web dashboard and forwards API and WebSocket requests to internal backend services.
- *Ports*: 3000:80
- *Technological Specification*: the microservice is build with `React` using `Vite`. The real-time data is received through a WebSocket connection to `/ws/dashboard`, while rule management and actuators operations are performed using `fetch` to REST endpoints. `Nginx` is used to serve the application and to forward API/WebSocket calls to internal services.
- *Service architecture*: the application is compiled using `Node.js` and served by `Nginx`. The source code is structured using React components and dedicated hooks, each responsible for specific parts of the application logic. In particular, the WebSocket connection and real-time data management are handled by the `NormalizedDataHook`, rule management operations are managed through the `RulesHook` via REST APIs, actuator control is implemented inside the `ActuatorsHook` and system health monitoring is performed by the `HealthHook`.


## rules

### Description
The rules container is responsible for managing automation rules. It provides REST APIs for rule creation, modification, deletion and activation/deactivation.
It also evaluates incoming normalized events and triggers actuator actions when rule conditions are satisfied.

### User stories
4. As a user, I want to specify rules based on values reported by the sensor and take action through the actuators, so that i can automate my work.
5. As a user, I want to delete previously specified rules.
6. As a user, I want to be able to temporarily toggle a rule, so that I can perform maintenance.
7. As a user, I want the system identify which rule activated an actuator, so that everything is transparent.
8. As a user, I want to give names to rules, so that I can easily identify rules.
9. As a user, I want to be able to edit a rule.
10. As a user, I want to see at a glance the overall health of the system.
11. As a user, I want to be able to control the polling rate of the data from the sensors, so that I can reduce the power consumption of the system.

### Persistance evaluation
This container requires persistence since rules must survive container restarts.
The service uses a persistent volume (rule_data) attached to the container to store the database file.

### External services connections
This container connects to the rabbitmq service to receive normalized events, and to the mars-iot-simulator service to trigger actuator actions when rule conditions are met.

### Microservices

#### rules

- *Type*: backend
- *Description*: provides rule management APIs and evaluates normalized events with respect to stored rules.
- *Ports*: 9000
- *Technological Specification*: the service exposes REST endpoints for rule management and subscribes to normalized events from RabbitMQ. When a new event is received, the rule engine evaluates the defined conditions and, if a rule is satisfied, performs an HTTP request to the appropriate actuator endpoint. Finally, it uses SQLite as database engine for persistent storage of rules. 
- *Service architecture*: The service is structured into two separate modules: the persistence layer is implemented in `database.py` while rule evaluation logic is implemented in `manager.py`.
- *Endpoints*: the service exposes REST endpoints under the base path `/api/rules`. It supports rule retrieval (`GET /api/rules`), rule creation (`POST /api/rules`), rule removal (`DELETE /api/rules`), rule update (`PUT /api/rules/{rule_id}`) and partial rule modification (`PATCH /api/rules/{rule_id}`), as well as single rule deletion (`DELETE /api/rules/{rule_id}`). It also provides endpoints for enabling (`PATCH /api/rules/enable-all`), disabling (`PATCH /api/rules/disable-all`) and toggling (`PATCH /api/rules/{rule_id}/toggle`) rules.

## rabbitmq

### Description
This container provides the message broker used to communicate between microservices.

### Persistance evaluation
A persistent volume (`rabbitmq_data`) is used in order to preserve broker state (queues and related metadata) across restarts.

### External services connections
This container is used by `sensors-poller`, `telemetry-poller`, `normalizer`, `backend` and `rules` to exchange unnormalized and normalized events within the pipeline.

### Microservices

#### rabbitmq

- *Type*: message broker
- *Description*: provides message-based communication between microservices using AMQP, enabling decoupled data exchange across the system.
- *Ports*: 5672 (AMQP protocol for microservice communication), 15672 (management web interface)
- *Technological Specification*: the service is implemented using the official `rabbitmq:3.13-management` Docker image. It supports the AMQP protocol (port 5672), which is used by the microservices to publish and receive messages, and a web-based management interface (port 15672) that allows monitoring of exchanges, queues and message flow within the system.
- *Service architecture*: the service acts as the central event bus of the system allowing microservices to publish and receive messages through two exchanges: `unormalized_data` and `normalized_data`. In particular, poller services publish raw sensor data to the `unormalized_data` exchange, the normalizer processes and republishes validated events to the `normalized_data` exchange, and the backend and rules services receive normalized events for visualization and rule evaluation.



## oci-container

### Description
This container runs the mars-iot-simulator, which simulates the IoT environment of the system.
It acts as the external data source and actuator provider for the entire architecture.

### User stories
1. As a user, I want to visualize the latest data reported by each sensor.
2. As a user, I want to visualize the historical values for each sensor, so that I can see the evolution of the situation over time.
3. As a user, I want to be able to manually trigger actuators, so that I can take action in emergency situations.
10. As a user, I want to see at a glance the overall health of the system.
15. As a user, I want to be able to see the status of each sensor.

### External services connections
This container is accessed by `sensors-poller` and `telemetry-poller` to retrieve sensor data, by `rules` to trigger actuator actions, and by `frontend` to retrieve actuator status and system health information.

### Microservices

#### oci-container

- *Type*: simulator
- *Description*: provides the simulated IoT environment, exposing sensor data sources and actuator control interfaces.
- *Ports*: 8080
- *Technological Specification*: the service is implemented as the Docker image `mars-iot-simulator:multiarch_v1`. It exposes HTTP REST endpoints for sensors and actuators interaction and a WebSocket interface for telemetry streaming.
- *Service architecture*: the simulator represents the external environment of the system. It produces raw sensor data that is collected by the poller services and exposes actuator endpoints that are triggered by the rules engine.
- *Endpoints*: the simulator exposes a REST interface, including endpoints for health checking (`/health`), list of available devices (`/api/discovery`), list of sensors (`/api/sensors`) and actuator management (`/api/actuators`). Telemetry data is provided both through a Server-Sent Events stream (`/api/telemetry/stream/{topic}`) and a WebSocket interface (`/api/telemetry/ws?topic={topic}`).
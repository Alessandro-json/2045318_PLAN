![Docker Compose Build](https://github.com/Alessandro-json/2045318_PLAN/actions/workflows/compose.yaml/badge.svg)

# PLAN(ET)

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

## Table of contents
|Topic|
|-----|
|[Building](#building)|
|[System overview](input.md#system-overview)|
|[User stories](input.md#user-stories)|
|[Unified internal event schema](input.md#unified-internal-event-schema)|
|[Rule model](input.md#rule-model)|
|[Architecture diagram](booklets/architecture_diagram.png)|
|[Containers](Student_doc.md#containers)|

## Building
In order to build from source the application you need first of all to have
the image `mars-iot-simulator:multiarch_v1` in your local docker registry.
If you do not have it already, download the tarball and then run the following
command:
```sh
docker load -i mars-iot-simulator.tar
```

Once you have done that, you are ready to compose the container for the application. It is as simple as:
```sh
docker compose up -d --build
```

When docker finishes composing the container the application will be available
at http://localhost:3000.
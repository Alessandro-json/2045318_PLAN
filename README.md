![Docker Compose Build](https://github.com/Alessandro-json/2045318_PLAN/actions/workflows/compose.yaml/badge.svg)

# PLAN(ET)

<table style="width: 100%;">
  <tr>
    <td><img width="1851" height="981" alt="Sensors Tab" src="https://github.com/user-attachments/assets/0f80364c-6e63-41e0-bc94-61d02199956f" /></td>
    <td><img width="1858" height="984" alt="Telemetry Tab" src="https://github.com/user-attachments/assets/20756ff7-39af-4cf6-adce-e333d2b59da1" /></td>
    <td><img width="1856" height="974" alt="Actuators Tab" src="https://github.com/user-attachments/assets/e329e5f3-4a97-4c9e-917c-03e098b4338f" /></td>
  </tr>
</table>

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

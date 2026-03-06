import os
import requests
import time


ENDPOINT = os.getenv('SENSORS_ENDPOINT', 'http://host.docker.internal:8080/api/sensors')  # noqa: E501
POLLING_RATE = 0.1


def main():
    start_time = time.time()
    while True:
        try:
            response = requests.get(ENDPOINT, timeout=0.05)
            print(response.json())
        except Exception as e:
            print(f'error: {e}')

        elapsed = time.time() - start_time
        time.sleep(max(0, POLLING_RATE - elapsed))


if __name__ == '__main__':
    raise SystemExit(main())

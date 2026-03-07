import os
import time
import pika

from models.models import NormalizedData


RABBIT_HOST = os.getenv('RABBIT_HOST', 'localhost')
EXCHANGE_NAME = os.getenv('NORMALIZED_DATA_EXCHANGE', 'normalized_data')


def _on_message(channel, method, properties, body):
    print(body)


def _setup_rabbitmq():
    parameters = pika.ConnectionParameters(host=RABBIT_HOST)

    for attempt in range(1, 11):
        try:
            connection = pika.BlockingConnection(parameters)

            channel = connection.channel()
            channel.exchange_declare(
                exchange=EXCHANGE_NAME,
                exchange_type='topic',
            )

            result = channel.queue_declare(queue='', exclusive=True)
            queue_name = result.method.queue

            channel.queue_bind(
                exchange=EXCHANGE_NAME,
                queue=queue_name,
                routing_key='data.#',
            )

            print(' [*] Backend waiting for data... Press CTRL+C to exit')

            channel.basic_consume(
                queue=queue_name,
                on_message_callback=_on_message,
                auto_ack=True
            )

            channel.start_consuming()

            return channel
        except pika.exceptions.AMQPConnectionError as e:
            print(f'error: failed to connect to rabbitmq: {e}. Retrying in 5s...')  # noqa: E501
            time.sleep(5)

    raise SystemExit('fatal error: failed to connect to rabbitmq...')


def main():
    try:
        _setup_rabbitmq()
    except KeyboardInterrupt:
        print('Stopping backend...')


if __name__ == '__main__':
    raise SystemExit(main())

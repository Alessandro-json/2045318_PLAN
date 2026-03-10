= PLAN Hackathon Project Pitch

== Presentation
We would like to introduce our project from the ground up, starting from the
backend architecture design, through frontend mockups and finally demoing the
final product. We prepared a diagram as a visual aid to help us build a rough
model of the data pipeline to keep in mind while we go in depth in each section.

First of all we opted for a microservice architecture which is split in: simulator, rabbitmq, pollers (sensor & telemetry), normalizer, backend, rules automation engine and frontend. Since when we are dealing with microservices
the most important thing is how the communicate between each other, we will start
talking about this matter.
_Note_: Here basically describe on a very high-level each type of connection between microservices. But keep it very short as we will go in depth later.

RabbitMQ is the heart of the project, we have chosen this variant of the multiple
available message brokers since it is the one we were the most familiar with. It
allows us to model communication between different microservices in a declarative-style not dealing too much about the underlying endpoints and such.
It achieves thanks to the AMQP protocol, which is based on TCP. The model we
decided to go with comprehends one unnormalized exchange and one normalized
exchange. An exchange is this high-level abstraction in RabbitMQ to which
consumers and producers can connect to to push data or receive data in a queue.

The data flowing from the simulator through REST API goes into the sensors-poller container, parsed into type-safe representation of it to ensure
the schema is validate. Whereas the data from the WebSocket endpoint goes into
the telemetry-poller container, just like ther other validate through BaseModels. Both streams get then joined when pushed into the unnormalized
exchange. We did not specify any kind of routing keys for specific topics since
by design we are interested in all the information and we were not interested
in splitting by any means the data.

The next step down the pipeline is data normalization. Since it would be a mess
to deal with such ethereogenous schemas for different sensors data, the stream
has to be normalized in an unified internal event schema, to reduce coupling
between microservices, improve scalability and maintenaince. In this regards an
attempt was made to split telemetry data and sensors data into two different
schemas. The main reasoning behind this idea was the fact that to represent both
there are certain keys that are useful for one but useless for the other. In
addition telemetry data is far less frequent than sensors data, therefore it
would be a waste of resources to send useless keys for sensors data every 10ms.
Ultimately, we did not pursue this route as we managed to find a way to
represent both types of streams in a compact way, without introducing too much
overhead.

Now it is time for the backend for the frontend. We opted for a FastAPI WebSocket
endpoint to meet our low-latency requirements. WebSocket is crucial for these
needs as it manages a persistent connection, has way smaller header size. We are managing to refresh the dashboard up to every 100ms, before experiencing data races. Another factor contributing to low-latency and managing multiple
connections with ease is the python asyncio module.

The last component of the backend is the Rule Automation Engine, it provides a REST interface for the frontend to make requests to in order to create new rules.
Rules are then stored in an SQLite database to ensure persistency. The conditions
are checked by hooking up also this container to the data stream via WebSocket
(as the backend) and manually performing the comparison to see if we have to
act on the actuators by making a POST request. Of course in order to increase
performance rules are cached in memory instead of having to hit the database
each time new data arrives, which would be infeasible given the high refresh
rate of the application. By using REST for acting on actuators and WebSocket for
gathering data we are able to produce a separation between the control plane and
the data plane.

Basically constistency between backend and the rule automation engine is
maintained by consuming the WebSocket data stream twice without having each
microservice to know about each other, ultimately reducing the coupling.

As regards the frontend rather than triggering a React render every time a new
message event occurs in the WebSocket, we accumulate websocket events and
dispatch them using a timeout to increase the website performance.We treat the
browser as a data visualization engine, not a compute engine. Throttling,
buffering, and deduplication happens client-side so the backend never needs to
know or care about UI polling patterns. Furthermore by maintaining only one
single connection to the WebSocket endpoint we eliminate the need of alignining
connections to a single-source-of-truth. Also history data is intelligently
deduplicated, as we store new values only if it changes or if 5+ seconds pass,
to reduce the memory footprint of the application.

=== User stories
Ideally we would like to add here to every user stories a little so-that if it is
not already present, plus we should describe briefly why we design something
like that. If you don't have any idea to why something was designed like that,
as we have not done it, simply just say to improve visual clarity or not to
confuse the end users, some bullshit like that about UX.

== Demo
During the demo we might want to reference how some things work. For example,
when we are talking about adding new rules we can say that we make a POST request
to the rule automation engine. Another example could be saying that actuators are
discovered on frontend startup and their state is fetched via a GET request to
the webpage and so on and so forth. Basically adding this little small details.

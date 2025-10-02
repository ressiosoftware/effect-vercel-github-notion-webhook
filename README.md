# how to use

1. run `pnpm install`
2. set up a `.env.local` file:

    ```bash
    cp .env.example .env.local
    ```

3. run otel server

    ```bash
    docker run -p 3000:3000 -p 4317:4317 -p 4318:4318 --rm -it docker.io/grafana/otel-lgtm
    ```

4. `pnpm dev:run`

5. go to `localhost:3001:/api/webhook` to test the webhook

6. view the otel traces in `localhost:3000/explore` (see [documentation below](#opentelemetry))

# run tests

```bash
pnpm test
```

# opentelemetry

in your `.env.local`, set `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT` to a local endpoint:

```env
OTEL_EXPORTER_OTLP_TRACES_ENDPOINT="http://localhost:4318/v1/traces"
```

use a tool to collect and visualize those traces.

> [!NOTE] below is just yoinked advice from Effect's tracing docs:
> <https://effect.website/docs/observability/tracing/#tutorial-visualizing-traces>

here's how to run otel/lgtm locally:

```bash
docker run -p 3000:3000 -p 4317:4317 -p 4318:4318 --rm -it docker.io/grafana/otel-lgtm
```

then run the program so it sends traces,

then visit `http://localhost:3000/explore` and use "search" with "tempo" as the tool.

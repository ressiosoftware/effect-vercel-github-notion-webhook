# how to use

1. run `pnpm install`
2. set up a `.env.local` file:

    ```bash
    cp .env.example .env.local
    ```

3. run local development otel server

    ```bash
    pnpm otel:dev

    # ^ FYI just starts a docker container (grafana/otel-lgtm)
    # docker run -p 3000:3000 -p 4317:4317 -p 4318:4318 --rm -it docker.io/grafana/otel-lgtm
    ```

4. `pnpm dev:run`

5. go to `localhost:3001:/api/webhook` to test the webhook

6. view the otel traces in `localhost:3000/explore` (see [documentation below](#opentelemetry))

# run tests

```bash
# run tests in watch mode
pnpm test:watch

# or run once:
pnpm test:run
```

# available scripts

| script                | description                                                         |
| --------------------- | ------------------------------------------------------------------- |
| `run:dev`             | starts the development server with inspect mode                     |
| `otel:dev`            | starts a local development OpenTelemetry server (grafana/otel-lgtm) |
| `test:watch`          | runs tests in watch mode                                            |
| `test:run`            | runs tests once without watch mode                                  |
| `lint:check`          | checks all files for linting errors                                 |
| `lint:check:staged`   | checks staged files for linting errors                              |
| `lint:fix`            | fixes linting errors in all files                                   |
| `lint:fix:staged`     | fixes linting errors in staged files                                |
| `format:check`        | checks all files for formatting issues                              |
| `format:check:staged` | checks staged files for formatting issues                           |
| `format:fix`          | fixes formatting in all files                                       |
| `format:fix:staged`   | fixes formatting in staged files                                    |
| `check`               | runs biome check with auto-fix                                      |
| `types:check`         | runs typescript type checking                                       |

# opentelemetry

in your `.env.local`, set `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT` to a local endpoint:

```env
OTEL_EXPORTER_OTLP_TRACES_ENDPOINT="http://localhost:4318/v1/traces"
```

use a tool to collect and visualize those traces.

> [!NOTE] below is just yoinked advice from Effect's tracing docs:
> <https://effect.website/docs/observability/tracing/#tutorial-visualizing-traces>

here's how to run otel/lgtm locally for development:

```bash
pnpm otel:dev
```

then run the program so it sends traces,

then visit `http://localhost:3000/explore` and use "search" with "tempo" as the tool.

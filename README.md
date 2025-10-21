# how to use

1. run `pnpm install`
2. set up a `.env.local` file:

    ```bash
    cp .env.example .env.local
    ```

3. configure required environment variables (see [environment variables](#environment-variables) section below)

4. run local development otel server

    ```bash
    pnpm otel:dev

    # ^ FYI just starts a docker container (grafana/otel-lgtm)
    # docker run -p 3000:3000 -p 4317:4317 -p 4318:4318 --rm -it docker.io/grafana/otel-lgtm
    ```

5. `pnpm dev:run`

6. go to `localhost:3001:/api/webhook` to test the webhook

7. view the otel traces in `localhost:3000/explore` (see [documentation below](#opentelemetry))

# environment variables

## required

| variable                             | description                                      | example                           |
| ------------------------------------ | ------------------------------------------------ | --------------------------------- |
| `GITHUB_WEBHOOK_SECRET`              | Secret for validating GitHub webhook signatures  | `your-webhook-secret`             |
| `NOTION_TOKEN`                       | Notion API token for accessing your workspace    | `secret_abc123...`                |
| `NOTION_DATABASE_ID`                 | ID of the Notion database to update              | `abc123def456...`                 |
| `NOTION_TASK_ID_PROPERTY`            | Name of the Notion property containing task IDs  | `Task ID`                         |
| `NOTION_TASK_ID_PREFIX`              | Prefix used for task IDs (e.g., GEN, JIRA, TASK) | `GEN`                             |
| `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT` | OpenTelemetry traces endpoint for observability  | `http://localhost:4318/v1/traces` |

## optional (with defaults)

| variable        | description                                               | default       |
| --------------- | --------------------------------------------------------- | ------------- |
| `DD_API_KEY`    | Datadog API key added to OTLP trace exporter headers      | `(unset)`     |
| `NOTION_DRY_RUN`| Skip Notion mutations while still logging intended writes | `false`       |
| `NODE_ENV`      | Node environment                                          | `development` |
| `API_VERSION`   | API version reported by the health endpoint               | `0.0.0`       |

Setting `DD_API_KEY` automatically attaches the secret as the `dd-api-key` header on outgoing OTLP trace exports. The value stays redacted inside the Effect config until it is sent.

## notion configuration

The `NOTION_TASK_ID_PROPERTY` should match the exact name of the property in your Notion database that contains unique task IDs (typically a "Unique ID" property type).

The `NOTION_TASK_ID_PREFIX` is used to extract task IDs from GitHub PR titles and branch names. For example:

- If set to `GEN`, it will match patterns like `GEN-1234`
- If set to `JIRA`, it will match patterns like `JIRA-5678`

When a PR is opened/edited with a matching task ID in its title or branch name, the corresponding Notion page will be updated.

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

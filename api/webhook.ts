import { DevTools } from "@effect/experimental";
import { NodeSdk } from "@effect/opentelemetry";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import {
	BatchSpanProcessor,
	ConsoleSpanExporter,
	type SpanExporter,
} from "@opentelemetry/sdk-trace-base";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { Cause, ConfigError, Effect, Exit, Layer } from "effect";
import { ParseError } from "effect/ParseResult";
import { AppConfig } from "#platform/schema.ts";
import {
	InvalidRequestError,
	SignatureFailureError,
	UnsupportedMethodError,
} from "#services/github/errors.ts";
import { NotionRequestFailureError } from "#services/notion/errors.ts";
import { NotionLive } from "#services/notion/service.ts";
import { program } from "#services/program.ts";
import { SystemInfo } from "#services/system-info/service.ts";
import { VercelHttpContext } from "#services/vercel/types.ts";

/**
 * NodeSdk layer w/ opentelemetry tracing
 *
 * Unwraps `NodeSdk.layer` so we can use the Config provider
 */
const NodeSdkTracedLive = Layer.unwrapEffect(
	Effect.gen(function* () {
		const {
			nodeEnv,
			otelExporterOtlpTracesEndpoint,
			// datadogApiKey: optionalRedactedDdApiKey,
		} = yield* AppConfig;

		// TODO: (probably) ripe for just making a schema that parses AppConfig values
		// const ddApiKey = pipe(optionalRedactedDdApiKey, Option.getOrNull);

		yield* Effect.log("🔍 Tracing live", {
			nodeEnv,
		});

		return NodeSdk.layer(() => ({
			resource: {
				serviceName: "github-notion",
				// WARN: ^ may need to match vercel project name if using Vercel 'Drain'

				// [FUTURE] version: "0.0.1",
			},
			spanProcessor: new BatchSpanProcessor(
				otelExporterOtlpTracesEndpoint
					? // TODO: why does this cause `vercel build` to fail? (type mismatch in prod vs dev)
						// going to use `as SpanExporter` for now
						(new OTLPTraceExporter({
							url: otelExporterOtlpTracesEndpoint,

							// TODO: getting the impression that this shouldn't be necessary;
							// i think maybe Vercel prefers the use of "Drain"?
							// need to learn more about otel and vercel...
							// --
							// UPDATE/NEW DISCOVERY:
							// datadog's agentless OTLP support is currently limited to logs and metrics.
							// --
							// inject headers (eg for desired APM)
							// headers: {
							// 	// for datadog APM
							// 	...(ddApiKey && {
							// 		"dd-api-key": Redacted.value(ddApiKey),
							// 	}),
							// },
						}) as SpanExporter)
					: new ConsoleSpanExporter(),
			),
		}));
	}),
);

/**
 * DevTools layer
 *
 * Unwraps `DevTools.layer` so we can use the Config provider
 */
const DevToolsLive = Layer.unwrapEffect(
	Effect.gen(function* () {
		const { nodeEnv } = yield* AppConfig;

		if (nodeEnv !== "development") {
			return Layer.empty;
		}

		return DevTools.layer();
	}),
);

/**
 * VercelHttpContext layer
 *
 * Wraps ("captures") the Vercel request/response objects and makes them
 * available as a service that can be consumed by Effects that need it.
 */
const VercelHttpContextLive = (req: VercelRequest, res: VercelResponse) =>
	Layer.succeed(VercelHttpContext, {
		request: req,
		response: res,
	});

export default async function handler(req: VercelRequest, res: VercelResponse) {
	// These are merged because they don't depend on each other.
	const AppLive = Layer.mergeAll(
		VercelHttpContextLive(req, res),
		SystemInfo.Default,
		NotionLive,
	);

	const runnable = Effect.provide(
		program(),
		AppLive.pipe(
			// WARN: provide devtools *before* tracing layers;
			Layer.provide(DevToolsLive),
			Layer.provide(NodeSdkTracedLive),
		),
	);

	// Run and capture exit/result
	const result = await Effect.runPromiseExit(runnable);

	handleExit({
		exit: result,
		request: req,
		response: res,
	});
}

type ProgramReturn = ReturnType<typeof program>;
type ProgramSuccess = Effect.Effect.Success<ProgramReturn>;
type ProgramError = Effect.Effect.Error<ProgramReturn>;
type ProgramExit = Exit.Exit<ProgramSuccess, ProgramError>;

const HttpInternalServerError = 500 as const;
const HttpBadRequest = 400 as const;
const HttpMethodNotAllowed = 405 as const;

/**
 * ✅ "Expected" errors
 */
function handleFailType(cause: Cause.Fail<ProgramError>) {
	const error = cause.error;

	if (error instanceof InvalidRequestError) {
		Effect.runSync(
			Effect.log("❌ Invalid request:", {
				error: error.reason,
			}),
		);

		return {
			status: HttpBadRequest,
			error: "Bad Request",
			reason: error.reason,
			details: error.details,
		};
	}

	if (error instanceof UnsupportedMethodError) {
		Effect.runSync(
			Effect.log("❌ Unsupported method:", {
				error: error.method,
				supported: error.supported,
			}),
		);

		// Tell the client the supported methods
		// res.setHeader("Allow", error.supported.join(", "));

		return {
			status: HttpMethodNotAllowed,
			error: "Method Not Allowed",
			method: error.method,
			supported: error.supported,
			details: undefined,
		};
	}

	if (error instanceof ParseError) {
		Effect.runSync(
			Effect.log("❌ Schema validation failed:", {
				error: error.message,
			}),
		);

		return {
			status: HttpBadRequest,
			error: "Invalid request format",
			details: "Request does not match expected schema",
		};
	}

	if (ConfigError.isConfigError(error)) {
		Effect.runSync(
			Effect.log("❌ Config error:", {
				error: "Invalid config",
			}),
		);

		return {
			status: HttpBadRequest,
			error: "Invalid config",
			details: "Invalid config",
		};
	}

	if (error instanceof SignatureFailureError) {
		Effect.runSync(
			Effect.log("❌ Invalid webhook signature:", {
				error: error.reason,
			}),
		);

		return {
			status: HttpBadRequest,
			error: "Invalid webhook signature",
			details: "Invalid webhook signature",
		};
	}

	if (error instanceof NotionRequestFailureError) {
		Effect.runSync(
			Effect.log("❌ Notion request failure:", {
				error: error.reason,
			}),
		);

		return {
			status: HttpBadRequest,
			error: "Notion request failure",
			details: error.reason,
		};
	}

	throw new Error(`Unreachable (unhandled FailType: ${error satisfies never})`);
}

function handleExit({
	exit,
	request: req,
	response: res,
}: {
	exit: ProgramExit;
	request: VercelRequest;
	response: VercelResponse;
}) {
	Effect.runSync(Effect.logInfo("🏁 Program exited, evaluating Exit..."));

	Exit.match(exit, {
		onSuccess(data) {
			Effect.runSync(
				Effect.log("✅ Request processed successfully", {
					method: req.method,
					dataType: typeof data,
				}),
			);

			const HttpOk = 200 as const;

			// NOTE: *what* is sent back doesn't really matter as long as it's
			// `status(200)`... but still... should i ensure the data is a
			// certain shape? guessing so since we probably want to make sure
			// we're at least returning something *safe*
			res.status(HttpOk).json(data);
		},

		onFailure(cause) {
			if (res.headersSent) {
				throw new Error("Headers already sent");
			}

			// Handle different error types with specific responses
			if (Cause.isFailType(cause)) {
				const { status, ...failEnvelope } = handleFailType(cause);

				return res.status(status).json({
					error: "Notion request failure",
					details: failEnvelope.details,
				});
			}

			// finally, handle the "Unexpected" errors;
			// aka "defects", "interruptions", etc
			Effect.runSync(
				Effect.log("❌ Unexpected error:", {
					error: Cause.pretty(cause),
				}),
			);

			return res.status(HttpInternalServerError).json("Internal server error");
		},
	});
}

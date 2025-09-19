import { DevTools } from "@effect/experimental";
import { NodeSdk } from "@effect/opentelemetry";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import {
	BatchSpanProcessor,
	ConsoleSpanExporter,
} from "@opentelemetry/sdk-trace-base";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
	Cause,
	ConfigError,
	Data,
	Effect,
	Exit,
	Layer,
	Redacted,
	Schema,
} from "effect";
import { ParseError } from "effect/ParseResult";
import { Notion } from "./notion.effect.ts";
import { GenIdFromPullRequest } from "./notion.schema.ts";
import {
	AppConfig,
	type GetRequest,
	type GitHubPrWebhookData,
	GitHubPullRequestWebhook,
	type PostRequest,
	RequestEnvelope,
	type ValidatedRequest,
} from "./schemas.js";

/**
 * NodeSdk layer w/ opentelemetry tracing
 *
 * Unwraps `NodeSdk.layer` so we can use the Config provider
 */
const NodeSdkTracedLive = Layer.unwrapEffect(
	Effect.gen(function* () {
		const { nodeEnv, otelExporterOtlpTracesEndpoint } = yield* AppConfig;

		yield* Effect.log("🔍 Tracing live", {
			nodeEnv,
		});

		return NodeSdk.layer(() => ({
			resource: { serviceName: "api/webhook.ts#TracingLive" },
			spanProcessor: new BatchSpanProcessor(
				otelExporterOtlpTracesEndpoint
					? new OTLPTraceExporter({
							url: otelExporterOtlpTracesEndpoint,
						})
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

// Generate Layer for SystemInfo service
export class SystemInfo extends Effect.Service<SystemInfo>()("SystemInfo", {
	sync: () => ({
		getUptime: () => process.uptime(),
		getMemoryUsage: () => process.memoryUsage(),
		getNodeVersion: () => process.version,
	}),
}) {}

// Custom error types for better error handling
class InvalidRequestError extends Data.TaggedError("InvalidRequestError")<{
	reason: string;
	details?: unknown;
}> {}

class UnsupportedMethodError extends Data.TaggedError(
	"UnsupportedMethodError",
)<{
	method: string;
	supported: Array<string>;
}> {}

const handleGetRequest = Effect.fn("handleGetRequest")(function* (
	request: GetRequest,
) {
	const config = yield* AppConfig;
	yield* Effect.log({
		config,
	});

	yield* Effect.log("🔍 Processing GET request", {
		query: request.query,
	});

	const query = request.query || {};
	const isDetailed = query.detailed === true;
	const isHealthCheck = query.health !== undefined;

	if (isHealthCheck) {
		const systemInfo = yield* SystemInfo;

		// fake slowness for testing traces, mostly
		// if (isDetailed) {
		//	   yield* Effect.sleep("2 seconds");
		// }

		const healthData = {
			status: "healthy",
			timestamp: new Date().toISOString(),
			version: config.apiVersion,
			environment: config.nodeEnv,

			// TODO: not sure how to handle things like `process.foo`
			...(isDetailed && {
				uptime: systemInfo.getUptime(),
				memory: systemInfo.getMemoryUsage(),
				nodeVersion: systemInfo.getNodeVersion(),
			}),
		};

		yield* Effect.log("✅ Health check completed", {
			detailed: isDetailed,
		});
		return healthData;
	}

	// Default GET response
	return {
		message: "GitHub Webhook Handler API",
		version: config.apiVersion,
		environment: config.nodeEnv,
		endpoints: {
			"GET /": "API information",
			"GET /?health=true": "Health check",
			"GET /?health=true&detailed=true": "Detailed health check",
			"POST /": "GitHub webhook endpoint",
		},
		timestamp: new Date().toISOString(),
	};
});

const routeValidatedRequest = Effect.fn("routeValidatedRequest")(function* (
	request: ValidatedRequest,
) {
	switch (request.method) {
		case "GET":
			return yield* handleGetRequest(request);
		case "POST":
			return yield* handlePostRequest(request);
		default:
			// This should never happen due to schema validation, but TypeScript doesn't know
			return yield* Effect.fail(
				new UnsupportedMethodError({
					// biome-ignore lint/suspicious/noExplicitAny: handling errors
					method: (request as any).method,
					supported: ["GET", "POST"],
				}),
			);
	}
});

const validateWebhookSignature = Effect.fn("validateWebhookSignature")(
	function* (body: unknown, signature: string, secret: string) {
		const crypto = yield* Effect.sync(() => require("node:crypto"));
		const expectedSignature = yield* Effect.sync(
			() =>
				`sha256=${crypto
					.createHmac("sha256", secret)
					.update(JSON.stringify(body))
					.digest("hex")}`,
		);

		if (signature !== expectedSignature) {
			return yield* Effect.fail(new Error("Invalid webhook signature"));
		}

		return true;
	},
);

const validateGitHubWebhook = Effect.fn("validateGitHubWebhook")(function* (
	headers: PostRequest["headers"],
	body: unknown,
) {
	const config = yield* AppConfig;

	// Validate webhook signature if configured
	const signature = headers["x-hub-signature-256"];

	// ... but only required if not dev env
	if (signature && config.nodeEnv !== "development") {
		return yield* Effect.fail(
			new InvalidRequestError({
				reason: "Webhook signature required in production",
			}),
		);
	}

	if (signature) {
		const secretValue = Redacted.value(config.githubWebhookSecret);

		const isValid = yield* validateWebhookSignature(
			body,
			signature,
			secretValue,
		);
		if (!isValid) {
			return yield* Effect.fail(
				new InvalidRequestError({
					reason: "Invalid webhook signature",
				}),
			);
		}
	}

	// Validate payload structure with your existing GitHub schema
	const payload: GitHubPrWebhookData = yield* Schema.decodeUnknown(
		GitHubPullRequestWebhook,
	)(body);

	return payload;
});

const handlePostRequest = Effect.fn("handlePostRequest")(function* (
	request: PostRequest,
) {
	yield* Effect.log("📝 Processing POST request - GitHub webhook");

	// Validate it's a GitHub pull request webhook
	if (request.headers["x-github-event"] !== "pull_request") {
		return yield* Effect.fail(
			new InvalidRequestError({
				reason: "Invalid GitHub event type",
				details: {
					expected: "pull_request",
					received: request.headers["x-github-event"],
				},
			}),
		);
	}

	const webhook = yield* validateGitHubWebhook(request.headers, request.body);

	yield* Effect.log("🪵 Webhook validated successfully", {
		action: webhook.action,
		prNumber: webhook.pull_request.number,
		title: webhook.pull_request.title,
		author: webhook.pull_request.user.login,
		repository: webhook.repository.full_name,
		branch: webhook.pull_request.head.ref,
	});

	// Process the webhook based on action
	// const result = yield* processWebhookAction(webhook);

	const genIdMatches = yield* Schema.decode(GenIdFromPullRequest)(
		webhook.pull_request,
	);

	// get the Notion service
	const notion = yield* Notion;

	/** Array of updated notion pages */
	const updatedTasks: Array<{
		genId: string;
		notionPageId: string;
	}> = [];

	for (const genId of genIdMatches) {
		// Turn `GEN-#####` into a Notion page ID
		const { pageId: notionPageId } =
			// yield* notion.getByTaskIdProperty(foundGenId);
			yield* notion.getByTaskIdProperty(genId);

		yield* Effect.log(
			"🪵 notion.getByTaskIdProperty() returned:",
			notionPageId,
		);

		// Use the page ID to update the status of the task
		const statusUpdateResult = yield* notion.setNotionStatus(
			notionPageId,
			"In progress",
		);

		yield* Effect.log(
			"🪵 notion.setNotionStatus() returned:",
			statusUpdateResult,
		);

		updatedTasks.push({
			genId,
			notionPageId: statusUpdateResult.pageId,
		});
	}

	return {
		// TODO: decide on the shape of the response
		notion: {
			updatedTasks,
		},
	};
});

export class VercelHttpContext extends Effect.Tag("VercelHttpContext")<
	VercelHttpContext,
	{
		request: VercelRequest;
		response: VercelResponse;
	}
>() {}

export const VercelHttpContextLive = (
	req: VercelRequest,
	res: VercelResponse,
) =>
	Layer.succeed(VercelHttpContext, {
		request: req,
		response: res,
	});

export const program = Effect.fn("api/webhook.ts#program", {
	// just learning/seeing how attrs show up in traces
	attributes: {
		foo: "bar",
	},
})(function* () {
	yield* Effect.log("🚀 Program started");

	const {
		request,
		// response,
	} = yield* VercelHttpContext;

	const maxUserAgentLength = 200 as const;
	yield* Effect.log("🚀 Request received", {
		method: request.method,
		userAgent: request.headers["user-agent"]?.slice(0, maxUserAgentLength),
	});

	const validRequest = yield* Schema.decodeUnknown(RequestEnvelope)(request);

	yield* Effect.log("🚀 Request validated");

	const result = yield* routeValidatedRequest(validRequest);

	Effect.runSync(Effect.logInfo("🏁 Request routed, returning result..."));

	return result;
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
	// These are merged because they don't depend on each other.
	const AppLive = Layer.mergeAll(
		SystemInfo.Default,
		VercelHttpContextLive(req, res),
		Notion.Default,
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

	Effect.runSync(Effect.logInfo("🏁 Program exited, evaluating Exit..."));

	Exit.match(result, {
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
			const HttpServerError = 500 as const;
			const HttpBadRequest = 400 as const;
			const HttpMethodNotAllowed = 405 as const;

			if (res.headersSent) {
				throw new Error("Headers already sent");
			}

			// Handle different error types with specific responses
			if (Cause.isFailType(cause)) {
				// ✅ "Expected" errors
				const error = cause.error;

				if (error instanceof InvalidRequestError) {
					Effect.runSync(
						Effect.log("❌ Invalid request:", {
							error: error.reason,
						}),
					);

					return res.status(HttpBadRequest).json({
						error: "Bad Request",
						reason: error.reason,
						details: error.details,
					});
				}

				if (error instanceof UnsupportedMethodError) {
					Effect.runSync(
						Effect.log("❌ Unsupported method:", {
							error: error.method,
							supported: error.supported,
						}),
					);

					// Tell the client the supported methods
					res.setHeader("Allow", error.supported.join(", "));

					return res.status(HttpMethodNotAllowed).json({
						error: "Method Not Allowed",
						method: error.method,
						supported: error.supported,
					});
				}

				if (error instanceof ParseError) {
					Effect.runSync(
						Effect.log("❌ Schema validation failed:", {
							error: error.message,
						}),
					);

					return res.status(HttpBadRequest).json({
						error: "Invalid request format",
						details: "Request does not match expected schema",
					});
				}

				if (ConfigError.isConfigError(error)) {
					Effect.runSync(
						Effect.log("❌ Config error:", {
							error: "Invalid config",
						}),
					);

					return res.status(HttpBadRequest).json({
						error: "Invalid config",
						details: "Invalid config",
					});
				}

				// TODO: why do i still have `Error` here?
				// where does it come from? can i purge it?
				// error satisfies never;
				Effect.runSync(
					Effect.log("❌ Request failed:", {
						error: error.message,
					}),
				);

				return res.status(HttpBadRequest).json(error.message);
			}

			// finally...
			// ❌ "Unexpected" errors
			// ⚠️ aka "defects"
			// ❗ aka "interruptions"
			Effect.runSync(
				Effect.log("❌ Unexpected error:", {
					error: Cause.pretty(cause),
				}),
			);

			return res.status(HttpServerError).json("Internal server error");
		},
	});
}

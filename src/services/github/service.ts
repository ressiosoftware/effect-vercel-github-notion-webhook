import { Effect, Redacted, Schema } from "effect";
import {
	AppConfig,
	type GetRequest,
	type PostRequest,
	type ValidatedRequest,
} from "#platform/schema.ts";
import {
	InvalidRequestError,
	SignatureFailureError,
	UnsupportedMethodError,
} from "#services/github/errors.ts";
import {
	type GitHubPrWebhookData,
	GitHubPullRequestWebhook,
} from "#services/github/schema.ts";
import { Notion } from "#services/notion/api.ts";
import {
	makeGenIdFromPullRequest,
	NotionStatusFromPullRequestSchema,
	type NotionWorkflowStatus,
} from "#services/notion/schema.ts";
import { SystemInfo } from "#services/system-info/service.ts";
import { createHmac } from "node:crypto";

const sch = Schema.RedactedFromSelf(Schema.String);
type RedactedString = typeof sch.Type;

export const validateWebhookSignature = Effect.fn("validateWebhookSignature")(
	function* (body: unknown, signature: string, secret: RedactedString) {
		const expectedSignature = yield* Effect.sync(
			() =>
				`sha256=${createHmac("sha256", Redacted.value(secret))
					.update(JSON.stringify(body))
					.digest("hex")}`,
		);

		if (signature !== expectedSignature) {
			yield* Effect.log("🔴 Invalid webhook signature");

			return yield* Effect.fail(
				new SignatureFailureError({
					reason: "Invalid webhook signature",
				}),
			);
		}

		return true;
	},
);

const validateGitHubWebhook = Effect.fn("validateGitHubWebhook")(function* (
	headers: PostRequest["headers"],
	body: unknown,
) {
	const config = yield* AppConfig;

	const signature = headers["x-hub-signature-256"];

	// Validate payload structure with your existing GitHub schema
	const payload: GitHubPrWebhookData = yield* Schema.decodeUnknown(
		GitHubPullRequestWebhook,
	)(body);

	// validate signature if present
	if (signature) {
		const isValid = yield* validateWebhookSignature(
			body,
			signature,
			config.githubWebhookSecret,
		);

		if (!isValid) {
			return yield* Effect.fail(
				new InvalidRequestError({
					reason: "Invalid webhook signature",
				}),
			);
		}
	}

	// signature required if not dev env
	if (!signature && config.nodeEnv !== "development") {
		return yield* Effect.fail(
			new InvalidRequestError({
				reason: "Webhook signature required",
			}),
		);
	}

	return payload;
});

const maxUserAgentLength = 200 as const;

export const handleGetRequest = Effect.fn("handleGetRequest")(function* (
	request: GetRequest,
) {
	const config = yield* AppConfig;

	// mostly to test Redacted
	yield* Effect.log({
		config,
	});

	yield* Effect.log("🔍 Processing GET request", {
		query: request.query,
		userAgent: request.headers["user-agent"]?.slice(0, maxUserAgentLength),
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

export const handlePostRequest = Effect.fn("handlePostRequest")(function* (
	request: PostRequest,
) {
	yield* Effect.log("📝 Processing POST request - GitHub webhook");

	// Get config to access task ID prefix
	const config = yield* AppConfig;

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

	// Create the schema with the prefix from config
	const GenIdFromPullRequest = makeGenIdFromPullRequest(
		config.notionTaskIdPrefix,
	);

	const genIdMatches = yield* Schema.decode(GenIdFromPullRequest)(
		webhook.pull_request,
	);

	// get the Notion service
	const notion = yield* Notion;

	/** Array of updated notion pages */
	const updatedTasks: Array<{
		genId: string;
		notionPageId: string;
		newStatus: NotionWorkflowStatus;
	}> = [];

	const statusName = yield* Schema.decodeUnknown(
		NotionStatusFromPullRequestSchema,
	)(webhook.pull_request);

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
			statusName,
		);

		yield* Effect.log(
			"🪵 notion.setNotionStatus() returned:",
			statusUpdateResult,
		);

		// update the "PR links" property
		yield* notion.setNotionPrLinks(notionPageId, [webhook.pull_request.url]);

		updatedTasks.push({
			genId,
			notionPageId: statusUpdateResult.pageId,
			newStatus: statusUpdateResult.newStatus,
		});
	}

	return {
		// TODO: decide on the shape of the response
		notion: {
			updatedTasks,
		},
	};
});

export const routeValidatedRequest = Effect.fn("routeValidatedRequest")(
	function* (request: ValidatedRequest) {
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
	},
);

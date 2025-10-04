import { assert, describe, it } from "@effect/vitest";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
	Arbitrary,
	Cause,
	ConfigProvider,
	Effect,
	Exit,
	FastCheck,
	Layer,
	Schema,
} from "effect";
import { isParseError } from "effect/ParseResult";
import { Notion } from "../api/notion.effect.ts";
import { GenIdFromPullRequest } from "../api/notion.schema.ts";
import {
	GetRequestSchema,
	GitHubPullRequestWebhook,
	PullRequestAction,
} from "../api/schemas.ts";
import handler, {
	program,
	SystemInfo,
	VercelHttpContext,
} from "../api/webhook.ts";

/** Application Config layer for testing */
const AppConfigProviderTest = ConfigProvider.fromMap(
	// TODO: how to tie this to the config schema itself?
	new Map([
		["GITHUB_WEBHOOK_SECRET", "github-webhook-secret-test"],
		["NODE_ENV", "development"],
		["API_VERSION", "1.2.3"],
		["OTEL_EXPORTER_OTLP_TRACES_ENDPOINT", "http://localhost:4318/v1/traces"],
		["NOTION_TOKEN", "notion-token-test"],
		["NOTION_DATABASE_ID", "notion-database-id-test"],
	]),
);

/** SystemInfo layer for testing */
const SystemInfoTest = Layer.succeed(
	SystemInfo,

	new SystemInfo({
		getUptime: () => 0,
		getMemoryUsage: () => ({
			rss: 1_000_000,
			heapTotal: 2_000_000,
			heapUsed: 1_500_000,
			external: 500_000,
			arrayBuffers: 100_000,
		}),
		getNodeVersion: () => "0.0.0",
	}),
);

const MOCK_NOTION_PAGE_ID = "mock-notion-page-id" as const;

/** Notion layer for testing */
const NotionServiceTest = Layer.succeed(
	Notion,
	new Notion({
		// TODO:
		getByTaskIdProperty: Effect.fn("getByTaskIdProperty")(function* (
			_taskId: string,
		) {
			// TODO: note that this is the wrong return value type
			return yield* Effect.succeed({
				pageId: MOCK_NOTION_PAGE_ID,
			});
		}),

		setNotionStatus: Effect.fn("setNotionStatus")(function* (
			pageId: string,
			status: string,
		) {
			// TODO: note that this is the wrong return value type
			return yield* Effect.succeed({
				pageId,
				newStatus: status,
			});
		}),
	}),
);

/** The relevant parts of VercelResponse used across various tests */
const VercelHttpResponseMock = {
	statusCode: 200,
	status: (_code: number) => ({
		json: (_data: any) => Promise.resolve(),
	}),
	json: (_data: any) => Promise.resolve(),
	// biome-ignore lint/suspicious/noEmptyBlockStatements: Mock function doesn't need implementation
	setHeader: () => {},
	get headersSent() {
		return false;
	},
} as any as VercelResponse;

const createVercelHttpRequestMock = ({
	method,
	headers = {},
	query = {},
	body,
}: Partial<VercelRequest>) =>
	({
		method,
		headers,
		query,
		body,
	}) as VercelRequest;

// TODO: try TestClock ?

describe("Webhook", () => {
	describe("program", () => {
		it.effect("should fail on bad input", () =>
			Effect.gen(function* () {
				const localVercelHttpContext = Layer.succeed(VercelHttpContext, {
					request: createVercelHttpRequestMock({
						method: "INVALID_METHOD",
					}),
					response: VercelHttpResponseMock,
				});

				const localContext = Layer.mergeAll(
					SystemInfoTest,
					NotionServiceTest,
					localVercelHttpContext,
				);

				const exit = yield* Effect.exit(
					Effect.withConfigProvider(
						Effect.provide(program(), localContext),
						AppConfigProviderTest,
					),
				);

				// Verify it's actually a failure
				assert(Exit.isFailure(exit));
				assert(Cause.isFailType(exit.cause));
				assert(isParseError(exit.cause.error));
			}),
		);

		it.effect("should show basic output plain GET", () =>
			Effect.gen(function* () {
				const arbitraryHttpGet = Arbitrary.make(GetRequestSchema);
				const [req] = FastCheck.sample(arbitraryHttpGet, 1);

				const localVercelHttpContext = Layer.succeed(VercelHttpContext, {
					request: createVercelHttpRequestMock({
						method: req.method,
						query: req.query,
					}),
					response: VercelHttpResponseMock,
				});

				const localContext = Layer.mergeAll(
					SystemInfoTest,
					NotionServiceTest,
					localVercelHttpContext,
				);

				const result = yield* Effect.exit(
					Effect.withConfigProvider(
						Effect.provide(program(), localContext),
						AppConfigProviderTest,
					),
				);

				Exit.match(result, {
					onSuccess: (data) => {
						// TODO: Success types aren't explicit schemas yet,
						// so here's some simple checks for now:
						if ("action" in data) {
							throw new Error("GET request should not return `action` data");
						}

						assert.doesNotHaveAnyKeys(data, ["action"]);
						assert.isDefined(result);
					},

					onFailure: (cause) => {
						// WARN: should never fail given the test data
						assert.notExists(cause);
					},
				});
			}),
		);

		describe("POST request", () => {
			// should work for any random PR actions ..
			const arbitraryPrAction = Arbitrary.make(PullRequestAction);
			// .. generate up to 5 unique actions
			const uniquePrActions = FastCheck.uniqueArray(arbitraryPrAction, {
				minLength: 1,
				maxLength: 5,
			});
			// .. but only use 1 of the array samples
			const prActionsSample = FastCheck.sample(uniquePrActions, 1)[0];

			describe("should extract GEN-#s from title/branch of `pull_request` events and update Notion", () => {
				for (const pullRequestAction of prActionsSample) {
					it.effect(`'${pullRequestAction}' action`, () =>
						Effect.gen(function* () {
							// Create the arbitrary generator for realistic webhook data
							const webhookArbitrary = Arbitrary.make(GitHubPullRequestWebhook);

							// Generate realistic webhook payload using our annotated schemas
							const [webhookData] = FastCheck.sample(webhookArbitrary, 1);

							// Convert all Date objects to ISO strings for proper JSON serialization
							const webhookPayload = {
								...webhookData,
								action: "opened", // Set specific action for deterministic testing
								// biome-ignore lint/style/useNamingConvention: GitHub API uses snake_case
								pull_request: {
									...webhookData.pull_request,

									// TODO: letting Arbitrary/FastCheck take the wheel seems to
									// cause issues - likely string vs Date parsing - so figure
									// that shit out. we shouldn't need to do this vv.
									// biome-ignore lint/style/useNamingConvention: GitHub API uses snake_case
									created_at: webhookData.pull_request.created_at.toISOString(),
									// biome-ignore lint/style/useNamingConvention: GitHub API uses snake_case
									updated_at: webhookData.pull_request.updated_at.toISOString(),
									// biome-ignore lint/style/useNamingConvention: GitHub API uses snake_case
									closed_at:
										webhookData.pull_request.closed_at?.toISOString() || null,
									// biome-ignore lint/style/useNamingConvention: GitHub API uses snake_case
									merged_at:
										webhookData.pull_request.merged_at?.toISOString() || null,
								},
							};

							// overwrite VercelHttpContextTest with test-specific layer
							const localVercelHttpContext = Layer.succeed(VercelHttpContext, {
								// TODO: use Arbitrary/FastCheck?
								request: createVercelHttpRequestMock({
									method: "POST",
									headers: {
										"x-github-event": "pull_request",
										"x-github-delivery": "test-delivery-123",
										"content-type": "application/json",
									},
									body: webhookPayload,
								}),
								response: VercelHttpResponseMock,
							});

							const localContext = Layer.mergeAll(
								SystemInfoTest,
								NotionServiceTest,
								localVercelHttpContext,
							);

							const result = yield* Effect.exit(
								Effect.withConfigProvider(
									Effect.provide(program(), localContext),

									AppConfigProviderTest,
								),
							);

							const expectedGenIds = yield* Schema.decode(GenIdFromPullRequest)(
								webhookData.pull_request,
							);

							Exit.match(result, {
								onSuccess: (data) => {
									if (!("notion" in data)) {
										assert.fail("notion field not found");
									}

									assert.deepStrictEqual(
										data.notion.updatedTasks,

										expectedGenIds.map((genId) => ({
											genId,
											notionPageId: MOCK_NOTION_PAGE_ID,
										})),
									);
								},
								onFailure: (cause) => {
									// console.error({ cause });

									// WARN: should never fail given the test data
									assert.notExists(cause);
								},
							});
						}),
					);
				}
			});
		});
	});

	describe("vercel fn handler", () => {
		// ensure that basic GET requests work
		// TODO: probably need to rework handler a little to make this more testable?
		it.todo("should handle a GET request", () =>
			it.flakyTest(
				// WARN: this isn't actually flaky;
				// i'm just showing off the flakyTest feature (for kitchen sink demo)
				Effect.gen(function* () {
					const mockRequest = {
						method: "GET",
						headers: {},
						query: {},
					} as any as VercelRequest;

					const HttpOk = 200 as const;
					const mockResponse = {
						statusCode: HttpOk,
						status: (_code: number) => ({
							json: (_data: any) => Promise.resolve(),
						}),
						json: (_data: any) => Promise.resolve(),
						// biome-ignore lint/suspicious/noEmptyBlockStatements: Mock function doesn't need implementation
						setHeader: () => {},
						get headersSent() {
							return false;
						},
					} as any as VercelResponse;

					// Test the handler
					// TODO: this ... fails right? like, because i can't provide the program with reqs... hmm
					yield* Effect.tryPromise({
						try: () => handler(mockRequest, mockResponse),
						catch: (error) => new Error(`Handler failed: ${error}`),
					});

					// Assert the results using Effect's assert
					// TODO: this is wrong, i'm just asserting against constants lol.
					// assert.strictEqual(mockResponse.statusCode, HttpOk);
					// assert.isDefined(mockResponse.json);
				}),

				// NOTE: since it's flaky, just
				// try until timeout (or success 🤞)
				"4.2 seconds", // timeout
			),
		);

		// TODO: probably need to rework handler a lil to make this more testable?
		it.todo("should handle malformed webhook gracefully", () =>
			Effect.gen(function* () {
				const malformedRequest = {
					method: "POST" as const,
					headers: { "x-github-event": "invalid_event" },
					body: {
						/* malformed data */
					},
				} as any as VercelRequest;

				const HttpOk = 200 as const;
				const mockResponse = {
					statusCode: HttpOk,
					status: (_code: number) => ({
						json: (_data: any) => Promise.resolve(),
					}),
					json: (_data: any) => Promise.resolve(),
					// biome-ignore lint/suspicious/noEmptyBlockStatements: Mock function doesn't need implementation
					setHeader: () => {},
					get headersSent() {
						return false;
					},
				} as any as VercelResponse;

				yield* Effect.tryPromise({
					try: () => handler(malformedRequest, mockResponse),
					catch: (error) => {
						// Handler shouldn't throw an error
						assert.notExists(error);
					},
				});
			}),
		);
	});
});

// TODO: concurrency testing
// it.effect("should handle multiple concurrent webhooks", () =>
//   Effect.gen(function* () {
//     const webhooks = Array.from({ length: 10 }, () => generateWebhook())
//     yield* Effect.all(
//       webhooks.map(webhook => program(webhook)),
//       { concurrency: "unbounded" }
//     )
//   })
// )

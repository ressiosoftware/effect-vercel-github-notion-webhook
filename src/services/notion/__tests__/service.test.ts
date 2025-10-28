import { assert, describe, it } from "@effect/vitest";
import { ConfigProvider, Effect } from "effect";
import { HttpResponse, http } from "msw";
import { MOCK_NOTION_PAGE_ID } from "#mocks/msw-handlers.ts";
import { server } from "#mocks/msw-server.ts";
import { Notion } from "#services/notion/api.ts";
import { NotionLive } from "#services/notion/service.ts";
import type { NotionFileAttachment } from "#services/notion/schema.ts";

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
		["NOTION_TASK_ID_PROPERTY", "Task ID"],
		["NOTION_TASK_ID_PREFIX", "GEN"],
		["NOTION_DRY_RUN", "false"],
	]),
);

const AppConfigProviderDryRun = ConfigProvider.fromMap(
	new Map([
		["GITHUB_WEBHOOK_SECRET", "github-webhook-secret-test"],
		["NODE_ENV", "development"],
		["API_VERSION", "1.2.3"],
		["OTEL_EXPORTER_OTLP_TRACES_ENDPOINT", "http://localhost:4318/v1/traces"],
		["NOTION_TOKEN", "notion-token-test"],
		["NOTION_DATABASE_ID", "notion-database-id-test"],
		["NOTION_TASK_ID_PROPERTY", "Task ID"],
		["NOTION_TASK_ID_PREFIX", "GEN"],
		["NOTION_DRY_RUN", "true"],
	]),
);

describe("services/notion", () => {
	describe("service", () => {
		describe("getByTaskIdProperty", () => {
			it.effect(
				"should get/return the Notion page ID for a valid task ID",
				() => {
					const taskIdMock = "GEN-1234" as const;

					return Effect.withConfigProvider(
						Effect.gen(function* () {
							const notion = yield* Notion;

							// Call the function we want to test
							const result = yield* notion.getByTaskIdProperty(taskIdMock);

							// Assert the expected result
							assert.deepEqual(result, {
								pageId: MOCK_NOTION_PAGE_ID,
							});
						}).pipe(Effect.provide(NotionLive)),
						AppConfigProviderTest,
					);
				},
			);
		});

		describe("setNotionStatus", () => {
			it.effect(
				"should return the status and page ID after setting the status",
				() => {
					return Effect.withConfigProvider(
						Effect.gen(function* () {
							const notion = yield* Notion;

							// Call the function we want to test
							const result = yield* notion.setNotionStatus(
								MOCK_NOTION_PAGE_ID,
								"In progress",
							);

							// Assert the expected result
							assert.deepEqual(result, {
								pageId: MOCK_NOTION_PAGE_ID,
								newStatus: "In progress",
							});
						}).pipe(Effect.provide(NotionLive)),
						AppConfigProviderTest,
					);
				},
			);

			it.effect("should skip the Notion update when dry-run is enabled", () => {
				server.use(
					http.patch("https://api.notion.com/v1/pages/:pageId", () => {
						throw new Error(
							"Notion API should not be called when dry-run is enabled",
						);
					}),
				);

				return Effect.withConfigProvider(
					Effect.gen(function* () {
						const notion = yield* Notion;

						const result = yield* notion.setNotionStatus(
							MOCK_NOTION_PAGE_ID,
							"In progress",
						);

						assert.deepEqual(result, {
							pageId: MOCK_NOTION_PAGE_ID,
							newStatus: "In progress",
						});
					}).pipe(Effect.provide(NotionLive)),
					AppConfigProviderDryRun,
				);
			});
		});

		describe("setNotionPrLinks", () => {
			it.effect(
				// ⚠️ WARN: existing links overwritten
				// "should append new PR links without duplicating existing entries",
				"should append new PR links",
				() => {
					// ⚠️ WARN: existing links overwritten
					// const existingPrLink =
					// 	"https://github.com/ressio/github-notion/pull/0";
					const prLinks = [
						// ⚠️ WARN: existing links overwritten
						// existingPrLink,
						"https://github.com/ressio/github-notion/pull/1",
						"https://github.com/ressio/github-notion/pull/2",
						"https://github.com/ressio/github-notion/pull/1",
					] as const;

					let capturedRequestBody: any;
					server.resetHandlers();
					server.use(
						http.get("https://api.notion.com/v1/pages/:pageId", () =>
							HttpResponse.json({
								id: MOCK_NOTION_PAGE_ID,
								properties: {
									"PR links": {
										type: "files",
										files: [
											// ⚠️ WARN: existing links overwritten
											// {
											// 	type: "external",
											// 	name: existingPrLink,
											// 	external: {
											// 		url: existingPrLink,
											// 	},
											// },
										],
									},
								},
							}),
						),
						http.patch(
							"https://api.notion.com/v1/pages/:pageId",
							async ({ request }) => {
								capturedRequestBody = await request.json();

								return HttpResponse.json({
									id: MOCK_NOTION_PAGE_ID,
								});
							},
						),
					);

					return Effect.withConfigProvider(
						Effect.gen(function* () {
							const notion = yield* Notion;

							const result = yield* notion.setNotionPrLinks(
								MOCK_NOTION_PAGE_ID,
								prLinks,
							);

							assert.deepEqual(result, {
								pageId: MOCK_NOTION_PAGE_ID,
								prLinks: [
									// ⚠️ WARN: existing links overwritten
									// existingPrLink,
									"https://github.com/ressio/github-notion/pull/1",
									"https://github.com/ressio/github-notion/pull/2",
								],
							});

							const files =
								capturedRequestBody?.properties?.["PR links"]?.files ?? [];

							assert.deepEqual(files, [
								// ⚠️ WARN: existing links overwritten
								// {
								// 	type: "external" as const,
								// 	name: existingPrLink,
								// 	external: {
								// 		url: existingPrLink,
								// 	},
								// },
								{
									type: "external" as const,
									name: "https://github.com/ressio/github-notion/pull/1",
									external: {
										url: "https://github.com/ressio/github-notion/pull/1",
									},
								},
								{
									type: "external" as const,
									name: "https://github.com/ressio/github-notion/pull/2",
									external: {
										url: "https://github.com/ressio/github-notion/pull/2",
									},
								},
							] satisfies Array<NotionFileAttachment>);
						}).pipe(Effect.provide(NotionLive)),
						AppConfigProviderTest,
					);
				},
			);

			// it.effect("should skip the update when every link already exists", () => {
			// 	const existingPrLink =
			// 		"https://github.com/ressio/github-notion/pull/10";
			//
			// 	server.resetHandlers();
			// 	server.use(
			// 		http.get("https://api.notion.com/v1/pages/:pageId", () =>
			// 			HttpResponse.json({
			// 				id: MOCK_NOTION_PAGE_ID,
			// 				properties: {
			// 					"PR links": {
			// 						type: "files",
			// 						files: [
			// 							{
			// 								type: "external",
			// 								name: existingPrLink,
			// 								external: {
			// 									url: existingPrLink,
			// 								},
			// 							},
			// 						],
			// 					},
			// 				},
			// 			}),
			// 		),
			// 		http.patch("https://api.notion.com/v1/pages/:pageId", () => {
			// 			throw new Error(
			// 				"Notion API should not be called when all links already exist",
			// 			);
			// 		}),
			// 	);
			//
			// 	const prLinks = [existingPrLink, existingPrLink] as const;
			//
			// 	return Effect.withConfigProvider(
			// 		Effect.gen(function* () {
			// 			const notion = yield* Notion;
			//
			// 			const result = yield* notion.setNotionPrLinks(
			// 				MOCK_NOTION_PAGE_ID,
			// 				prLinks,
			// 			);
			//
			// 			assert.deepEqual(result, {
			// 				pageId: MOCK_NOTION_PAGE_ID,
			// 				prLinks: [existingPrLink],
			// 			});
			// 		}).pipe(Effect.provide(NotionLive)),
			// 		AppConfigProviderTest,
			// 	);
			// });

			it.effect(
				"should skip the PR links update when dry-run is enabled",
				() => {
					server.resetHandlers();
					server.use(
						http.patch("https://api.notion.com/v1/pages/:pageId", () => {
							throw new Error(
								"Notion API should not be called when dry-run is enabled",
							);
						}),
					);

					const prLinks = [
						"https://github.com/ressio/github-notion/pull/3",
					] as const;

					return Effect.withConfigProvider(
						Effect.gen(function* () {
							const notion = yield* Notion;

							const result = yield* notion.setNotionPrLinks(
								MOCK_NOTION_PAGE_ID,
								prLinks,
							);

							assert.deepEqual(result, {
								pageId: MOCK_NOTION_PAGE_ID,
								prLinks: Array.from(prLinks),
							});
						}).pipe(Effect.provide(NotionLive)),
						AppConfigProviderDryRun,
					);
				},
			);
		});
	});
});

import { assert, describe, it } from "@effect/vitest";
import { ConfigProvider, Effect } from "effect";
import { http } from "msw";
import { MOCK_NOTION_PAGE_ID } from "#mocks/msw-handlers.ts";
import { server } from "#mocks/msw-server.ts";
import { Notion } from "#services/notion/api.ts";
import { NotionLive } from "#services/notion/service.ts";

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
	});
});

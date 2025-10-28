import { Context, type Effect } from "effect";
import type { ConfigError } from "effect/ConfigError";
import type { ParseError } from "effect/ParseResult";
import type { NotionRequestFailureError } from "#services/notion/errors.ts";
import type { NotionWorkflowStatus } from "#services/notion/schema.ts";

export class Notion extends Context.Tag("Notion")<
	Notion,
	{
		/**
		 * Data source ID discovery per 2025-09-03 upgrade guide:
		 * https://developers.notion.com/docs/upgrade-guide-2025-09-03#step-1-add-a-discovery-step-to-fetch-and-store-the-data_source_id
		 */
		// readonly getDataSourceIdFromDatabaseId: (
		// 	databaseId: string,
		// ) => Effect.Effect<string, ConfigError, never>;
		// TODO: ^^ keyed return?

		/**
		 * Gets and returns the Notion page ID for the given `unique_id`
		 * property
		 */
		readonly getByTaskIdProperty: (taskId: string) => Effect.Effect<
			{
				pageId: string;
			},
			ConfigError | ParseError | NotionRequestFailureError,
			never
		>;

		/**
		 * Sets the 'status' property of the given Notion page to the provided
		 * value
		 */
		readonly setNotionStatus: (
			pageId: string,
			status: NotionWorkflowStatus,
		) => Effect.Effect<
			{
				pageId: string;
				newStatus: NotionWorkflowStatus;
			},
			NotionRequestFailureError,
			never
		>;

		/**
		 * Adds the provided URLs to the 'PR links' property of the given Notion page,
		 * skipping any links that already exist.
		 */
		readonly setNotionPrLinks: (
			pageId: string,
			prLinks: ReadonlyArray<string>,
		) => Effect.Effect<
			{
				pageId: string;
				prLinks: ReadonlyArray<string>;
			},
			NotionRequestFailureError,
			never
		>;
	}
>() {}

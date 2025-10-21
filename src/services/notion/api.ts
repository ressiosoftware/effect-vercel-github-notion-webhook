import { Context, type Effect } from "effect";
import type { ConfigError } from "effect/ConfigError";
import type { ParseError } from "effect/ParseResult";
import type { NotionRequestFailureError } from "#services/notion/errors.ts";

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
			status: "In progress" | "In review",
		) => Effect.Effect<
			{
				pageId: string;
				newStatus: "In progress" | "In review";
			},
			NotionRequestFailureError,
			never
		>;
	}
>() {}

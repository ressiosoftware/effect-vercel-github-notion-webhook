import { types } from "node:util";
import { Client } from "@notionhq/client";
import { Effect, Layer, Redacted, Schema } from "effect";
import { AppConfig } from "#platform/schema.ts";
import { Notion } from "#services/notion/api.ts";
import { NotionRequestFailureError } from "#services/notion/errors.ts";
import { makeGenIdNumberFromString } from "#services/notion/schema.ts";

export const NotionLive = Layer.effect(
	Notion,

	Effect.gen(function* () {
		const {
			notionToken,
			notionDatabaseId,
			notionTaskIdProperty,
			notionTaskIdPrefix,
			notionDryRun,
		} = yield* AppConfig;

		// Create the schema with the prefix from config
		const GenIdNumberFromString = makeGenIdNumberFromString(notionTaskIdPrefix);

		const notion = new Client({
			auth: Redacted.value(notionToken),
		});

		/**
		 * Data source ID discovery per 2025-09-03 upgrade guide:
		 * https://developers.notion.com/docs/upgrade-guide-2025-09-03#step-1-add-a-discovery-step-to-fetch-and-store-the-data_source_id
		 *
		 * NOTE: technically we can skip this by just using a known data source ID, but
		 * leaving it in for intentionally-added complexity (learning)
		 */
		const getDataSourceIdFromDatabaseId = Effect.fn(
			"getDataSourceIdFromDatabaseId",
		)(function* (databaseId: string) {
			/** raw result from notion api */
			const rawDataSourcesResult = yield* Effect.tryPromise({
				try: () =>
					notion.request({
						method: "get",
						path: `databases/${databaseId}`,
					}),

				catch(error) {
					return new NotionRequestFailureError({
						reason: types.isNativeError(error)
							? error.message
							: "Unknown Notion error",
					});
				},
			});

			const DataSourceSchema = Schema.Struct({
				object: Schema.Literal("database"),
				id: Schema.String,
				title: Schema.Array(Schema.Unknown),
				description: Schema.Array(Schema.Unknown),
				parent: Schema.Struct({
					type: Schema.Literal("block_id"),
					block_id: Schema.String,
				}),
				is_inline: Schema.Boolean,
				in_trash: Schema.Boolean,
				is_locked: Schema.Boolean,
				created_time: Schema.DateFromString,
				last_edited_time: Schema.DateFromString,
				data_sources: Schema.Array(
					Schema.Struct({
						id: Schema.String,
						name: Schema.String,
					}),
				),
				icon: Schema.NullOr(Schema.String),
				cover: Schema.NullOr(Schema.String),
				url: Schema.String,
				public_url: Schema.NullOr(Schema.String),
				request_id: Schema.String,
			});

			const dataSources =
				yield* Schema.decodeUnknown(DataSourceSchema)(rawDataSourcesResult);

			// "naiivly" getting 1st data source
			const [{ id: dataSourceId }] = dataSources.data_sources;

			return dataSourceId;
		});

		return {
			getByTaskIdProperty: Effect.fn("getByTaskIdProperty")(function* (
				/** Full "Task ID" for record in in the "Tasks" database
				 * @example `GEN-6250` */
				taskId: string,
			) {
				const dataSourceId =
					yield* getDataSourceIdFromDatabaseId(notionDatabaseId);

				yield* Effect.log(
					`🪵 Notion#getByTaskIdProperty() called with taskId:${taskId}, extracting the number...`,
					taskId,
				);

				const taskIdNumber = yield* Schema.decodeUnknown(GenIdNumberFromString)(
					taskId,
				);

				yield* Effect.log(
					"🪵 Notion#getByTaskIdProperty() task id number extracted:",
					taskIdNumber,
				);

				const result = yield* Effect.tryPromise({
					try: () =>
						notion.dataSources.query({
							data_source_id: dataSourceId,

							filter: {
								and: [
									{
										property: notionTaskIdProperty, // name of property from environment variable

										// the generated IDs are a called "unique_id" in notion's API
										unique_id: {
											equals: taskIdNumber,
										},
									},
								],
							},

							filter_properties: [
								// only get subset of properties
								"title",
								"notion://tasks/status_property",
							],
						}),
					catch(error) {
						return new NotionRequestFailureError({
							reason: types.isNativeError(error)
								? error.message
								: "Unknown Notion error",
						});
					},
				});

				const {
					// object: objectKind,
					results: pageResults,
				} = result;

				// TODO: "naiivly" assume first result
				const [{ id: pageId }] = pageResults;

				// TODO: real return shape
				return {
					pageId,
				};
			}),

			setNotionStatus: Effect.fn("setNotionStatus")(function* (
				/** Full "Task ID" for record in in the "Tasks" database
				 * @example `GEN-6250` */
				pageId: string,
				status: string,
			) {
				// TODO: there's definitely a cleverer way to do this swapperoo;
				// probably conditionally swapping out the notion client
				// or the layer rather than conditionally checking config here?
				if (notionDryRun) {
					yield* Effect.log("🪵 [dry-run] Notion#setNotionStatus() skipped", {
						pageId,
						status,
					});

					return {
						pageId,
						newStatus: status,
					};
				}

				yield* Effect.tryPromise({
					try: () =>
						notion.pages.update({
							page_id: pageId,
							properties: {
								Status: {
									status: {
										name: status,
									},
								},
							},
						}),

					catch(error) {
						return new NotionRequestFailureError({
							reason: types.isNativeError(error)
								? error.message
								: "Unknown Notion error",
						});
					},
				});

				// yield* Effect.log(
				//     "🪵 Notion#setNotionStatus() performed notion.pages.update, result:",
				//     result,
				// );

				// TODO: real return shape
				return {
					pageId,
					newStatus: status,
				};
			}),
		} as const;
	}),
);

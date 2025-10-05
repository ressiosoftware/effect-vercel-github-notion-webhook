import { HttpResponse, http } from "msw";

export const MOCK_NOTION_PAGE_ID = "mock-notion-page-id" as const;
export const MOCK_DATA_SOURCE_ID = "mock-data-source-id" as const;

// MSW handlers
// TODO: use Schemas for these handlers
export const handlers = [
	// Mock database endpoint to get data source ID
	http.get("https://api.notion.com/v1/databases/:databaseId", () =>
		HttpResponse.json({
			object: "database",
			id: "notion-database-id-test",
			title: [],
			description: [],
			parent: {
				type: "block_id",
				// biome-ignore lint/style/useNamingConvention: Notion API uses snake_case
				block_id: "block-id-test",
			},
			// biome-ignore lint/style/useNamingConvention: Notion API uses snake_case
			is_inline: false,
			// biome-ignore lint/style/useNamingConvention: Notion API uses snake_case
			in_trash: false,
			// biome-ignore lint/style/useNamingConvention: Notion API uses snake_case
			is_locked: false,
			// biome-ignore lint/style/useNamingConvention: Notion API uses snake_case
			created_time: new Date().toISOString(),
			// biome-ignore lint/style/useNamingConvention: Notion API uses snake_case
			last_edited_time: new Date().toISOString(),
			// biome-ignore lint/style/useNamingConvention: Notion API uses snake_case
			data_sources: [
				{
					id: MOCK_DATA_SOURCE_ID,
					name: "Data source test",
				},
			],
			icon: null,
			cover: null,
			url: "https://notion.so/test",
			// biome-ignore lint/style/useNamingConvention: Notion API uses snake_case
			public_url: null,
			// biome-ignore lint/style/useNamingConvention: Notion API uses snake_case
			request_id: "request-id-test",
		}),
	),

	// Mock data sources query endpoint
	http.post(
		"https://api.notion.com/v1/data_sources/:dataSourceId/query",
		({ request: _request }) => {
			// const body = await request.json();

			// Return a successful response with a mock page
			return HttpResponse.json({
				object: "list",
				results: [
					{
						id: MOCK_NOTION_PAGE_ID,
						// Add other properties as needed
					},
				],
			});
		},
	),

	// Mock pages update endpoint
	http.patch("https://api.notion.com/v1/pages/:pageId", () =>
		HttpResponse.json({
			id: MOCK_NOTION_PAGE_ID,
		}),
	),
];

import { Config, Schema } from "effect";

// Configuration
export const AppConfig = Config.all({
	// secrets
	githubWebhookSecret: Config.redacted("GITHUB_WEBHOOK_SECRET"),
	notionToken: Config.redacted("NOTION_TOKEN"),
	notionDatabaseId: Config.string("NOTION_DATABASE_ID"),

	// tertiary information
	nodeEnv: Config.withDefault(Config.string("NODE_ENV"), "development"),
	apiVersion: Config.withDefault(Config.string("API_VERSION"), "0.0.0"),
	otelExporterOtlpTracesEndpoint: Config.string(
		"OTEL_EXPORTER_OTLP_TRACES_ENDPOINT",
	),
});

// Define HTTP method schema
export const HttpMethod = Schema.Union(
	Schema.Literal("GET"),
	Schema.Literal("POST"),
);

// Request validation schemas
export const GetRequestSchema = Schema.Struct({
	method: Schema.Literal("GET"),
	headers: Schema.Struct({
		"user-agent": Schema.optional(Schema.String),
	}),
	query: Schema.optional(
		Schema.Struct({
			health: Schema.optional(Schema.String),
			version: Schema.optional(Schema.String),

			// detailed: Schema.optional(
			//     Schema.String.pipe(
			//         Schema.transform(Schema.Boolean, {
			//             decode: (s) => s.toLowerCase() === "true",
			//             encode: (b) => b.toString(),
			//         }),
			//     ),
			// ),
			// TIL: Vercel will parse "true"/"false" queryparams as bools
			detailed: Schema.optional(Schema.Boolean),
			// NOTE: should probably be using types from Vercel directly here,
			// or something?
		}),
	),
});

export const PostRequestSchema = Schema.Struct({
	method: Schema.Literal("POST"),
	headers: Schema.Struct({
		"x-github-event": Schema.String,
		"x-github-delivery": Schema.optional(Schema.String),
		"x-hub-signature-256": Schema.optional(Schema.String),
		"content-type": Schema.optional(Schema.String),
	}),
	body: Schema.Unknown, // Will be validated separately with GitHub schema
});

// Request envelope schema that combines both
export const RequestEnvelopeSchema = Schema.Union(
	GetRequestSchema,
	PostRequestSchema,
);

// Extract types
export type ValidatedRequest = Schema.Schema.Type<typeof RequestEnvelopeSchema>;
export type GetRequest = Schema.Schema.Type<typeof GetRequestSchema>;
export type PostRequest = Schema.Schema.Type<typeof PostRequestSchema>;
export type RequestEnvelope = Schema.Schema.Type<typeof RequestEnvelopeSchema>;

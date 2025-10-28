import { ParseResult, Schema } from "effect";
import { GitHubPullRequest } from "#services/github/schema.ts";
import { types } from "node:util";

/** Factory function to create a schema that extracts task IDs from PR title and branch name;
 * handles dedupe + case-insensitivity
 */
export const makeGenIdFromPullRequest = (taskIdPrefix: string) =>
	Schema.transformOrFail(
		// source: subset of GitHubPullRequest
		GitHubPullRequest.pick("title", "head"),

		// target: expect PREFIX-####
		Schema.Array(Schema.String),

		{
			// optional, but better error messages from TypeScript
			strict: true,

			decode: (githubPullRequest) => {
				// Create regex pattern dynamically using the prefix
				const taskIdPattern = new RegExp(`${taskIdPrefix}-\\d+`, "gi");

				const genMatches = Array.from(
					new Set([
						...(githubPullRequest.title.match(taskIdPattern) ?? []).map((m) =>
							// normalize casing
							m.toUpperCase(),
						),
						...(githubPullRequest.head.ref.match(taskIdPattern) ?? []).map(
							(m) =>
								// normalize casing
								m.toUpperCase(),
						),
					]),
				) satisfies Array<string>;

				if (genMatches.length > 0) {
					return ParseResult.succeed(genMatches);
				}

				// not all PRs will have the pattern in it;
				// empty array is a totally valid result
				return ParseResult.succeed([] as const);
			},

			encode: (genId, _, ast) =>
				ParseResult.fail(
					new ParseResult.Forbidden(
						ast,
						genId,
						`Encoding Array<${taskIdPrefix}-####> to GitHubPullRequestWebhookData not supported`,
					),
				),
		},
	);

/** The Notion statuses determined by the workflow / PR state */
export const NotionWorkflowStatusSchema = Schema.Literal(
	"In progress",
	"In review",
	"PR merged",
);

export type NotionWorkflowStatus = typeof NotionWorkflowStatusSchema.Type;

// WARN: hardcoded to these for now, could be options/env
export const NotionWorkflowStatus = {
	InProgress: "In progress",
	InReview: "In review",
	PRMerged: "PR merged",
} as const satisfies Record<string, NotionWorkflowStatus>;

/** Schema to determine the notion status from a github PR */
export const NotionStatusFromPullRequestSchema = Schema.transformOrFail(
	// source: subset of GitHubPullRequest
	GitHubPullRequest.pick("draft", "merged"),

	// target: the notion status string
	NotionWorkflowStatusSchema,

	{
		// optional, but better error messages from TypeScript
		strict: true,

		decode: (githubPullRequest) => {
			if (githubPullRequest.merged) {
				return ParseResult.succeed(NotionWorkflowStatus.PRMerged);
			}

			if (githubPullRequest.draft) {
				return ParseResult.succeed(NotionWorkflowStatus.InProgress);
			}

			return ParseResult.succeed(NotionWorkflowStatus.InReview);
		},

		encode: (toI, _, ast) =>
			ParseResult.fail(
				new ParseResult.Forbidden(
					ast,
					toI,
					"Encoding to GitHubPullRequest from Notion statuses not supported",
				),
			),
	},
);

/** Factory function to create a schema that extracts number from full task ID */
export const makeGenIdNumberFromString = (taskIdPrefix: string) =>
	Schema.transformOrFail(
		// source: accept string
		Schema.String,

		// target: expect number
		Schema.NumberFromString,

		{
			// optional, but better error messages from TypeScript
			strict: true,

			decode: (input, _, ast) => {
				const [, taskIdNumber] = input.split("-");
				const parsed = Number(taskIdNumber);
				if (Number.isNaN(parsed)) {
					return ParseResult.fail(
						new ParseResult.Type(
							ast,
							input,
							"Failed to convert string to number",
						),
					);
				}

				return ParseResult.succeed(taskIdNumber);
			},

			encode: (numString) =>
				ParseResult.succeed(`${taskIdPrefix}-${numString}`),
		},
	);

export const NotionExternalFileAttachmentSchema = Schema.Struct({
	name: Schema.String,
	type: Schema.Literal("external"),
	external: Schema.Struct({
		url: Schema.String,
	}),
});

export const NotionHostedFileAttachmentSchema = Schema.Struct({
	name: Schema.String,
	type: Schema.Literal("file"),
	file: Schema.Struct({
		url: Schema.String,
		expiry_time: Schema.optional(Schema.String),
	}),
});

export const NotionFileAttachmentSchema = Schema.Union(
	NotionExternalFileAttachmentSchema,
	NotionHostedFileAttachmentSchema,
);

export type NotionFileAttachment = Schema.Schema.Type<
	typeof NotionFileAttachmentSchema
>;

const NotionFilesPropertySchema = Schema.Struct({
	type: Schema.Literal("files"),
	files: Schema.Array(NotionFileAttachmentSchema),
});

const NotionPropertiesSchema = Schema.Struct({
	properties: Schema.Struct({
		// WARN: hardcoded to these for now, could be options/env
		"PR links": NotionFilesPropertySchema,
	}),
});

export const NotionPrLinksFilesSchema = Schema.transformOrFail(
	Schema.Unknown,
	Schema.Array(NotionFileAttachmentSchema),
	{
		strict: true,
		decode: (input, _, ast) => {
			try {
				const {
					properties: { "PR links": prLinksProp },
				} = Schema.decodeUnknownSync(NotionPropertiesSchema)(input);

				// paranoia: ensure it's the expected "files" type
				if (prLinksProp.type !== "files") {
					return ParseResult.fail(
						new ParseResult.Type(
							ast,
							prLinksProp,
							`Expected "PR links" to be a files property, got type=${prLinksProp.type}`,
						),
					);
				}

				const attachments = prLinksProp.files;

				return ParseResult.succeed(attachments);
			} catch (err) {
				const errMessage = types.isNativeError(err)
					? err.message
					: "Unknown error";

				return ParseResult.fail(
					new ParseResult.Type(
						ast,
						input,
						`Failed to read "PR links" files: ${errMessage}`,
					),
				);
			}
		},
		encode: (_files, _, ast) =>
			// ⚠️ you said encode isn’t supported; keep that explicit
			ParseResult.fail(
				new ParseResult.Forbidden(
					ast,
					_files,
					"Encoding Notion PR links files not supported",
				),
			),
	},
);

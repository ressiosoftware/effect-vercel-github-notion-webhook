import { ParseResult, Schema } from "effect";
import { GitHubPullRequest } from "./schemas.ts";

/** Extract all GEN-#### patterns from PR title and branch name;
 * handles dedupe + case-insensitivity
 */
export const GenIdFromPullRequest = Schema.transformOrFail(
	// source: subset of GitHubPullRequest
	GitHubPullRequest.pick("title", "head"),

	// target: expect GEN-####
	Schema.Array(Schema.String),

	{
		// optional, but better error messages from TypeScript
		strict: true,

		decode: (githubPullRequest) => {
			const genMatches = Array.from(
				new Set([
					...(githubPullRequest.title.match(/GEN-\d+/gi) ?? []).map((m) =>
						// normalize casing
						m.toUpperCase(),
					),
					...(githubPullRequest.head.ref.match(/GEN-\d+/gi) ?? []).map((m) =>
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
					"Encoding Array<GEN-####> to GitHubPullRequestWebhookData not supported",
				),
			),
	},
);

// Schema to extract number from full task ID
// TODO: is this the best way to accomplish this "number from substring" problem?
export const GenIdNumberFromString = Schema.transformOrFail(
	// source: accept string
	Schema.String,
	// TODO: play with Schema.pattern ?
	// Schema.pattern(/^GEN-\d+$/),

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

		encode: (numString) => {
			// FUTURE: hardcoded GEN
			return ParseResult.succeed(`GEN-${numString}`);
		},
	},
);

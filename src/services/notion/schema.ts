import { ParseResult, Schema } from "effect";
import { GitHubPullRequest } from "#services/github/schema.ts";

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

import { Config, Schema } from "effect";

// Configuration
export const AppConfig = Config.all({
	// secrets
	githubWebhookSecret: Config.redacted("GITHUB_WEBHOOK_SECRET"),
	notionToken: Config.redacted("NOTION_TOKEN"),

	// tertiary information
	nodeEnv: Config.withDefault(Config.string("NODE_ENV"), "development"),
	apiVersion: Config.withDefault(Config.string("API_VERSION"), "0.0.0"),
	otelExporterOtlpTracesEndpoint: Config.string(
		"OTEL_EXPORTER_OTLP_TRACES_ENDPOINT",
	),
});

// GitHub Pull Request Action types
export const PullRequestAction = Schema.Union(
	Schema.Literal("opened"),
	Schema.Literal("closed"),
	Schema.Literal("edited"),
	Schema.Literal("reopened"),
	Schema.Literal("synchronize"),
	Schema.Literal("ready_for_review"),
	Schema.Literal("converted_to_draft"),
	Schema.Literal("assigned"),
	Schema.Literal("unassigned"),
	Schema.Literal("review_requested"),
	Schema.Literal("review_request_removed"),
	Schema.Literal("labeled"),
	Schema.Literal("unlabeled"),
).annotations({
	arbitrary: () => (fc) =>
		fc.constantFrom("opened", "closed", "synchronize", "edited"),
});

// User/Actor schema (used for sender, assignees, etc.)
export const GitHubUser = Schema.Struct({
	login: Schema.String.annotations({
		arbitrary: () => (fc) =>
			fc.constantFrom("testuser", "developer", "admin", "bot", "contributor"),
	}),
	id: Schema.Number.annotations({
		arbitrary: () => (fc) => fc.integer({ min: 1, max: 1_000_000 }),
	}),
	// biome-ignore lint/style/useNamingConvention: GitHub API uses snake_case
	node_id: Schema.String.annotations({
		arbitrary: () => (fc) =>
			fc.constantFrom("user_node1", "user_node2", "user_node3"),
	}),
	// biome-ignore lint/style/useNamingConvention: GitHub API uses snake_case
	avatar_url: Schema.String.annotations({
		arbitrary: () => (fc) =>
			fc.constant("https://github.com/images/error/testuser_happy.gif"),
	}),
	// biome-ignore lint/style/useNamingConvention: GitHub API uses snake_case
	gravatar_id: Schema.NullOr(Schema.String),
	url: Schema.String.annotations({
		arbitrary: () => (fc) =>
			fc.constantFrom(
				"https://api.github.com/users/testuser",
				"https://api.github.com/users/developer",
				"https://api.github.com/users/admin",
			),
	}),
	// biome-ignore lint/style/useNamingConvention: GitHub API uses snake_case
	html_url: Schema.String.annotations({
		arbitrary: () => (fc) =>
			fc.constantFrom(
				"https://github.com/testuser",
				"https://github.com/developer",
				"https://github.com/admin",
			),
	}),
	type: Schema.String.annotations({
		arbitrary: () => (fc) => fc.constantFrom("User", "Bot"),
	}),
	// biome-ignore lint/style/useNamingConvention: GitHub API uses snake_case
	site_admin: Schema.Boolean,
});

// Repository schema
export const GitHubRepository = Schema.Struct({
	id: Schema.Number.annotations({
		arbitrary: () => (fc) => fc.integer({ min: 1, max: 1_000_000 }),
	}),
	// biome-ignore lint/style/useNamingConvention: GitHub API uses snake_case
	node_id: Schema.String.annotations({
		arbitrary: () => (fc) =>
			fc.constantFrom("repo_node1", "repo_node2", "repo_node3"),
	}),
	name: Schema.String.annotations({
		arbitrary: () => (fc) =>
			fc.constantFrom(
				"test-repo",
				"webhook-handler",
				"github-integration",
				"api-service",
			),
	}),
	// biome-ignore lint/style/useNamingConvention: GitHub API uses snake_case
	full_name: Schema.String.annotations({
		arbitrary: () => (fc) =>
			fc.constantFrom(
				"testuser/test-repo",
				"developer/webhook-handler",
				"admin/github-integration",
			),
	}),
	private: Schema.Boolean,
	// biome-ignore lint/style/useNamingConvention: GitHub API uses snake_case
	html_url: Schema.String.annotations({
		arbitrary: () => (fc) =>
			fc.constantFrom(
				"https://github.com/testuser/test-repo",
				"https://github.com/developer/webhook-handler",
			),
	}),
	description: Schema.NullOr(Schema.String).annotations({
		arbitrary: () => (fc) =>
			fc.constantFrom(
				"Test repository for webhooks",
				"GitHub webhook handler service",
				null,
			),
	}),
	fork: Schema.Boolean,
	url: Schema.String.annotations({
		arbitrary: () => (fc) =>
			fc.constantFrom(
				"https://api.github.com/repos/testuser/test-repo",
				"https://api.github.com/repos/developer/webhook-handler",
			),
	}),
	// biome-ignore lint/style/useNamingConvention: GitHub API uses snake_case
	default_branch: Schema.String.annotations({
		arbitrary: () => (fc) => fc.constantFrom("main", "master", "develop"),
	}),
	owner: GitHubUser,
});

// Pull Request Head/Base branch info
export const GitHubPullRequestRef = Schema.Struct({
	label: Schema.String.annotations({
		arbitrary: () => (fc) =>
			fc.constantFrom(
				"testuser:feature-branch",
				"developer:fix-bug",
				"admin:main",
				"contributor:update-docs",
			),
	}),

	/** Effectively the branch name */
	ref: Schema.String.annotations({
		arbitrary: () => (fc) =>
			fc.constantFrom(
				// only care about GEN-#### branch names for now
				"GEN-100",
				"gen-101",
				"GEN-102_foo-branch-name",
			),
	}),
	sha: Schema.String.annotations({
		arbitrary: () => (fc) =>
			fc.constantFrom(
				"abc123def456",
				"def456abc123",
				"123abc456def",
				"456def123abc",
			),
	}),
	user: GitHubUser,
	repo: Schema.NullOr(GitHubRepository),
});

// Label schema
export const GitHubLabel = Schema.Struct({
	id: Schema.Number.annotations({
		arbitrary: () => (fc) => fc.integer({ min: 1, max: 100_000 }),
	}),
	// biome-ignore lint/style/useNamingConvention: GitHub API uses snake_case
	node_id: Schema.String.annotations({
		arbitrary: () => (fc) =>
			fc.constantFrom("label_node1", "label_node2", "label_node3"),
	}),
	url: Schema.String.annotations({
		arbitrary: () => (fc) =>
			fc.constantFrom(
				"https://api.github.com/repos/testuser/test-repo/labels/bug",
				"https://api.github.com/repos/testuser/test-repo/labels/enhancement",
			),
	}),
	name: Schema.String.annotations({
		arbitrary: () => (fc) =>
			fc.constantFrom(
				"bug",
				"enhancement",
				"documentation",
				"good first issue",
				"help wanted",
			),
	}),
	color: Schema.String.annotations({
		arbitrary: () => (fc) =>
			fc.constantFrom("d73a4a", "a2eeef", "0075ca", "7057ff", "008672"),
	}),
	default: Schema.Boolean,
	description: Schema.NullOr(Schema.String).annotations({
		arbitrary: () => (fc) =>
			fc.constantFrom(
				"Something isn't working",
				"New feature or request",
				"Improvements or additions to documentation",
				null,
			),
	}),
});

// Main Pull Request schema
export const GitHubPullRequest = Schema.Struct({
	id: Schema.Number.annotations({
		arbitrary: () => (fc) => fc.integer({ min: 1, max: 1_000_000 }),
	}),
	// biome-ignore lint/style/useNamingConvention: GitHub API uses snake_case
	node_id: Schema.String.annotations({
		arbitrary: () => (fc) =>
			fc.constantFrom("PR_node123", "PR_node456", "PR_node789"),
	}),
	number: Schema.Number.annotations({
		arbitrary: () => (fc) => fc.integer({ min: 1, max: 9999 }),
	}),
	state: Schema.Union(Schema.Literal("open"), Schema.Literal("closed")),
	locked: Schema.Boolean,
	title: Schema.String.annotations({
		arbitrary: () => (fc) =>
			fc.constantFrom(
				"[GEN-1] Fix critical bug in webhook handler",
				"Add new feature for PR validation [GEN-2, GEN-3]",
				"[GEN-4, GEN-5]Update documentation for API",
				"Refactor user authentication [GEN-6] and [GEN-7]",
				"Test PR for webhook integration [gen-8 + gen-9]",
			),
	}),
	body: Schema.NullOr(Schema.String).annotations({
		arbitrary: () => (fc) =>
			fc.constantFrom(
				"This PR fixes a critical issue with webhook processing",
				"Added comprehensive tests for the new feature",
				null,
				"Updated the documentation to reflect recent changes",
			),
	}),
	// biome-ignore lint/style/useNamingConvention: GitHub API uses snake_case
	created_at: Schema.DateFromString.annotations({
		arbitrary: () => (fc) =>
			fc
				.constantFrom(
					"2024-01-01T00:00:00Z",
					"2024-06-15T12:30:00Z",
					"2024-09-01T09:15:00Z",
					"2024-12-01T16:45:00Z",
				)
				.map((dateStr) => new Date(dateStr)),
	}),
	// biome-ignore lint/style/useNamingConvention: GitHub API uses snake_case
	updated_at: Schema.DateFromString.annotations({
		arbitrary: () => (fc) =>
			fc
				.constantFrom(
					"2024-01-02T10:00:00Z",
					"2024-06-16T14:30:00Z",
					"2024-09-02T11:15:00Z",
					"2024-12-02T18:45:00Z",
				)
				.map((dateStr) => new Date(dateStr)),
	}),
	// biome-ignore lint/style/useNamingConvention: GitHub API uses snake_case
	closed_at: Schema.NullOr(Schema.DateFromString).annotations({
		arbitrary: () => (fc) =>
			fc
				.constantFrom(null, "2024-01-03T15:00:00Z", "2024-06-17T16:30:00Z")
				.map((dateStr) => (dateStr ? new Date(dateStr) : null)),
	}),
	// biome-ignore lint/style/useNamingConvention: GitHub API uses snake_case
	merged_at: Schema.NullOr(Schema.DateFromString).annotations({
		arbitrary: () => (fc) =>
			fc
				.constantFrom(null, "2024-01-03T15:00:00Z", "2024-06-17T16:30:00Z")
				.map((dateStr) => (dateStr ? new Date(dateStr) : null)),
	}),
	// biome-ignore lint/style/useNamingConvention: GitHub API uses snake_case
	merge_commit_sha: Schema.NullOr(Schema.String).annotations({
		arbitrary: () => (fc) =>
			fc.constantFrom(null, "abc123def456", "def456abc123", "123abc456def"),
	}),
	draft: Schema.Boolean,
	// biome-ignore lint/style/useNamingConvention: GitHub API uses snake_case
	html_url: Schema.String.annotations({
		arbitrary: () => (fc) =>
			fc.constantFrom(
				"https://github.com/testuser/test-repo/pull/123",
				"https://github.com/developer/webhook-handler/pull/456",
			),
	}),
	url: Schema.String.annotations({
		arbitrary: () => (fc) =>
			fc.constantFrom(
				"https://api.github.com/repos/testuser/test-repo/pulls/123",
				"https://api.github.com/repos/developer/webhook-handler/pulls/456",
			),
	}),
	user: GitHubUser,
	assignee: Schema.NullOr(GitHubUser),
	assignees: Schema.Array(GitHubUser),
	labels: Schema.Array(GitHubLabel),
	head: GitHubPullRequestRef,
	base: GitHubPullRequestRef,
	merged: Schema.Boolean,
	mergeable: Schema.NullOr(Schema.Boolean),
	rebaseable: Schema.NullOr(Schema.Boolean),
	// biome-ignore lint/style/useNamingConvention: GitHub API uses snake_case
	mergeable_state: Schema.String.annotations({
		arbitrary: () => (fc) =>
			fc.constantFrom("clean", "dirty", "unstable", "blocked"),
	}),
	comments: Schema.Number.annotations({
		arbitrary: () => (fc) => fc.integer({ min: 0, max: 50 }),
	}),
	// biome-ignore lint/style/useNamingConvention: GitHub API uses snake_case
	review_comments: Schema.Number.annotations({
		arbitrary: () => (fc) => fc.integer({ min: 0, max: 20 }),
	}),
	// biome-ignore lint/style/useNamingConvention: GitHub API uses snake_case
	maintainer_can_modify: Schema.Boolean,
	commits: Schema.Number.annotations({
		arbitrary: () => (fc) => fc.integer({ min: 1, max: 10 }),
	}),
	additions: Schema.Number.annotations({
		arbitrary: () => (fc) => fc.integer({ min: 1, max: 500 }),
	}),
	deletions: Schema.Number.annotations({
		arbitrary: () => (fc) => fc.integer({ min: 0, max: 200 }),
	}),
	// biome-ignore lint/style/useNamingConvention: GitHub API uses snake_case
	changed_files: Schema.Number.annotations({
		arbitrary: () => (fc) => fc.integer({ min: 1, max: 20 }),
	}),
});

// Main GitHub PR Webhook Payload schema
export const GitHubPullRequestWebhook = Schema.Struct({
	action: PullRequestAction,
	number: Schema.Number,
	// biome-ignore lint/style/useNamingConvention: GitHub API uses snake_case
	pull_request: GitHubPullRequest,
	repository: GitHubRepository,
	sender: GitHubUser,
	// Optional fields that may appear based on action
	label: Schema.optional(GitHubLabel),
	assignee: Schema.optional(GitHubUser),
	// biome-ignore lint/style/useNamingConvention: GitHub API uses snake_case
	requested_reviewer: Schema.optional(GitHubUser),
	installation: Schema.optional(
		Schema.Struct({
			id: Schema.Number,
			// biome-ignore lint/style/useNamingConvention: GitHub API uses snake_case
			node_id: Schema.String,
		}),
	),
});

export type GitHubPrWebhookData = typeof GitHubPullRequestWebhook.Type;

// Define HTTP method schema
export const HttpMethod = Schema.Union(
	Schema.Literal("GET"),
	Schema.Literal("POST"),
);

// Request validation schemas
export const GetRequestSchema = Schema.Struct({
	method: Schema.Literal("GET"),
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
export const RequestEnvelope = Schema.Union(
	GetRequestSchema,
	PostRequestSchema,
);

// TODO: would this be useful?
export const ResponseEnvelope = Schema.Struct({
	statusCode: Schema.Number,
	body: Schema.Unknown, // TODO!
});

// Extract types
export type ValidatedRequest = Schema.Schema.Type<typeof RequestEnvelope>;
export type GetRequest = Schema.Schema.Type<typeof GetRequestSchema>;
export type PostRequest = Schema.Schema.Type<typeof PostRequestSchema>;

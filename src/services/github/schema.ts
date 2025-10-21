import { Schema } from "effect";

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
	node_id: Schema.String.annotations({
		arbitrary: () => (fc) =>
			fc.constantFrom("user_node1", "user_node2", "user_node3"),
	}),
	avatar_url: Schema.String.annotations({
		arbitrary: () => (fc) =>
			fc.constant("https://github.com/images/error/testuser_happy.gif"),
	}),
	gravatar_id: Schema.NullOr(Schema.String),
	url: Schema.String.annotations({
		arbitrary: () => (fc) =>
			fc.constantFrom(
				"https://api.github.com/users/testuser",
				"https://api.github.com/users/developer",
				"https://api.github.com/users/admin",
			),
	}),
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
	site_admin: Schema.Boolean,
});

// Repository schema
export const GitHubRepository = Schema.Struct({
	id: Schema.Number.annotations({
		arbitrary: () => (fc) => fc.integer({ min: 1, max: 1_000_000 }),
	}),
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
	full_name: Schema.String.annotations({
		arbitrary: () => (fc) =>
			fc.constantFrom(
				"testuser/test-repo",
				"developer/webhook-handler",
				"admin/github-integration",
			),
	}),
	private: Schema.Boolean,
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
	closed_at: Schema.NullOr(Schema.DateFromString).annotations({
		arbitrary: () => (fc) =>
			fc
				.constantFrom(null, "2024-01-03T15:00:00Z", "2024-06-17T16:30:00Z")
				.map((dateStr) => (dateStr ? new Date(dateStr) : null)),
	}),
	merged_at: Schema.NullOr(Schema.DateFromString).annotations({
		arbitrary: () => (fc) =>
			fc
				.constantFrom(null, "2024-01-03T15:00:00Z", "2024-06-17T16:30:00Z")
				.map((dateStr) => (dateStr ? new Date(dateStr) : null)),
	}),
	merge_commit_sha: Schema.NullOr(Schema.String).annotations({
		arbitrary: () => (fc) =>
			fc.constantFrom(null, "abc123def456", "def456abc123", "123abc456def"),
	}),
	draft: Schema.Boolean,
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
	mergeable_state: Schema.String.annotations({
		arbitrary: () => (fc) =>
			fc.constantFrom("clean", "dirty", "unstable", "blocked"),
	}),
	comments: Schema.Number.annotations({
		arbitrary: () => (fc) => fc.integer({ min: 0, max: 50 }),
	}),
	review_comments: Schema.Number.annotations({
		arbitrary: () => (fc) => fc.integer({ min: 0, max: 20 }),
	}),
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
	changed_files: Schema.Number.annotations({
		arbitrary: () => (fc) => fc.integer({ min: 1, max: 20 }),
	}),
});

// Main GitHub PR Webhook Payload schema
export const GitHubPullRequestWebhook = Schema.Struct({
	action: PullRequestAction,
	number: Schema.Number,
	pull_request: GitHubPullRequest,
	repository: GitHubRepository,
	sender: GitHubUser,
	// Optional fields that may appear based on action
	label: Schema.optional(GitHubLabel),
	assignee: Schema.optional(GitHubUser),
	requested_reviewer: Schema.optional(GitHubUser),
	installation: Schema.optional(
		Schema.Struct({
			id: Schema.Number,
			node_id: Schema.String,
		}),
	),
});

export type GitHubPrWebhookData = typeof GitHubPullRequestWebhook.Type;

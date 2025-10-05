import { assert, describe, it } from "@effect/vitest";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { Effect } from "effect";
import handler from "#api/webhook.ts";

describe("api/webhook.ts", () => {
	describe("vercel fn handler", () => {
		// ensure that basic GET requests work
		// TODO: probably need to rework handler a little to make this more testable?
		it.todo("should handle a GET request", () =>
			it.flakyTest(
				// WARN: this isn't actually flaky;
				// i'm just showing off the flakyTest feature (for kitchen sink demo)
				Effect.gen(function* () {
					const mockRequest = {
						method: "GET",
						headers: {},
						query: {},
					} as any as VercelRequest;

					const HttpOk = 200 as const;
					const mockResponse = {
						statusCode: HttpOk,
						status: (_code: number) => ({
							json: (_data: any) => Promise.resolve(),
						}),
						json: (_data: any) => Promise.resolve(),
						// biome-ignore lint/suspicious/noEmptyBlockStatements: Mock function doesn't need implementation
						setHeader: () => {},
						get headersSent() {
							return false;
						},
					} as any as VercelResponse;

					// Test the handler
					// TODO: this ... fails right? like, because i can't provide the program with reqs... hmm
					yield* Effect.tryPromise({
						try: () => handler(mockRequest, mockResponse),
						catch: (error) => new Error(`Handler failed: ${error}`),
					});

					// Assert the results using Effect's assert
					// TODO: this is wrong, i'm just asserting against constants lol.
					// assert.strictEqual(mockResponse.statusCode, HttpOk);
					// assert.isDefined(mockResponse.json);
				}),

				// NOTE: since it's flaky, just
				// try until timeout (or success 🤞)
				"4.2 seconds", // timeout
			),
		);

		// TODO: probably need to rework handler a lil to make this more testable?
		it.todo("should handle malformed webhook gracefully", () =>
			Effect.gen(function* () {
				const malformedRequest = {
					method: "POST" as const,
					headers: { "x-github-event": "invalid_event" },
					body: {
						/* malformed data */
					},
				} as any as VercelRequest;

				const HttpOk = 200 as const;
				const mockResponse = {
					statusCode: HttpOk,
					status: (_code: number) => ({
						json: (_data: any) => Promise.resolve(),
					}),
					json: (_data: any) => Promise.resolve(),
					// biome-ignore lint/suspicious/noEmptyBlockStatements: Mock function doesn't need implementation
					setHeader: () => {},
					get headersSent() {
						return false;
					},
				} as any as VercelResponse;

				yield* Effect.tryPromise({
					try: () => handler(malformedRequest, mockResponse),
					catch: () => {
						assert.fail("Handler shouldn't throw an error");
					},
				});
			}),
		);
	});
});

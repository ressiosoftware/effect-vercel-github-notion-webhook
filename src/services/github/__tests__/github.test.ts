import crypto from "node:crypto";
import { assert, describe, it } from "@effect/vitest";
import { Effect, Redacted } from "effect";
import { validateWebhookSignature } from "#services/github/service.ts";

describe("signature validation", () => {
	it.effect("should validate a valid signature", () => {
		const body = { foo: "bar" };
		const secret = Redacted.make("local-secret");

		console.log({
			secret,
			decoded: Redacted.value(secret),
		});

		// Generate a valid signature
		const signature = `sha256=${crypto
			.createHmac("sha256", Redacted.value(secret))
			.update(JSON.stringify(body))
			.digest("hex")}`;

		return validateWebhookSignature(body, signature, secret);
	});

	it.effect("should reject an invalid signature", () =>
		Effect.try({
			try: () =>
				validateWebhookSignature(
					// body
					{ foo: "bar" },
					// signature
					"sha256=this-is-a-fake-signature",
					// secret
					Redacted.make("github-webhook-secret-test"),
				),
			catch: () => {
				assert.fail("Handler should not throw an error");
			},
		}),
	);
});

import { Effect, Schema } from "effect";
import { RequestEnvelopeSchema } from "#platform/schema.ts";
import { routeValidatedRequest } from "#services/github/service.ts";
import { VercelHttpContext } from "#services/vercel/types.ts";

export const program = Effect.fn("api/webhook.ts#program", {
	// just learning/seeing how attrs show up in traces
	attributes: {
		foo: "bar",
	},
})(function* () {
	yield* Effect.log("🚀 Program started");

	const {
		request,
		// response,
	} = yield* VercelHttpContext;

	yield* Effect.log("🚀 Request received", {
		method: request.method,
	});

	// TODO/WARN: bad name; not valid yet just structured
	const validRequest = yield* Schema.decodeUnknown(RequestEnvelopeSchema)(
		request,
	);

	const result = yield* routeValidatedRequest(validRequest);

	Effect.runSync(Effect.logInfo("🏁 Request routed, returning result..."));

	return result;
});

import { afterAll, afterEach, beforeAll } from "@effect/vitest";
import { server } from "#mocks/msw-server.js";

// start msw server before all tests
beforeAll(() =>
	server.listen({
		// catch missed requests
		onUnhandledRequest: "error",
	}),
);

// reset handlers after each test
afterEach(() => server.resetHandlers());

// cleanup after all tests
afterAll(() => server.close());

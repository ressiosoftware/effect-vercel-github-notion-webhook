import { Effect } from "effect";

// the main "tradeoff" of `Effect.Service`'s convenience is largely that it
// more implicitly couples your interface with the implementation.
// i.e. the service is AIO instead of interface + repo (implementation)
// - interface: https://github.com/Effect-TS/examples/blob/main/templates/monorepo/packages/domain/src/TodosApi.ts
// - repo: https://github.com/Effect-TS/examples/blob/main/templates/monorepo/packages/server/src/TodosRepository.ts
// export class Notion extends Effect.Service<Notion>()("Notion", {
export class SystemInfo extends Effect.Service<SystemInfo>()("SystemInfo", {
	sync: () => ({
		getUptime: () => process.uptime(),
		getMemoryUsage: () => process.memoryUsage(),
		getNodeVersion: () => process.version,
	}),
}) {}

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { Effect } from "effect";

export class VercelHttpContext extends Effect.Tag("VercelHttpContext")<
	VercelHttpContext,
	{
		request: VercelRequest;
		response: VercelResponse;
	}
>() {}

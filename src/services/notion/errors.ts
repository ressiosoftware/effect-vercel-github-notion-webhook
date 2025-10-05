import { Data } from "effect";

export class NotionRequestFailureError extends Data.TaggedError(
	"NotionRequestFailureError",
)<{
	reason: string;
}> {}

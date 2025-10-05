import { Data } from "effect";

export class UnsupportedMethodError extends Data.TaggedError(
	"UnsupportedMethodError",
)<{
	method: string;
	supported: Array<string>;
}> {}

export class InvalidRequestError extends Data.TaggedError(
	"InvalidRequestError",
)<{
	reason: string;
	details?: unknown;
}> {}

export class SignatureFailureError extends Data.TaggedError(
	"SignatureFailureError",
)<{
	reason: string;
}> {}

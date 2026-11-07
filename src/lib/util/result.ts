/**
 * An expected failure is a value, not an exception.
 *
 * @see BUILD_PLAN §15.3
 */
export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

/** Ends an exhaustive `switch`: the compiler rejects a missed case. @see BUILD_PLAN §15.2 */
export function assertNever(value: never): never {
	throw new Error(`Unexpected value: ${JSON.stringify(value)}`);
}

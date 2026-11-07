/** One structured reason behind an engine decision. @see BUILD_PLAN §11.5 */
export interface TraceEntry {
	rule: string;
	[detail: string]: unknown;
}

/** What engine functions return, so callers can explain a decision. @see BUILD_PLAN §11.5 */
export interface Traced<T> {
	result: T;
	trace: TraceEntry[];
}

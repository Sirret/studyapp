/**
 * A duration in minutes as students read it: "45 min", "1 h", "1 h 8 min". Whole minutes,
 * rounded up, never in rounded hours (Decisions "UX fix: one plan verdict").
 */
export function durationText(minutes: number): string {
	const whole = Math.max(0, Math.ceil(minutes));
	if (whole < 60) return `${whole} min`;
	const hours = Math.floor(whole / 60);
	const rest = whole % 60;
	return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

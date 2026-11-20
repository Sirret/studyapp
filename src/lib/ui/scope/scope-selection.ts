/**
 * The scope picker's selection rules. A pick is a section id, or a topic id for a topic with no
 * sections. Ticking a topic ticks all its sections; the stored scope lists a topic when all of it
 * is picked and single sections otherwise; everything picked is the whole course ("Study all").
 *
 * @see SESSION_NOTES J; Decisions log "Phase 8.6 Q12"; DESIGN §7 ChecklistRow (scope picker)
 */
import type { ScopeService, ScopeTopicView, ScopeView } from '#lib/services/scope-service.ts';

export type Picks = ReadonlySet<string>;
export type TopicPick = 'all' | 'some' | 'none';
type Scope = Parameters<ScopeService['set']>[1];

/** The ids a topic stands for: its sections, or the topic itself when it has none. */
function unitsOf(topic: ScopeTopicView): string[] {
	return topic.sections.length === 0 ? [topic.id] : topic.sections.map((s) => s.id);
}

/** The picks the stored scope implies (the view's `checked` flags). */
export function initialPicks(view: ScopeView): Set<string> {
	const picks = new Set<string>();
	for (const topic of view.tree) {
		if (topic.sections.length === 0) {
			if (topic.checked) picks.add(topic.id);
		} else {
			for (const s of topic.sections) if (s.checked) picks.add(s.id);
		}
	}
	return picks;
}

/** Whether all, some or none of a topic is picked. */
export function topicPick(topic: ScopeTopicView, picks: Picks): TopicPick {
	const units = unitsOf(topic);
	const count = units.filter((id) => picks.has(id)).length;
	if (count === 0) return 'none';
	return count === units.length ? 'all' : 'some';
}

/** Ticks every section of the topic, or unticks them all when all were ticked. */
export function toggleTopic(topic: ScopeTopicView, picks: Picks): Set<string> {
	const next = new Set(picks);
	const on = topicPick(topic, picks) !== 'all';
	for (const id of unitsOf(topic)) {
		if (on) next.add(id);
		else next.delete(id);
	}
	return next;
}

/** Ticks or unticks one section. */
export function toggleSection(id: string, picks: Picks): Set<string> {
	const next = new Set(picks);
	if (next.has(id)) next.delete(id);
	else next.add(id);
	return next;
}

/** Everything picked ("Study all"), or nothing. */
export function pickAll(view: ScopeView, on: boolean): Set<string> {
	return on ? new Set(view.tree.flatMap(unitsOf)) : new Set();
}

/** Every topic is wholly picked. */
export function isAll(view: ScopeView, picks: Picks): boolean {
	return view.tree.every((topic) => topicPick(topic, picks) === 'all');
}

/** Topics with anything picked. */
export function pickedTopics(view: ScopeView, picks: Picks): number {
	return view.tree.filter((topic) => topicPick(topic, picks) !== 'none').length;
}

/**
 * The scope to store: empty lists for the whole course, else wholly picked topics as topic ids and
 * partly picked topics as their picked section ids. Null when nothing is picked (nothing to study).
 */
export function toScope(view: ScopeView, picks: Picks): Scope | null {
	if (pickedTopics(view, picks) === 0) return null;
	if (isAll(view, picks)) return { topicIds: [], chunkIds: [] };
	const scope: Scope = { topicIds: [], chunkIds: [] };
	for (const topic of view.tree) {
		const pick = topicPick(topic, picks);
		if (pick === 'all') scope.topicIds.push(topic.id);
		if (pick === 'some') {
			scope.chunkIds.push(...topic.sections.filter((s) => picks.has(s.id)).map((s) => s.id));
		}
	}
	return scope;
}

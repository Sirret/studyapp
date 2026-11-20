import { describe, expect, it } from 'vitest';
import { HINT_WORDS } from '#lib/config/defaults.ts';
import { checkMeta, hintLabel } from '#lib/exercises/exercise-ui.ts';
import { preTickedKeyWords } from '#lib/services/exercise-helpers.ts';
import type { ScopeView } from '#lib/services/scope-service.ts';
import type { ExerciseShape } from '#lib/services/study-types.ts';
import { deckDone, deckKey, rateCard, startDeck, topCard } from '#lib/ui/flashcards/deck-state.ts';
import { markSection, paragraphsOf } from '#lib/ui/reader/mark-terms.ts';
import {
	initialPicks,
	isAll,
	pickAll,
	pickedTopics,
	toScope,
	toggleSection,
	toggleTopic,
	topicPick
} from '#lib/ui/scope/scope-selection.ts';

describe('hintLabel (Decisions log Phase 8.6 Q10)', () => {
	it('labels the shapes that have a micro hint', () => {
		expect(hintLabel('type')).toBe('Hint · first letters');
		expect(hintLabel('ideaUnit')).toBe('Hint · first letters');
		expect(hintLabel('list')).toBe(`Hint · first ${HINT_WORDS} words of the list`);
		expect(hintLabel('choose')).toBe('Hint · remove one wrong answer');
	});

	it('has no label where the engine gives no hint', () => {
		const none: ExerciseShape[] = ['chooseMany', 'order', 'pair', 'sort', 'selfRate', 'study'];
		for (const shape of none) expect(hintLabel(shape)).toBeNull();
	});
});

describe('checkMeta (DESIGN §7 PawButton meta, list card)', () => {
	it('counts picks on a tap-pick list card', () => {
		expect(checkMeta({ shape: 'list', typed: [], picked: [0, 3, 5] })).toBe('3 picked');
	});

	it('is absent with nothing picked, for typed lists and other shapes', () => {
		expect(checkMeta(null)).toBeUndefined();
		expect(checkMeta({ shape: 'list', typed: [], picked: [] })).toBeUndefined();
		expect(checkMeta({ shape: 'list', typed: ['a'], picked: [] })).toBeUndefined();
		expect(checkMeta({ shape: 'type', typed: 'x' })).toBeUndefined();
	});
});

describe('preTickedKeyWords (SESSION_NOTES D3)', () => {
	it('returns the key words the typed text holds', () => {
		const keys = ['host program', 'replicates', 'user action'];
		expect(preTickedKeyWords('it replicates inside a host program', keys)).toEqual([0, 1]);
		expect(preTickedKeyWords('', keys)).toEqual([]);
	});
});

describe('markSection (DESIGN §7 KeyTerm in the reader)', () => {
	it('splits paragraphs on blank lines and drops empty ones', () => {
		expect(paragraphsOf('One.\n\n  Two.  \n\n\n')).toEqual(['One.', 'Two.']);
	});

	it('marks each term once, at its first appearance, as whole words, any case', () => {
		const text = 'TCP is reliable. tcp again.\n\nUDP and TCP. Stcp is not a term.';
		expect(markSection(text, ['TCP', 'UDP'])).toEqual([
			[
				{ text: 'TCP', term: true },
				{ text: ' is reliable. tcp again.', term: false }
			],
			[
				{ text: 'UDP', term: true },
				{ text: ' and TCP. Stcp is not a term.', term: false }
			]
		]);
	});

	it('prefers the longer term when terms overlap', () => {
		expect(markSection('The TCP/IP model.', ['TCP', 'TCP/IP'])).toEqual([
			[
				{ text: 'The ', term: false },
				{ text: 'TCP/IP', term: true },
				{ text: ' model.', term: false }
			]
		]);
	});

	it('leaves the text plain with no terms', () => {
		expect(markSection('Plain.', [' '])).toEqual([[{ text: 'Plain.', term: false }]]);
	});
});

/** Ids are plain strings here; the selection rules never look inside them. */
const VIEW = {
	whole: false,
	topics: 1,
	of: 3,
	tree: [
		{
			id: 't1',
			name: 'Transport',
			checked: true,
			sections: [
				{ id: 's1', title: 'TCP', checked: true },
				{ id: 's2', title: 'UDP', checked: true }
			]
		},
		{
			id: 't2',
			name: 'Network',
			checked: false,
			sections: [
				{ id: 's3', title: 'IP', checked: true },
				{ id: 's4', title: 'Routing', checked: false }
			]
		},
		{ id: 't3', name: 'Intro', checked: false, sections: [] }
	]
} as ScopeView;

describe('scope selection (Decisions log Phase 8.6 Q12)', () => {
	it('starts from the stored scope', () => {
		const picks = initialPicks(VIEW);
		expect([...picks].sort()).toEqual(['s1', 's2', 's3']);
		expect(topicPick(VIEW.tree[0]!, picks)).toBe('all');
		expect(topicPick(VIEW.tree[1]!, picks)).toBe('some');
		expect(topicPick(VIEW.tree[2]!, picks)).toBe('none');
		expect(pickedTopics(VIEW, picks)).toBe(2);
	});

	it('stores whole topics as topic ids and partial ones as section ids', () => {
		expect(toScope(VIEW, initialPicks(VIEW))).toEqual({ topicIds: ['t1'], chunkIds: ['s3'] });
	});

	it('ticks a whole topic, or unticks it when all of it was ticked', () => {
		const picks = initialPicks(VIEW);
		const t2 = VIEW.tree[1]!;
		const all = toggleTopic(t2, picks);
		expect(topicPick(t2, all)).toBe('all');
		expect(topicPick(t2, toggleTopic(t2, all))).toBe('none');
	});

	it('treats a topic without sections as one pick', () => {
		const t3 = VIEW.tree[2]!;
		const picks = toggleTopic(t3, new Set());
		expect(topicPick(t3, picks)).toBe('all');
		expect(toScope(VIEW, picks)).toEqual({ topicIds: ['t3'], chunkIds: [] });
	});

	it('everything picked is the whole course; nothing picked is no scope', () => {
		const all = pickAll(VIEW, true);
		expect(isAll(VIEW, all)).toBe(true);
		expect(toScope(VIEW, all)).toEqual({ topicIds: [], chunkIds: [] });
		expect(toScope(VIEW, pickAll(VIEW, false))).toBeNull();
	});

	it('toggles one section', () => {
		const picks = toggleSection('s4', initialPicks(VIEW));
		expect(topicPick(VIEW.tree[1]!, picks)).toBe('all');
		expect(toggleSection('s4', picks).has('s4')).toBe(false);
	});
});

describe('flashcard deck (DESIGN §10 Flashcards)', () => {
	it('sorts each card once and ends the pass', () => {
		let deck = startDeck(['a', 'b', 'c']);
		expect(topCard(deck)).toBe('a');
		deck = rateCard(deck, 'learning');
		deck = rateCard(deck, 'know');
		expect(deckDone(deck)).toBe(false);
		deck = rateCard(deck, 'know');
		expect(deckDone(deck)).toBe(true);
		expect(topCard(deck)).toBeNull();
		expect(deck.learning).toEqual(['a']);
		expect(deck.known).toEqual(['b', 'c']);
		expect(rateCard(deck, 'learning')).toBe(deck);
	});

	it('maps Space, arrows and H to deck actions', () => {
		expect(deckKey(' ')).toBe('flip');
		expect(deckKey('ArrowLeft')).toBe('learning');
		expect(deckKey('ArrowRight')).toBe('know');
		expect(deckKey('h')).toBe('hint');
		expect(deckKey('H')).toBe('hint');
		expect(deckKey('Enter')).toBeNull();
	});
});

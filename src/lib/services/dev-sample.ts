import type { CardId, ExerciseKind } from '#lib/db/schemas/common.ts';
import type { NoteType } from '#lib/db/schemas/note.ts';

/**
 * A small course in the import format that covers every non-diagram note type, with enough
 * siblings for distractors and a first-letter bank. Used by the dev session harness and tests.
 *
 * @see BUILD_PLAN §4 and §5.1
 */
export const SAMPLE_COURSE_TEXT = `@deck Networking
@keyterms
Port :: number that names a service on a host
Packet :: unit of data sent across a network
Protocol :: agreed rules for communication
Proxy :: server that forwards requests for clients
@fact
TCP :: connection-oriented, reliable delivery
UDP :: connectionless, best-effort delivery
DNS :: turns names into IP addresses
DHCP :: hands out IP addresses automatically
@cloze
A {{router}} forwards packets between {{networks}}.
@sequence TCP handshake
SYN
SYN-ACK
ACK
@sequence Sending an email
Compose
Submit to the SMTP server
Relay to the recipient's server
@compare
| | TCP | UDP |
|---|---|---|
| connection | connection-oriented | connectionless |
| ordering | ordered | unordered |
| header | 20 bytes | 8 bytes |
@scenario
A video call needs low latency :: UDP
A file download must arrive complete :: TCP
@example Subnetting
find the mask :: /24 means 255.255.255.0
count hosts :: 254 usable hosts
@example Binary to decimal
write place values :: 8 4 2 1
add the ones :: 1010 is 10
@example Checksum
add the words :: sum all 16-bit words
fold the carry :: add the carry back in
@example Round trip time
note the send time :: the packet leaves at t0
subtract :: arrival minus t0
`;

/** A sample card as the harness sees it. */
export interface SampleCard {
	id: CardId;
	variant: string;
	noteType: NoteType;
	/** The note's term, name or first answer, to tell notes of one type apart. */
	noteKey: string;
}

/** Which sample card shows which kind first: one card per non-diagram kind. */
const KIND_PLAN: readonly { kind: ExerciseKind; type: NoteType; key: string; variant: string }[] = [
	{ kind: 'cloze', type: 'keyterm', key: 'Port', variant: 'fwd' },
	{ kind: 'pretest', type: 'keyterm', key: 'Packet', variant: 'fwd' },
	{ kind: 'matching', type: 'keyterm', key: 'Protocol', variant: 'fwd' },
	{ kind: 'firstLetterBank', type: 'keyterm', key: 'Proxy', variant: 'fwd' },
	{ kind: 'mc', type: 'fact', key: 'TCP', variant: 'fwd' },
	{ kind: 'firstLetterType', type: 'fact', key: 'TCP', variant: 'rev' },
	{ kind: 'flip', type: 'fact', key: 'UDP', variant: 'fwd' },
	{ kind: 'blurt', type: 'fact', key: 'UDP', variant: 'rev' },
	{ kind: 'explainIt', type: 'cloze', key: 'router', variant: 'c1' },
	{ kind: 'sequence', type: 'sequence', key: 'TCP handshake', variant: 'seq' },
	{ kind: 'whichOne', type: 'sequence', key: 'TCP handshake', variant: 'step:0' },
	{ kind: 'parsons', type: 'sequence', key: 'Sending an email', variant: 'seq' },
	{ kind: 'tableRow', type: 'compare', key: 'TCP', variant: 'row:0' },
	{ kind: 'pickPrinciple', type: 'compare', key: 'TCP', variant: 'row:1' },
	{ kind: 'oddOneOut', type: 'compare', key: 'TCP', variant: 'cell:0:0' },
	{ kind: 'multiSelect', type: 'compare', key: 'TCP', variant: 'cell:1:0' },
	{ kind: 'categorize', type: 'compare', key: 'TCP', variant: 'cell:2:1' },
	{ kind: 'scenario', type: 'scenario', key: 'A video call needs low latency', variant: 'fwd' },
	{ kind: 'exampleStudy', type: 'example', key: 'Subnetting', variant: 'ex' },
	{ kind: 'fadeStep', type: 'example', key: 'Binary to decimal', variant: 'ex' },
	{ kind: 'newInstance', type: 'example', key: 'Checksum', variant: 'ex' },
	{ kind: 'subgoalMatch', type: 'example', key: 'Round trip time', variant: 'ex' }
];

/**
 * The harness plan for the sample course: the cards, in plan order, and the kind each shows first.
 * Throws if the sample lost a card the plan needs.
 */
export function sampleKindPlan(cards: readonly SampleCard[]): {
	cardIds: CardId[];
	forceKinds: Record<CardId, ExerciseKind>;
} {
	const forceKinds: Record<CardId, ExerciseKind> = {};
	const cardIds = KIND_PLAN.map(({ kind, type, key, variant }) => {
		const card = cards.find(
			(c) => c.noteType === type && c.noteKey === key && c.variant === variant
		);
		if (!card) throw new Error(`Sample has no ${type} "${key}" ${variant} card for ${kind}`);
		forceKinds[card.id] = kind;
		return card.id;
	});
	return { cardIds, forceKinds };
}

/** Every kind the harness covers (all non-diagram kinds). */
export const SAMPLE_KINDS: readonly ExerciseKind[] = KIND_PLAN.map((entry) => entry.kind);

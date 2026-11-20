/**
 * Sample data for the Phase 8.6 study-flow components in the style guide (dev builds only). Ids
 * are fixed strings cast to the branded types; nothing here is stored.
 */
import type { MeetTermView } from '#lib/services/learn-types.ts';
import type { ScopeView } from '#lib/services/scope-service.ts';
import type { ChooseSpec, IdeaUnitSpec, ListSpec } from '#lib/services/study-types.ts';

export const SAMPLE_IDEA_UNIT = {
	shape: 'ideaUnit',
	kind: 'ideaUnit',
	cardId: 'guide-idea',
	prompt: 'What is a worm?',
	instruction: 'Type the definition',
	answer: 'Malware that spreads across a network by itself, without a host program',
	keyWords: ['spreads by itself', 'network', 'no host program']
} as unknown as IdeaUnitSpec;

const MALWARE = ['virus', 'worm', 'Trojan', 'ransomware', 'rootkit', 'spyware'];

export const SAMPLE_LIST_TYPED = {
	shape: 'list',
	kind: 'listN',
	cardId: 'guide-list-typed',
	prompt: 'Name any 3 of the 6 malware types.',
	instruction: 'Type three',
	entry: 'type',
	items: MALWARE,
	required: 3,
	options: [],
	correct: []
} as unknown as ListSpec;

export const SAMPLE_LIST_PICK = {
	shape: 'list',
	kind: 'listPick',
	cardId: 'guide-list-pick',
	prompt: 'Name any 3 of the 6 malware types.',
	instruction: 'Tap three. Two of these are not malware types.',
	entry: 'pick',
	items: MALWARE,
	required: 3,
	options: ['virus', 'phishing', 'worm', 'SQL injection', 'Trojan', 'rootkit'].map((text) => ({
		text
	})),
	correct: [0, 2, 4, 5]
} as unknown as ListSpec;

export const SAMPLE_CHOOSE = {
	shape: 'choose',
	kind: 'mc',
	cardId: 'guide-choose',
	prompt: 'Which protocol is connectionless?',
	instruction: 'Pick one',
	options: [{ text: 'TCP' }, { text: 'UDP' }, { text: 'HTTP' }, { text: 'SMTP' }],
	correctIndex: 1,
	letter: null
} as unknown as ChooseSpec;

export const SAMPLE_TERMS = [
	{
		noteId: 'guide-t1',
		term: 'Port number',
		meaning: 'Identifies the application process on a host',
		example: 'A web server listens on port 443'
	},
	{
		noteId: 'guide-t2',
		term: 'Connection-oriented',
		meaning: 'Sets up a connection first, then delivers reliably',
		example: null
	},
	{
		noteId: 'guide-t3',
		term: 'Connectionless',
		meaning: 'No setup and no ordering promised; low overhead',
		example: 'DNS queries use UDP'
	}
] as unknown as MeetTermView[];

export const SAMPLE_READER = {
	title: 'TCP versus UDP',
	text: [
		'The Transport layer provides communication between application processes. Port numbers identify which application process on a host the data belongs to.',
		'TCP is connection-oriented. It gives reliable delivery through acknowledgments, sequencing, and flow control. Connection-oriented delivery suits the web and email.',
		'UDP is connectionless. It has low overhead and no built-in reliability.'
	].join('\n\n'),
	tip: 'TCP = Takes Care (reliable). UDP = U Don’t Promise.',
	terms: ['Port numbers', 'connection-oriented', 'acknowledgments', 'connectionless'],
	outline: [
		{ title: 'TCP/IP layers and mapping to OSI', state: 'done' as const },
		{ title: 'TCP versus UDP', state: 'current' as const },
		{ title: 'IPv4 and IPv6 addressing', state: 'todo' as const }
	]
};

export const SAMPLE_DECK = [
	{ key: 'd1', term: 'Worm', answer: 'Malware that spreads across a network by itself' },
	{ key: 'd2', term: 'Trojan', answer: 'Malware disguised as something the user wants' },
	{ key: 'd3', term: 'Rootkit', answer: 'Hides an attacker’s access deep in the system' }
];

export const SAMPLE_SCOPE = {
	whole: false,
	topics: 2,
	of: 3,
	tree: [
		{
			id: 'guide-topic-1',
			name: 'Transport layer',
			checked: true,
			sections: [
				{ id: 'guide-s1', title: 'TCP versus UDP', checked: true },
				{ id: 'guide-s2', title: 'Flow control', checked: true }
			]
		},
		{
			id: 'guide-topic-2',
			name: 'Network layer',
			checked: false,
			sections: [
				{ id: 'guide-s3', title: 'IPv4 addressing', checked: true },
				{ id: 'guide-s4', title: null, checked: false }
			]
		},
		{ id: 'guide-topic-3', name: 'Introduction', checked: false, sections: [] }
	]
} as unknown as ScopeView;

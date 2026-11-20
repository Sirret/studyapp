import type { Chunk, Topic } from '#lib/db/schemas/course.ts';
import type { StudyStack } from './study-fixtures.ts';

/**
 * A two-topic course in Import v2 form: topic `sec` (summary, sections Crypto with key terms and a
 * tip, and Access) and topic `net` (summary, sections Layers, Addresses, Ports). Learn order:
 * Crypto, Access, Layers, Addresses, Ports.
 */
export const LEARN_COURSE_TEXT = `@topic sec Security | from: Lecture I
@summary
Security keeps data safe.
@section Crypto
@keyterms
Cipher :: algorithm that encrypts data
Key :: secret that unlocks a cipher
@read
Encryption hides data. A key unlocks it again.
@tip
Lock and key.
@fact
Hash :: one-way fingerprint of data
@section Access
@read
Access control limits who can do what.
@fact
ACL :: list of permissions on a resource
RBAC :: permissions given by role
@topic net Networks | from: Lecture II
@summary
Networks move data.
@section Layers
@read
The OSI model has seven layers.
@fact
Router :: forwards packets between networks
Switch :: forwards frames within a network
@section Addresses
@read
IP addresses name hosts.
@fact
IPv4 :: thirty-two bit address
IPv6 :: hundred twenty-eight bit address
@section Ports
@read
Ports name services.
@fact
HTTP :: web traffic on port eighty
HTTPS :: secure web traffic on port four four three
@end`;

/** The course's topics (by order) and each topic's sections (by order), by title. */
export async function outline(env: StudyStack): Promise<{
	topics: Topic[];
	sections: Map<string, Chunk>;
}> {
	const topics = (await env.repos.topics.listByCourse(env.courseId)).sort(
		(a, b) => a.order - b.order
	);
	const sections = new Map<string, Chunk>();
	for (const topic of topics) {
		for (const chunk of await env.repos.chunks.listByTopic(topic.id)) {
			sections.set(chunk.title ?? chunk.id, chunk);
		}
	}
	return { topics, sections };
}

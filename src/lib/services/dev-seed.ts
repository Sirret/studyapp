import figuresText from '../../../tests/golden/import/figures.txt?raw';
import fullText from '../../../tests/golden/import/full.txt?raw';
import malformedText from '../../../tests/golden/import/malformed.txt?raw';
import {
	DEV_SEED_ANSWER_GAP_SEC,
	DEV_SEED_IMAGE,
	DEV_SEED_RNG_SEED
} from '#lib/config/defaults.ts';
import { CardRepo } from '#lib/db/repos/content-repos.ts';
import { DeviceRepo } from '#lib/db/repos/device-repo.ts';
import { EventRepo } from '#lib/db/repos/event-repo.ts';
import { KvRepo } from '#lib/db/repos/kv-repo.ts';
import type { CourseId, SessionId } from '#lib/db/schemas/common.ts';
import { weightOf } from '#lib/engine/exercise-kinds.ts';
import { MS_PER_DAY } from '#lib/engine/time.ts';
import { db, logger } from './app.ts';
import { SAMPLE_COURSE_TEXT } from './dev-sample.ts';
import { richSeedPlan, shelfSeedPlan, syntheticAnswers, type SeedCourse } from './dev-seed-plan.ts';
import { importService } from './import-wiring.ts';
import { kvReplayConfig, ReplayService } from './replay-service.ts';
import { coursePlanService } from './study-wiring.ts';

/**
 * Dev and test builds only: fills this browser's database with realistic data for review, or
 * wipes it. Runs the real import pipeline, so what it makes is what a student's import makes.
 * Only `/dev/seed` imports this module, and only when `__DEV_ROUTES__` is on.
 *
 * @see Decisions log "Pre-review step: /dev/seed"
 */

if (!__DEV_ROUTES__) throw new Error('dev-seed is for dev and test builds only');

const newId = () => crypto.randomUUID();
const tzOffsetMin = (): number => -new Date().getTimezoneOffset();

/** A plain picture with the file name and a few labelled blocks, as a PNG. */
async function seedPicture(name: string): Promise<Blob> {
	const canvas = document.createElement('canvas');
	canvas.width = DEV_SEED_IMAGE.width;
	canvas.height = DEV_SEED_IMAGE.height;
	const g = canvas.getContext('2d');
	if (!g) throw new Error('no 2d canvas');
	const { width: w, height: h } = DEV_SEED_IMAGE;
	g.fillStyle = 'rgb(245, 240, 230)';
	g.fillRect(0, 0, w, h);
	g.fillStyle = 'rgb(40, 50, 60)';
	g.font = `${h / 14}px sans-serif`;
	g.fillText(name, w / 20, h / 10);
	['Block A', 'Block B', 'Block C', 'Block D'].forEach((label, i) => {
		const x = w / 20 + (i % 2) * (w / 2);
		const y = h / 5 + Math.floor(i / 2) * (h / 2.6);
		g.strokeRect(x, y, w / 2.4, h / 3.2);
		g.fillText(label, x + w / 40, y + h / 6);
	});
	return new Promise((resolve, reject) =>
		canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('no png'))), 'image/png')
	);
}

/** Today plus `days`, as the local `YYYY-MM-DD` the exam form stores. */
function localDatePlus(days: number): string {
	const date = new Date();
	date.setDate(date.getDate() + days);
	const pad = (n: number) => String(n).padStart(2, '0');
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

async function createSeedCourse(spec: SeedCourse): Promise<CourseId> {
	const course = await importService.createCourse(spec.name);
	const sources = await Promise.all(
		spec.images.map(async (name) => ({ name, blob: await seedPicture(name) }))
	);
	const { images, errors } = await importService.prepareImages(sources);
	if (errors.length > 0) throw new Error(errors.join('; '));
	const preview = await importService.preview(course.id, spec.text, images);
	const committed = await importService.commit(course.id, preview, new Map());
	if (!committed.ok) throw new Error(committed.error);
	if (spec.examInDays !== null) {
		const examDate = localDatePlus(spec.examInDays);
		await coursePlanService.setExam(course.id, {
			examDate,
			examTime: null,
			examFormat: spec.examFormat
		});
	}
	return course.id;
}

/** Writes each course's synthetic answers at their past times, then replays every card. */
async function writeHistory(courseIds: readonly CourseId[], now: number): Promise<number> {
	let at = now;
	const device = new DeviceRepo(db, newId);
	const context = { clock: () => at, newId, getDeviceId: () => device.getDeviceId() };
	const cards = new CardRepo(db, context);
	const events = new EventRepo(db, { clock: () => at, newId, device, tzOffsetMin });
	let written = 0;
	for (const courseId of courseIds) {
		const live = await cards.listByCourse(courseId);
		const seedCards = live.map((card) => ({ id: card.id, kind: card.path[0] ?? 'mc' }));
		const answers = syntheticAnswers(seedCards, courseId, DEV_SEED_RNG_SEED);
		const sessions = new Map<number, SessionId>();
		for (const answer of answers) {
			const sessionId = sessions.get(answer.daysAgo) ?? (newId() as SessionId);
			sessions.set(answer.daysAgo, sessionId);
			at = now - answer.daysAgo * MS_PER_DAY + answer.index * DEV_SEED_ANSWER_GAP_SEC * 1000;
			await events.append({
				type: 'review',
				cardId: answer.cardId,
				sessionId,
				mode: 'longterm',
				kind: answer.kind,
				weight: weightOf(answer.kind),
				firstAttempt: true,
				correct: answer.correct,
				responseMs: DEV_SEED_ANSWER_GAP_SEC * 400,
				credited: true
			});
			written += 1;
		}
	}
	const replay = new ReplayService(
		events,
		cards,
		logger,
		kvReplayConfig(new KvRepo(db), tzOffsetMin)
	);
	await replay.rebuildAll();
	return written;
}

/** What a seed made, for the screen. */
export interface SeedReport {
	courses: number;
	events: number;
}

/** Creates the courses one by one; `onProgress(done, total)` after each. */
async function seed(
	plan: SeedCourse[],
	onProgress: (done: number, total: number) => void
): Promise<SeedReport> {
	const withHistory: CourseId[] = [];
	for (const [index, spec] of plan.entries()) {
		const id = await createSeedCourse(spec);
		if (spec.history) withHistory.push(id);
		onProgress(index + 1, plan.length);
	}
	const events = withHistory.length > 0 ? await writeHistory(withHistory, Date.now()) : 0;
	logger.info('dev', 'seeded', { courses: plan.length, events });
	return { courses: plan.length, events };
}

/** "Rich": six courses from the golden texts with figures, exams and a few days of history. */
export function seedRich(onProgress: (done: number, total: number) => void): Promise<SeedReport> {
	const texts = {
		figures: figuresText,
		full: fullText,
		malformed: malformedText,
		sample: SAMPLE_COURSE_TEXT
	};
	return seed(richSeedPlan(texts), onProgress);
}

/** "Shelf stress": fifty small courses with varied titles and exam dates. */
export function seedShelf(onProgress: (done: number, total: number) => void): Promise<SeedReport> {
	return seed(shelfSeedPlan(), onProgress);
}

/** Deletes this browser's database and local settings. The caller reloads the page. */
export async function wipeLocalData(): Promise<void> {
	await db.delete();
	localStorage.clear();
	sessionStorage.clear();
}

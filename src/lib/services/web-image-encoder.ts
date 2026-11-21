import type { Result } from '#lib/util/result.ts';
import {
	canEncodeOffscreen,
	CANNOT_ENCODE,
	encodeImage,
	type EncodedImage,
	type EncodeReply
} from './image-encode.ts';
import type { ImageEncoder } from './import-service.ts';

type Pending = (reply: EncodeReply) => void;

/**
 * Resizes and re-encodes images in the browser, in a Web Worker so the page never freezes. Where
 * workers can't encode (no worker, no OffscreenCanvas in workers, or the worker fails to load) it
 * encodes on the page instead; the import screen shows progress either way.
 *
 * @see BUILD_PLAN §4.2; WIP step 5 ("encoding never blocks the main thread")
 */
export class WebImageEncoder implements ImageEncoder {
	private worker: Worker | null = null;
	private workerUsable = typeof Worker !== 'undefined';
	private nextId = 0;
	private readonly pending = new Map<number, Pending>();

	async encode(source: Blob): Promise<Result<EncodedImage, string>> {
		if (this.workerUsable) {
			const reply = await this.inWorker(source);
			if (reply?.kind === 'done') return reply.result;
			this.workerUsable = false;
		}
		if (!canEncodeOffscreen()) return { ok: false, error: CANNOT_ENCODE };
		return encodeImage(source);
	}

	/** Sends one image to the worker; `null` when the worker can't be used. */
	private inWorker(source: Blob): Promise<EncodeReply | null> {
		const worker = this.startWorker();
		if (!worker) return Promise.resolve(null);
		const id = this.nextId++;
		return new Promise((resolve) => {
			this.pending.set(id, resolve);
			worker.postMessage({ id, source });
		});
	}

	private startWorker(): Worker | null {
		if (this.worker) return this.worker;
		try {
			const worker = new Worker(new URL('./image-encode.worker.ts', import.meta.url), {
				type: 'module'
			});
			worker.addEventListener('message', (event: MessageEvent<EncodeReply>) => {
				this.pending.get(event.data.id)?.(event.data);
				this.pending.delete(event.data.id);
			});
			worker.addEventListener('error', () => this.failAll(worker));
			this.worker = worker;
			return worker;
		} catch {
			return null;
		}
	}

	/** A worker that failed to load or crashed: every waiting image goes to the page instead. */
	private failAll(worker: Worker): void {
		worker.terminate();
		this.worker = null;
		this.workerUsable = false;
		for (const [id, resolve] of this.pending) resolve({ id, kind: 'unsupported' });
		this.pending.clear();
	}
}

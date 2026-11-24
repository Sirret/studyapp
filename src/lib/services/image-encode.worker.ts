import {
	canEncodeOffscreen,
	encodeImage,
	NOT_AN_IMAGE,
	type EncodedImage,
	type EncodeReply,
	type EncodeRequest
} from './image-encode.ts';
import type { Result } from '#lib/util/result.ts';

/**
 * The image encode worker: a 2000 px WebP encode takes seconds on a phone, so it never runs on
 * the page when a worker can do it. Replies `unsupported` where workers have no OffscreenCanvas.
 *
 * @see BUILD_PLAN §4.2; docs/spikes/PDF_SPIKE.md (encode timings)
 */
addEventListener('message', (event: MessageEvent<EncodeRequest>) => {
	const { id, source } = event.data;
	const send = (reply: EncodeReply) => postMessage(reply);
	if (!canEncodeOffscreen()) {
		send({ id, kind: 'unsupported' });
		return;
	}
	// Always reply, even on an unexpected throw: the page waits for this id.
	void encodeImage(source)
		.catch((): Result<EncodedImage, string> => ({ ok: false, error: NOT_AN_IMAGE }))
		.then((result) => send({ id, kind: 'done', result }));
});

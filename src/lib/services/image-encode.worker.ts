import {
	canEncodeOffscreen,
	encodeImage,
	type EncodeReply,
	type EncodeRequest
} from './image-encode.ts';

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
	void encodeImage(source).then((result) => send({ id, kind: 'done', result }));
});

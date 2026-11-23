# Spike: OCR box suggestions for pasted pictures (Phase 6 step 10)

**Question:** can tesseract.js, self-hosted and running in the browser, find the labels in the lecture's pasted-picture figures, with positions good enough to suggest occlusion boxes?

**Verdict: NO-GO by the agreed bar** (WIP step 10: ≥ 70% of labels with usable positions, ≤ ~6 MB download, ≤ 8 s per page on a phone-class CPU). At best it found 29 of 89 labels (33%), and it would take an estimated 8–23 s per page on a phone. The download size passes. The decision is the user's.

## Setup
- **Pages:** the six slides that pdf.js could not read (10, 12, 15, 19, 21, 30 of Database II Lecture 3). Each holds a pasted textbook figure: dense, sparse and secondary index tables, the B+ tree leaf figure and the node layouts. Each page was rendered at 2000 × 1500 before pdf.js was removed. The PNGs are in the git-ignored `tests/fixtures/spike/`.
- **Library:** `tesseract.js` 7.0.0 with `tesseract.js-core` 7.0.0 and the English `4.0.0_best_int` data from `@tesseract.js-data/eng` 1.0.0. They are dev dependencies for the spike only. Engine: LSTM only (the default).
- **Self-hosted:** `workerPath`, `corePath` and `langPath` all point at local `/ocr/…` paths, and any other request is aborted.
- **Ground truth:** the same hand-written labels as the PDF spike (`tests/fixtures/spike/truth.ts`): 89 labels, each with the figure's top edge.
- **What counts as a hit:** a word, or up to three neighbouring words on one line, read as the label inside the figure area (below its top edge, narrower than half the page).
  - *Strict:* exact after lowercasing and removing table-border characters (`| [ ] { }`) and punctuation.
  - *Fuzzy:* also ignores hyphens and allows the app's typed-answer tolerance (`FUZZY_EDITS`: none for labels of up to 4 characters, 1 edit up to 8, 2 above). This is what an editor that matches the chatbot's `box:` labels to OCR words could accept.
- **Variants tried:** page segmentation mode 3 (auto) and 11 (sparse text). Each was run on the whole page, on the page cropped to the figure (as if the student imported only the picture), and on the crop in greyscale, with contrast raised and scaled up 2×.
- **Script:** `scripts/spike/ocr-spike.ts` (Chromium through Playwright; not part of `verify`). Raw output: `test-results/spike/ocr.json`.

## Results

### Labels found (of 89)
| Variant | Strict | Fuzzy | Fuzzy, word confidence ≥ 60 |
|---|---|---|---|
| PSM 3, whole page | 14 | 20 | 14 |
| **PSM 11, whole page** | 21 | **29 (33%)** | 21 |
| PSM 3, cropped | 12 | 17 | 11 |
| PSM 11, cropped | 21 | 26 | 14 |
| PSM 3, cropped + grey + 2× | 16 | 23 | 13 |
| PSM 11, cropped + grey + 2× | 21 | 29 (33%) | 17 |

The best variants reach **33% against the 70% bar.**

By page (PSM 11):
| Page | Figure | Whole page | Cropped + grey + 2× |
|---|---|---|---|
| 10 | dense index (index + account table) | 6 / 22 | 4 / 22 |
| 12 | sparse index | 6 / 22 | 4 / 22 |
| 15 | secondary index | 15 / 22 | 18 / 22 |
| 19 | node layout (P1 K1 P2 … Pn) | 0 / 4 | 0 / 4 |
| 21 | B+ tree leaf figure | 1 / 10 | 2 / 10 |
| 30 | leaf / non-leaf nodes | 1 / 9 | 1 / 9 |

### Why it fails
- **Table borders are read as letters.** Cell lines stick to the words around them: "[Brighton", "A207 [Brighton | 70 |", "| A101 | Downtown | 500 | +5". Cells come out joined into one line, and the borders often swallow the first or last character ("750" read as "70", "A-217" as "A207"). The account numbers (`A-xxx`) and balances, more than half the labels, are mostly missed.
- **Subscripted symbols aren't text to tesseract.** P₁, K₁, Pₙ, Bₘ₋₁ in italic with subscripts come out as "PK [Po foo [Pu [Kea". All 13 such labels on pages 19 and 30 were missed.
- **Low contrast and small type.** The leaf figure on page 21 reads as "[oowniown]" and "tio [ovo c00".
- Page 15's table has thicker spacing between cells and reads well (18 / 22 after preprocessing). Clean figures with space around their labels would do much better than this deck.
- **Merged digits ("1 1" → "11"):** none of these pictures has stacked digits, so this couldn't be tested here. Those pages (22–28) are drawn text, which pdf.js read exactly. Tesseract read the subscript "1" in "P1" as part of the letter ("Pl", "Py"), the same kind of error.

### Size (self-hosted files, loaded on demand)
| File | Raw | Gzipped (over the network) |
|---|---|---|
| `tesseract.esm.min.js` (page-side API) | 62 KB | 10 KB |
| `worker.min.js` | 109 KB | 33 KB |
| `tesseract-core-relaxedsimd-lstm.wasm.js` (picked by Chromium; the SIMD and no-SIMD builds are the same size) | 3,814 KB | 1,424 KB |
| `eng.traineddata.gz` (`best_int`) | 2,884 KB | 2,879 KB (already compressed) |
| **Total** | **6.7 MB** | **≈ 4.3 MB: passes ≤ ~6 MB** |

### Time
| Step | Desktop (unthrottled) | Phone estimate (× 4) |
|---|---|---|
| Start worker + load core + language data | 0.5–1.2 s | 2–5 s |
| Recognise one page (PSM 11, whole page) | 2.1–5.8 s | **8–23 s: fails ≤ 8 s** |
| Recognise one page (cropped + grey + 2×) | 1.5–5.5 s | 6–22 s |

**Throttling caveat:** Chromium's 4× CPU throttle (`Emulation.setCPUThrottlingRate`) applied to the page did not slow the OCR Web Worker: throttled pages took 3.0–5.4 s, the same as unthrottled. So the phone column is desktop time × 4, an estimate and not a measurement. Even the fastest page would be at the bar, and most would be well over it.

### Offline
- Every request went to the self-hosted paths: the API, the worker, one core file chosen by feature detection, and the language data. Nothing went to the default jsDelivr CDN, and no other request was made.
- tesseract.js keeps the language data in its own IndexedDB cache: the second run did not fetch it again. The worker and core were fetched again on every new worker.
- So it **would work offline after first use** once the worker and core files (≈ 1.5 MB gzipped) are runtime-cached by the service worker (step 12). Without that, they are fetched each time.

## Against the bar
| Bar | Result | |
|---|---|---|
| ≥ 70% of labels with usable positions | 33% (best variant) | **fails** |
| ≤ ~6 MB download | ≈ 4.3 MB | passes |
| ≤ 8 s per page, phone class | ≈ 8–23 s (estimated) | **fails** |
| Works offline after first use | yes, with the worker and core runtime-cached | passes |

## If no-go
- Uninstall `tesseract.js` and `@tesseract.js-data/eng`, and remove `scripts/spike/ocr-spike.ts` (it stays in git history). Step 11 is dropped.
- Manual boxes stay the way to place labels on pasted pictures: tap-to-place from the `box:` list (step 9) already does this.
- BUILD_PLAN §7.1 and rule 9 mention tesseract.js; step 14's doc pass marks OCR as tried and dropped, with a link to this report.

## If go anyway (not the agreed bar)
A narrower step 11 could still help on clean figures like page 15:
- a "Suggest boxes" button in the occlusion editor;
- PSM 11 on the image, cropped, greyscale, 2×;
- only words that fuzzily match an `unplaced` label become suggestions, so noise like "[ovo c00" never shows;
- every suggestion waits for the student to confirm it.

Cost: a ≈ 4.3 MB download on first use and a 2–6 s wait on a laptop (longer on a phone), with a progress bar. On a deck like this one, it would place about a third of the labels.

# Spike: slide PDFs as a source of occlusion boxes (Phase 6 step 1)

**Question:** can pdf.js, running in the browser, give text positions per page plus a rendered page image, so occlusion boxes come from the PDF's own text instead of OCR?

**Verdict: NO-GO by the agreed thresholds** (Decisions log "Phase 6 Q1–Q2"). Where a diagram's labels are real text, positions are exact (100%). But half of this lecture's diagram labels sit inside pasted pictures with no text at all, so the hit rate is 50% against the 80% bar. The library is also slightly over the size bar. The decision is the user's (WIP step 1).

## Setup
- **PDF:** Database II, Lecture 3 "Indexing and Hashing": 39 slides, 755 KB, B+ tree / B-tree slides. It's in `tests/fixtures/spike/` (git-ignored, never committed).
- **Library:** `pdfjs-dist` 4.10.38, pinned as a dev dependency for the spike only.
- **Ground truth:** written by hand from the slide pictures, not from the PDF's text layer, so the test isn't circular: 177 diagram labels on 19 diagram slides and 27 plain-text phrases. It lives in the git-ignored `tests/fixtures/spike/truth.ts`.
- **What counts as a hit:** a label is found when a text item, or items joined on one line, holds it as a whole token inside the figure's area, with a box inside the page.
- **Scripts:** `scripts/spike/pdf-spike.ts` (Node, text and operators) and `scripts/spike/pdf-render.ts` (Chromium with 4× CPU throttling to model a phone). Neither is part of `verify`. Raw output: `test-results/spike/pdf-text.json`.

## Results

### Text positions
| Kind | Found | Notes |
|---|---|---|
| (a) Diagram text, drawn in the slide (B+ / B-tree insertion steps, pages 22–28, 33–38) | **88 / 88 (100%)** | Boxes land on the right keys (e.g. page 38's root keys 5 / 17 / 29 at y ≈ 0.48, x 0.41–0.52). On page 27, three two-digit keys ("11", "19", "29") are drawn one digit per line; they're found only after joining stacked characters, which the importer would have to do too. |
| (a) Diagram text, pasted pictures (dense / sparse / secondary index tables, the B+ tree leaf figure, the node layouts; pages 10, 12, 15, 19, 21, 30) | **0 / 89 (0%)** | Each of these slides holds one embedded raster image and no text inside the figure. They are **pictures, not outlines**: the vector path count (12) matches the plain-text slides, which is just the slide background and frame. |
| **All diagram labels** | **88 / 177 (50%)** | Below the 80% bar |
| (b) Plain slide text (titles, headings, bold terms) | **27 / 27 (100%)** | |

Whole document, Node, desktop CPU: text and operator lists for 39 pages took 2.0–2.9 s.

### Library size (lazy chunk + worker)
| File | Raw | Gzipped |
|---|---|---|
| `pdf.min.mjs` | 344 KB | 97 KB |
| `pdf.worker.min.mjs` | 1,344 KB | 394 KB |
| **Total** | **1,688 KB** (bar ~1.5 MB: **slightly over**) | 491 KB |

Neither file would be in the shell. They'd be loaded on demand and runtime-cached.

### Time on a phone-class device (Chromium, CPU throttled 4×, pages rendered at 2000 × 1500)
| Step | Time |
|---|---|
| Import pdf.js + read the PDF | 0.6 s |
| Open the document | 2.6 s |
| Render one page | 1.13–1.27 s (first page 2.29 s, warm-up) — **passes ≤ 1.5 s** after the first |
| WebP encode of that canvas (`convertToBlob`) | 1.0–3.6 s |
| Text of one page | < 0.05 s |

The WebP encode is the app's existing image path, not pdf.js. Any 2000 px image import pays it, so step 5 should encode off the main thread or show progress.

### Offline
No network request was made after pdf.js and the PDF were loaded. This PDF embeds its fonts, so pdf.js fetched no CMaps or standard fonts. It works **offline after first use** once its two files are runtime-cached (step 12). Another PDF with non-embedded fonts would need `standardFontDataUrl` self-hosted.

## What this means
- The lecturer's most occlusion-worthy figures are textbook pictures pasted into the slides. No PDF route can place boxes on those; only OCR or manual boxes can.
- Diagrams drawn in PowerPoint (shapes + text boxes) come through exactly: every key, with its position.
- Plain slide text comes through completely.
- Only one lecture deck was tested. Decks whose diagrams are SmartArt or drawn shapes would score much higher; decks of pasted screenshots would score about 0.

## If the user chooses go anyway (not the agreed bar)
A narrower step 10 would still pay off: pick a PDF, choose pages, store each page as an image, which also solves SESSION_NOTES §F's "where do slide images come from". Boxes would be pre-placed only where the chatbot's `box:` labels match PDF text; all others stay `unplaced`. Cost: a 491 KB gzipped lazy chunk + worker, runtime-cached.

## If no-go
- Uninstall `pdfjs-dist` in the step-2 commit and keep the spike scripts as a record.
- Step 10 is dropped.
- The OCR question (Q13) moves forward. The pictures that failed here are clean printed textbook figures, the case tesseract.js handles well (BUILD_PLAN §7.1).

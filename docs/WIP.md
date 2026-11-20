# WIP — Phase 6: Diagrams (image occlusion + structured diagrams)

Resume: read the last Checkpoint log row, the step it points to, and the files that step names. Spec: BUILD_PLAN §7 + §5.1/§6.2–§6.3/§6.10, CONCEPT §13, DATA_MODEL §3.8/§4.2–§4.3, the Decisions log rows starting "Phase 6", and the "Answers" section below (they override the "Rec" lines and §7 where they differ).

## Checkpoint log
| date | phase | step | model | done | files | next | commit |
|---|---|---|---|---|---|---|---|
| 2026-11-20 | 6 | 0 plan | Opus | Plan approved; Q1–Q13 answered into the Decisions log; WIP written | 2 | Step 1: PDF spike (confirm `tests/fixtures/spike/` is git-ignored and the PDF is there first) | see git log |
| 2026-11-20 | 6 | 1 PDF spike | Opus | pdf.js 4.10.38 on DB II Lecture 3: drawn-diagram labels 88/88, pasted-picture diagrams 0/89 (raster images, not outlines), plain text 27/27; 1,688 KB raw / 491 KB gz; render 1.1–1.3 s/page at 4× (first 2.3 s), WebP encode 1–3.6 s; no network after load. Verdict NO-GO by the agreed bar (50% < 80%, size slightly over); report `docs/spikes/PDF_SPIKE.md` | 6 | WAITING for the user: go or no-go. No-go → uninstall `pdfjs-dist` in the step-2 commit, drop step 10, take up Q13 (OCR) | see git log |
| 2026-11-20 | 6 | 1 decision | Opus | User: PDF no-go. Plan updated (step 5 worker encode, step 10 = OCR spike, step 11 only on its go); Decisions log row; six picture pages saved as git-ignored PNGs for the OCR spike | 2 | Step 2: interface + data (remove pdfjs-dist + spike scripts in that commit) | see git log |
| 2026-11-20 | 6 | 2 interface + data | Opus | DATA_MODEL + zod: occlusion `hide`/`title`/`unplaced`, media `sourceHash` + `mime` webp|jpeg, Dexie v3 index; `IMAGE_MAX_PX` 2000 + Phase 6 config; figure spec types + `place`/`connect` shapes; stubs (see "Not yet in the docs"); pdf.js + spike scripts removed; 2 schema tests updated (Decisions row), 2 timeouts → UNVERIFIED_TESTS. check 0 errors, 2196/2197 unit (1 timeout) | ~25 | Step 3: spec tests — launch spec-test-writer (Sonnet) and spec-test-writer-haiku with the briefs in "Agents" (update the briefs' module names to the step-2 names first) | see git log |

## Context
Phase 8.6 is done and pushed (983dc30). Phase 6 makes the two diagram note types studyable. Today, import already parses `@diagram` and `@occlusion` and stores images, but every diagram/occlusion kind falls back to cloze/MC/flip (`engine/exercise-spec.ts:54-93`). Occlusion notes are imported with `boxes: []`, so they have no cards. There is no editor, no figure rendering, and the chatbot prompt never mentions diagrams. The goal is the BUILD_PLAN §10 done-when: "Import an OSI stack, a flow diagram and an occlusion image; study each." The user's scope changes the original §7: text-first diagram editing, manual boxes first, OCR optional and last, and a PDF spike first.

Approved 2026-11-20 (answers below). After step 1, stop and report the spike verdict; step 2 starts only on the user's go/no-go.

## What already exists (reuse; don't rebuild)
- **Data:** `diagram` payload `{kind: stack|flow, name, nodes{id uuid,label,role?}, edges{id uuid,from,to,label?}, layout?, sourceMediaId?}` with refinements (stack has no edges, endpoints exist); `occlusion` payload `{mediaId, boxes{id uuid,x,y,w,h fractions,label}}` (`db/schemas/note.ts:16-66`). Box, node and edge IDs are already uuids. `media` table `{hash (sha256 of the stored WebP), mime 'image/webp', width, height, bytes, blob, fileName?, importId?}`, indexed `id, hash` (`db/schemas/course.ts:149`, `db/db.ts:64`). `MediaRepo` + `findByHash`.
- **Cards:** `cardgen.ts:55-113`. Stack: `layers` [layerOrder] plus `layer:<id>` [nodeCloze]. Flow: `node:<id>` [nodeCloze], `edge:<id>` [edgeCloze], `rebuild` [structureRebuild]. Occlusion: `box:<id>` [occlusionBank → occlusionType]. Answers: `answers.ts:81-131`, with groups `${noteId}/boxes|nodes|edges`. Prompts: `exercise-prompts.ts:73-133`. Estimate material is `diagram`.
- **Kinds and weights:** `exercise-kinds.ts`. occlusionType, occlusionDrag, structureRebuild, layerOrder, nodeCloze and edgeCloze are `full`; occlusionBank is in `choose` (recognition, MC-gated via `MC_GATED`); the queue already refuses a recognition answer as the final correct.
- **Grading:** `grading-shapes.ts` `hitTest(point, FractionBox, RenderedSize)`, `gradeSequence` (LIS), `gradeEdgeSet` (missing/extra). `gradeTyped`, with `FUZZY_EDITS` scaled by length (≤ 4 chars exact, so "IP" is already exact). `pickDistractors` prefers same-`group` siblings (`distractors.ts:83`).
- **Card regen keeps IDs:** `card-regen.ts planCardRegen` matches by variant; `CardListService.editNote` applies it.
- **Import:** `diagram-parser.ts` (`@diagram stack|flow <name>`, `A -> B : label`, `source: <file>`), `parseOcclusion` (file only), `build.ts hasRequiredImage` (a missing image skips the block with a line error), `zip.ts readImportZip` (fflate, one .txt + images, `__MACOSX` ignored), `fileKey` (lowercase basename only). `ImportService.openZip/prepareImages` (WebImageEncoder: `createImageBitmap` → OffscreenCanvas → WebP, `IMAGE_MAX_PX` 1600), `sha256Hex`, `ImportBatchDrafter.draftImage` (reuses media by hash), `unusedImages` in the preview (not saved), `/import` accepts `image/*,.zip`. Undo handles `sourceMediaId`.
- **UI:** `OrderExercise` (order shape with up/down tap alternative) for layerOrder, `ChooseExercise`, typed `type` shape, `Exercise.svelte` dispatch by `spec.shape`, `NoteEditor` / `note-edit.ts` (`EditableType` excludes diagram/occlusion; `toEditFields` → null), Manual mode `MANUAL_TYPES` + `/course/[id]/add`, `/dev/ui` + `visual.spec.ts`.
- **Shell guard:** `scripts/bundle-check.ts` (heavy-library list, `SHELL_JS_BUDGET_KB` 150, shell now 95.7 KB); the PWA precaches every client JS file (`vite.config.ts:69 globPatterns`).

## Missing (what this phase builds)
Figure rendering (image + box overlay, drawn diagram), the six real exercise builders and their components, occlusion editor, diagram text editor, auto layout, per-image hide mode, occlusion `box:` lines and unplaced labels, prompt text, zip name normalisation and a "N images not found" summary, re-import dedupe of image notes, EXIF/size/quota/persistent storage, a source-bytes hash, screen-reader text, Manual-mode forms and card-list editing for image notes, and runtime caching for heavy chunks.

## Steps (each ends at a checkpoint: commit, WIP row, CHECKPOINT line, stop)
Test tiers follow CLAUDE.md rule 13.

**0. Plan → WIP.md (checkpoint).** Write this plan plus the answered questions into `docs/WIP.md`, and the Decisions log rows for answered Qs. Commit.

**1. Spike: PDF slides (go/no-go, no UI).** Needs a real slide PDF with SmartArt-style diagrams from the user (Q1).
- `npx -y npm@latest install pdfjs-dist` (pin the exact version; verify its API, rule 12).
- Node script `scripts/spike/pdf-spike.ts` (legacy build): per page, the text items with positions (transform → fractions of the page box), and grouping into line boxes. Compare against the slide labels by hand and report a hit rate.
- Playwright one-off in `tests/spike/pdf-render.spec.ts` (not part of `verify`): load pdf.js + worker from a lazy chunk, render page → canvas → WebP. Time it with 4× CPU throttling (phone class), offline after first load.
- Report `docs/spikes/PDF_SPIKE.md`: text-position accuracy, library + worker size (raw/gz), render ms per page throttled, offline yes/no, verdict, and the import path if it's a go.
- No-go: uninstall and log the decision. Go: Step 10 becomes active. **Stop for the user's decision.**

**2. Interface + data (checkpoint a).** One commit for every stored-field change (rule 19): DATA_MODEL + zod + Dexie migration.
- `occlusion` payload gains `hide?: 'one'|'all'` (absent = one), `title?: string` (screen-reader name; default the file name), `unplaced?: string[]` (labels from `box:` lines not yet positioned; no cards).
- `media` gains `sourceHash` (SHA-256 of the original file bytes), indexed → Dexie version bump + migration (existing rows: `sourceHash` absent and matched by `hash` as before). `mime` allows `image/jpeg` only if Q7 = yes.
- Config in `defaults.ts`: `IMAGE_MAX_PX` (Q6), `OCCLUSION_BANK_MIN_OPTIONS` (2), `DIAGRAM_LAYOUT_*` spacing, `SPIKE`-free names.
- Occlusion card path becomes `occlusionBank → occlusionDrag → occlusionType` (Q3). No stored occlusion card exists (import makes `boxes: []`), so no path refresh is needed; a test proves this.
- Stubs (JSDoc = spec): `engine/exercise-build-figure.ts` (`buildOcclusionBank`, `buildOcclusionDrag`, `buildOcclusionType`, `buildNodeCloze`, `buildEdgeCloze`, `buildStructureRebuild`, `buildLayerOrder`), `engine/exercise-check-figure.ts`, `engine/diagram-layout.ts` (`layoutDiagram`, Q4), `engine/diagram-edit.ts` (`applyDiagramText`, `renameNode`, `diagramText`), `engine/occlusion-edit.ts` (`placeLabel`, `moveBox`, `resizeBox`, `clampBox`), `import/zip.ts fileKey` (new normalisation).
- Spec types: a `figure` on the existing `type`/`choose` specs (`{kind:'occlusion', mediaId, boxes, target, hide}` | `{kind:'diagram', …, hidden}`), and new shapes `place` (occlusionDrag) and `connect` (structureRebuild). Responses `{point|boxId}` and `{edges}`.

**3. Spec tests (checkpoint b).** Agents below. Resolve SPEC-GAPs into the Decisions log. Plumbing tests are written directly: migration, `MediaRepo.findBySourceHash`.

**4. Engine (checkpoint c).** Implement the step-2 stubs until green. Replace the `diagramFallback` rows for the six kinds (`hotspot`/`redraw` keep falling back). Rules:
- Bank options come only from the same image's boxes (`group`), shuffled with `rngFor`. With fewer than `OCCLUSION_BANK_MIN_OPTIONS` options it falls back to `occlusionType`.
- Drag is graded by `hitTest` of the drop point; tap-a-box sends the box id (same verdict). With a single box, drag falls back to type.
- Typed answers go through `gradeTyped` (accept list, collision guard among the same image's labels).
- edgeCloze asks for the label, or for the target node when the arrow has no label.
- Rebuild uses `gradeEdgeSet` on from→to (labels per Q8).
- layerOrder uses `gradeSequence`.
- `diagram-layout.ts`: deterministic layered layout.
- `diagram-edit.ts`: text edits keep node IDs by normalised label and edge IDs by (from, to); a rename only through `renameNode` keeps the ID.
Tests: unit + sim (`npm run test`).

**5. Images: storage and orientation (checkpoint c).**
- `WebImageEncoder`: `createImageBitmap(blob, {imageOrientation:'from-image'})` explicitly (EXIF baked in), long side `IMAGE_MAX_PX`; JPEG fallback if Q7.
- `sourceHash` computed on the original bytes in `prepareImages`; `draftImage` reuses by `sourceHash`, then `hash`.
- `services/storage-guard.ts`: `navigator.storage.persist()` on the first image save (once; result logged). `QuotaExceededError` from `writeBatch`/`putBatch` → typed error "Your device is out of space for images. Delete unused courses or images and try again." shown on import and in the editors.
- Blobs stay in IndexedDB only; image URLs come from `URL.createObjectURL` with revoke on destroy (`ui/figures/media-url.ts`).
- **Encoding never blocks the main thread** (user, after the spike: a 2000 px WebP encode took 1–3.6 s per page at 4× throttle): encode in a Web Worker (OffscreenCanvas is available there), falling back to the main thread with a progress indicator where workers can't encode.
Tests: unit (fake encoder; quota mapping). Playwright later covers EXIF with a rotated JPEG fixture in step 9.

**6. Import, zip, prompt (checkpoint c).**
- `fileKey`: lowercase, drop the extension, remove spaces/underscores/hyphens (Q9). Two zip files with one key → a preview error naming both.
- `@occlusion <file>` takes optional `box: <label>` lines → `unplaced`.
- Missing images: the block is still skipped (line error kept), and the preview shows one summary line "N images not found: a.png, b.png".
- Re-import: an occlusion note whose image (by `sourceHash`) already has an occlusion note in the course is skipped (its boxes are untouched). A diagram whose normalised structure matches an existing one is skipped. Both are listed under the existing duplicates disclosure (`dropDuplicateNotes`, `noteFingerprint` gains image fingerprints).
- `docs/PROMPTS.md` §3 FORMAT + `import/prompt-v2.ts`: `@diagram stack|flow`, arrow lines, `source:`, `@occlusion <file>` + `box:` lines, "use the exact image file names the student lists; never invent images; if you can't place an image write `[CHECK] image <name> not placed`". Intake text: how to zip the .txt with its images.
Tests: parser/zip/golden-file unit tests (`tests/golden/import/` gets a diagram + occlusion zip case), `ImportService` re-import test (no second note, boxes intact).

**7. Services (checkpoint c).**
- `OcclusionService` (`load(noteId)` → note + media URL source; `save(noteId, boxes, hide, title)` via `NoteRepo` + `planCardRegen` so box IDs keep cards; `create(courseId, topicId, file)`).
- `DiagramService` (`load`, `saveText` → `applyDiagramText` + regen, `rename`, `create`).
- Both in `services/figure-wiring.ts` (lazy route import only).
- `StudyService` exposes the figure data the spec needs (media id → blob via `MediaRepo`) and "show original" (`sourceMediaId`).
- `toEditFields` stays null for image notes; `CardListService` gets `editorHref(note)`.
Tests: unit with fake-indexeddb (box delete tombstones only that card; reorder changes nothing; rename keeps the card ID; text edit that drops an arrow tombstones its card).

**8. Components (component checkpoint).** All use tokens only and go in `/dev/ui` (a new "Figures" guide section) in both themes, with visual snapshots.
- `OcclusionFigure`: `<img>` + SVG overlay, `viewBox 0 0 1 1`, `preserveAspectRatio none`; hide one/all; target highlight; boxes are buttons with aria-labels; the image has `alt` = title.
- `DiagramFigure`: SVG from `layoutDiagram`; hidden node/edge slot; a text alternative listing every layer/arrow for screen readers; zoom by pinch/buttons optional.
- `PlaceExercise`: drag the label chip onto a box, or tap a box.
- `ConnectExercise`: tap the source node, then the target node, to add an arrow; tap an arrow to remove it; a diff view after checking.
- The `type`/`choose` components render `spec.figure` above the question.
- `ShowOriginal` (Sheet with the source image).
- `OcclusionEditor`: draw a box by drag, or tap-to-place a default-size box; move/resize by drag or by step buttons (←↑↓→, bigger/smaller); delete; label input; tray of `unplaced` labels to tap-place; hide-mode Segmented.
- `DiagramTextEditor`: textarea in the import grammar + live read-only `DiagramFigure` + parse errors per line + a rename-node list (keeps IDs).
Tests: unit for pure helpers + `layout.spec.ts` + `visual.spec.ts`.

**9. Screens (screen-group checkpoint).**
- `/course/[id]/image/[noteId]` (occlusion editor) and `/course/[id]/diagram/[noteId]` (diagram editor), both lazy.
- Manual mode: "Image (hide parts)" (upload, paste or camera via `<input type=file accept=image/* capture>` + paste handler → `OcclusionService.create` → editor) and "Diagram" (`DiagramService.create` → editor) added to `MANUAL_TYPES`.
- The card list's image notes get an "Edit in editor" link.
- The import done screen lists occlusion notes with unplaced labels ("Place 5 labels").
- The study page shows figures and "Show original".
- e2e: `diagrams.spec.ts` (import a zip with OSI stack + flow + occlusion with `box:` lines; place labels; study one card of each kind including drag-by-tap and connect; edit a diagram's text and check card IDs unchanged), EXIF fixture test, quota message test (stubbed), plus `@both` layout rows for both editors.

**10. OCR spike (no UI; go/no-go, user 2026-11-20).** Replaces the dropped PDF import step. tesseract.js on the six picture pages (10, 12, 15, 19, 21, 30) of the spike PDF, rendered before pdf.js was removed and saved as `tests/fixtures/spike/page-NN.png` (git-ignored). Ground truth = the same hand-written labels in `tests/fixtures/spike/truth.ts`. Report `docs/spikes/OCR_SPIKE.md`:
- label hit rate with usable positions;
- merged digits ("1 1" → "11");
- size of worker + core + English data;
- time per page with the CPU throttled 4×;
- whether it works offline after first use (self-hosted `workerPath`/`corePath`/`langPath`).
Bar: ≥ 70% of labels with usable positions, total download ≤ ~6 MB, ≤ 8 s per page throttled. **Stop for the user's go/no-go.**

**11. OCR box suggestions (only on a go after step 10; checkpoint c).** tesseract.js self-hosted (`workerPath`, `corePath`, `langPath` under `static/ocr/`), loaded on demand in a worker with progress, line-level boxes ≥ `OCR_MIN_CONFIDENCE`, runtime-cached ("works offline after first use"), out of the shell and the precache; suggestions shown in the occlusion editor for the student to confirm.

**12. Service worker + verify (checkpoint d).**
- `vite.config.ts`: `globIgnores` for heavy lazy chunks (pdf.js, tesseract, the diagram-editor chunk if large) + `runtimeCaching` CacheFirst for them.
- `bundle-check` heavy list gains `pdfjs-dist`, `tesseract.js`.
- `npm run build:test` then `npm run verify`.

**13. Review (checkpoint e).** `reviewer` (Sonnet), fresh session, diff since the step-0 commit, spec sections below, `test-results/summary.md`.

**14. Handoff (checkpoint f).**
- HANDOFF: figure APIs, editors, the image data shape for Phase 9 (media blobs + `sourceHash`; export must carry blobs and restore by `sourceHash`).
- DATA_MODEL note for Phase 9 backup.
- DESIGN §7 gains the figure components.
- CONCEPT/BUILD_PLAN §7 updated to the decisions.
- Decisions log rows, PROGRESS, phase table (6 Done, 9 Next), delete WIP.md. Push only after the user confirms.

## Agents
| Step | Agent | Owns (writes only) |
|---|---|---|
| 3 | spec-test-writer (Sonnet) | `tests/unit/engine/{exercise-build-figure,exercise-check-figure,diagram-edit,diagram-layout,occlusion-edit,cardgen-figure}.test.ts` |
| 3 | spec-test-writer-haiku | `tests/unit/import/zip-filekey.test.ts`, `tests/unit/db/media-source-hash.test.ts` |
| 13 | reviewer (Sonnet) | none |

**Sonnet brief:**
> Phase 6, workflow step 2. Write Vitest tests (fast-check where a property helps; fixtures in `tests/unit/engine/fixtures.ts`) from JSDoc + spec only; never read function bodies (they throw). Modules: `src/lib/engine/exercise-build-figure.ts`, `exercise-check-figure.ts` (through `buildExercise`/`checkResponse`), `diagram-edit.ts`, `diagram-layout.ts`, `occlusion-edit.ts`, and the occlusion path in `cardgen.ts`.
> Read only: BUILD_PLAN §5.1 (kinds), §6.2–§6.3 (rating, criterion, recognition never the final correct), §6.10 (hit test, fuzzy, collision), §7; DATA_MODEL §4.2–§4.3; CONCEPT §13; the Decisions log rows starting "Phase 6"; `docs/WIP.md` "Decisions"; config block "Phase 6" in `defaults.ts`.
> Cover:
> - Bank options only from the same image, fewer options for small images, fallback below the minimum.
> - Drag hit inside, on the edge and outside, at several rendered sizes; tap-a-box equals drag.
> - Typed: short labels exact, collision among sibling labels.
> - edgeCloze answer with and without a label.
> - Rebuild missing/extra, direction matters.
> - layerOrder.
> - Determinism with the same seed.
> - Layout determinism, no overlaps, stack is vertical, layers ordered.
> - Text edit keeps node IDs by label and edge IDs by (from, to); rename keeps the ID; a removed arrow removes only its variant; reordering lines changes no ID.
> - Box clamp in [0, 1].
> Write only the owned files. Report test counts per file and every SPEC-GAP with the reading you chose.

**Haiku brief:**
> Phase 6, plumbing tests. `src/lib/import/zip.ts fileKey` (case, spaces, underscores, hyphens, extension, folders; key collisions reported by `readImportZip`) and the `media.sourceHash` index + `MediaRepo.findBySourceHash` + the Dexie migration (old rows still read).
> Read only: BUILD_PLAN §4.2, DATA_MODEL §3.8, the "Phase 6" Decisions rows.
> Write only the owned files. Report counts and SPEC-GAPs.

## Known limits (write into the Decisions log; don't solve)
- Trees, ER diagrams and tables don't fit stack/flow. For now they are done with image occlusion (e.g. hide the keys in a B-tree). Open point for a later phase.
- Slide images (SESSION_NOTES §F) stay open. This phase supports: upload, paste, camera photo, a zip with the text, and PDF only if the spike passes. No pptx conversion.
- `hotspot` and `redraw` keep falling back.
- The Svelte Flow canvas is not built (Q5).

## Where the docs disagree (to fix in step 14)
1. BUILD_PLAN §7.1 puts OCR in the core editor; the user makes it optional and last.
2. BUILD_PLAN §7.2 says Svelte Flow is the editor and ELK runs in a worker; the user wants a text-first editor (and Q4 proposes no ELK). CLAUDE.md rule 9 names elkjs/Svelte Flow.
3. CONCEPT §13 and BUILD_PLAN §7.1 say "hide one / hide all (setting)" (app-wide); the user wants it per image.
4. CONCEPT §12 ("wrong links are peeled off as small focused cards") vs the user's scope ("rebuild graded as a set") — Q8b.
5. `IMAGE_MAX_PX` 1600 vs the user's ~2000 (Q6).
6. SESSION_NOTES D6 says "the diagram/stack version [of sequences] comes in Phase 6"; it isn't in the user's scope (Q10).
7. The Decisions row "Phase 6 must also close the import prompt's gaps" names `import/prompt.ts`; the file is now `import/prompt-v2.ts`, and PROMPTS.md has no diagram text at all.
8. DESIGN.md has no figure/editor components; they're added to §7 at handoff.
9. The cardgen occlusion path has no `occlusionDrag`, though BUILD_PLAN §7.1 lists drag as an answer type (Q3).

## Open questions (with recommendation)
1. **Spike PDF:** can you put one real lecture PDF with SmartArt-style diagrams in the repo (e.g. `tests/fixtures/spike/slides.pdf`, git-ignored if private)? *Rec: yes, git-ignored.* Without one the spike can't give accuracy numbers.
2. **Spike verdict thresholds:** *Rec:* go if ≥ 80% of the visible diagram labels come out with a usable position, the lazy chunk + worker is ≤ ~1.5 MB raw, and a page renders ≤ 1.5 s at 4× CPU throttling.
3. **Occlusion path:** *Rec:* `occlusionBank → occlusionDrag → occlusionType` (the drag finds where, typing recalls what; type last, full weight). Drag always shows every box covered, even in hide-one mode, so there's something to choose between; with one box it falls back to type.
4. **Layout engine:** *Rec:* our own small deterministic layered layout in `engine/diagram-layout.ts` (longest-path layers + barycentric ordering; stacks vertical). It's pure, unit-testable and ~0 KB; no elkjs and no worker. ELK stays a fallback if real diagrams look bad. Alternative: elkjs in a worker as BUILD_PLAN §7.2 says (~1.4 MB raw, lazy).
5. **Svelte Flow:** *Rec: not in Phase 6.* It isn't cheap: Svelte 5 + touch use are unverified (Decisions row §14), it adds a large lazy chunk, and drag-heavy canvas editing at 360 px needs tap alternatives anyway. The text editor + rename list + tap-to-connect rebuild cover the scope. Log it as a later option.
6. **Image size:** *Rec:* raise `IMAGE_MAX_PX` to 2000 (labels on dense slides stay legible when zoomed; a WebP of ~150–400 KB).
7. **Safari/iPhone:** OffscreenCanvas can't write WebP there, so photos fail today. *Rec:* allow a JPEG fallback (`mime: 'image/webp' | 'image/jpeg'`); cheap, and part of step 2's data commit. Alternative: leave it (web on laptop + Android is the priority).
8. **Rebuild details:** (a) *Rec:* grade connections from→to only; arrow labels are tested by edgeCloze. (b) *Rec:* no peel-off cards this phase; after a wrong rebuild the diff shows missing/extra and redo-till-right repeats the rebuild (existing queue). Log peel-off as a later option.
9. **File-name matching:** *Rec:* ignore case, spaces, underscores, hyphens and the extension (so `Slide 12.PNG` = `slide_12.jpg`). A collision inside one zip is an error naming both files.
10. **D6 (sequences as stacks):** *Rec: out of scope*; sequences keep the arrange exercise. Log it.
11. **Re-import of a changed diagram** (same name, different arrows): *Rec:* import it as a new note and list it in the preview as "changed diagram: kept both". Merging import text into an edited diagram is out of scope.
12. **Hide-mode default and where it's set:** *Rec:* default "hide one", set per image in the occlusion editor only (no app-wide setting).
13. **OCR step:** superseded: PDF no-go, so step 10 is now an OCR spike with its own bar (see the Answers section).

## Answers (user, 2026-11-20) — all recommendations accepted, with these additions
- Q1: the Database 2 lecture PDF (B+ tree / B-tree slides; the chatbot reported those diagram slides as garbled) at `tests/fixtures/spike/slides.pdf`. FIRST confirm the path is git-ignored and `git status` doesn't list it. Lecturer's slides: never commit or push them. If the file isn't there, stop and ask the user to place it.
- Q2: the report gives the hit rate separately for (a) text inside diagrams/SmartArt and (b) plain slide text. If the PDF turns diagram text into outlines (shapes, not text), say so: that makes the PDF route a no-go for diagrams.
- Q4: own layout, tested on three real diagrams (the OSI stack, the query-plan flow from the Database 2 sample, a small state machine), with a size cap and the message "too big to draw, edit as text". ELK stays the documented fallback.
- Q6: 2000. Q7: JPEG fallback (classmates on iPhones). Q8b: log peel-off as a later option. Q11: list "changed diagram: kept both" in the preview. Q13: decide OCR after step 10.
- **PDF no-go (user, 2026-11-20):** remove pdf.js and the spike scripts in the step-2 commit (keep `docs/spikes/PDF_SPIKE.md`); old step 10 dropped; step 5 encodes off the main thread; new step 10 = OCR spike (bar ≥ 70% labels with usable positions, ≤ ~6 MB download, ≤ 8 s/page throttled), then stop; step 11 (OCR box suggestions) only on a go.
- Flow: write WIP.md + the Decisions log rows, commit, then run step 1 (the spike) straight away. After the spike, stop at the checkpoint and report the verdict from `docs/spikes/PDF_SPIKE.md`. Don't start step 2 until the user says go or no-go.

## Files most touched
- Engine: `cardgen.ts`, `exercise-spec.ts`, `exercise-types.ts`, new `exercise-build-figure.ts`, `exercise-check-figure.ts`, `diagram-layout.ts`, `diagram-edit.ts`, `occlusion-edit.ts`; `config/defaults.ts`.
- Data: `db/schemas/{note,course}.ts`, `db/db.ts` (migration), `db/repos/content-repos.ts`, `docs/DATA_MODEL.md`.
- Import: `import/{zip,block-parsers,ast,build,duplicates,prompt-v2}.ts`, `docs/PROMPTS.md`.
- Services: `web-image-encoder.ts`, `import-service.ts`, `import-batch.ts`, new `occlusion-service.ts`, `diagram-service.ts`, `figure-wiring.ts`, `storage-guard.ts`, `study-*.ts`, `card-list-service.ts`, `manual-fields.ts`.
- UI: `ui/figures/*`, `exercises/{Place,Connect}Exercise.svelte`, `Exercise.svelte`, `ui/styleguide/FiguresGuide.svelte`, routes `course/[courseId]/{image,diagram}/[noteId]`, `course/[courseId]/add`, the study page.
- Build: `vite.config.ts`, `scripts/bundle-check.ts`.

## Verification
- `npm run test` after every change set.
- `npm run build:test` before any e2e.
- Component steps: `layout.spec.ts` + `visual.spec.ts`. Screen steps: `diagrams.spec.ts`, `import.spec.ts`, `manual.spec.ts`, `cards.spec.ts`.
- Step 12: `npm run verify` (shell ≤ 150 KB, heavy libraries not in the shell, e2e green); read `test-results/summary.md`.
- Manual check in `npm run preview`:
  - Import a zip (OSI stack, a flow, an occlusion slide with `box:` lines), place the labels, and study a card of each kind on a 360 px phone viewport using only taps.
  - Edit a diagram's text and confirm its card IDs are unchanged in the card list.
  - Re-import the same zip: no duplicate image or note, boxes intact.
  - Go offline after first use and open an editor.

## Step 1 status
- 2026-11-20: `tests/fixtures/spike/` git-ignored (5399712). DONE (PDF placed by the user; was: waiting for `slides.pdf` (Database II Lecture 3, Indexing and Hashing) there. Early signal from the text the user attached in chat: the figures on pages 10, 12, 15, 21 and 30 (dense/sparse/secondary index tables, B-tree node layouts) contribute no text, so they are probably pictures; the B+/B-tree insertion steps (pages 22–28, 33–38) do carry their numbers as text, with two-digit keys split per digit on page 27. Confirmed by the spike.)
- Spike: `scripts/spike/pdf-spike.ts` (text), `scripts/spike/pdf-render.ts` (throttled render); ground truth in the git-ignored `tests/fixtures/spike/truth.ts`; `pdfjs-dist` 4.10.38 is a devDependency until the go/no-go. Step 5 note: the WebP encode of a 2000 px canvas takes 1–3.6 s at 4× throttle, so encode off the main thread or show progress.

## Not yet in the docs (decided while building)
- Step 2 (as built): stubs are `MediaRepo.findBySourceHash`; `engine/diagram-layout.ts layoutDiagram`; `engine/diagram-edit.ts mergeDiagram(previous, parsed, name, newId)`, `renameNode`; `engine/occlusion-edit.ts clampBox`, `addBox`, `placeLabel`, `moveBox`, `resizeBox`, `removeBox`; `engine/exercise-build-figure.ts` (7 builders); `engine/exercise-check-figure.ts checkPlace`, `checkConnect`; `import/diagram-parser.ts parseDiagramText`, `formatDiagram`; `import/zip.ts imageKey` (replaces `fileKey` in step 6). These differ from the plan's names: text ↔ diagram lives in `import/` (the grammar), while the ID-keeping merge is in the engine (`ParsedDiagram` → `DiagramStructure`).
- Step 2: figures are optional fields on `TypeSpec`/`ChooseSpec`/`OrderSpec` (`figure?: Figure`); new shapes `place` (PlaceSpec, response `at: {boxId} | {point, size}`) and `connect` (ConnectSpec, response `edges`). `OcclusionFigure.covered` lists the covered boxes and `target` the highlighted one (null for drag). Diagram figures carry `layout` (null = too big), so the UI never imports the layout engine.
- Step 2: `place` and `connect` have no micro hint (`hint.ts`, `exercise-ui.ts`); Q10 covers typed, list and choice only.
- Step 2: the occlusion card path change (`occlusionBank → occlusionDrag → occlusionType`) and the `diagramFallback` removal happen in step 4 (implementation), so the spec tests drive them.
- Step 2: `pdfjs-dist` and `scripts/spike/*` are removed (in git history at 26de7ee); the six picture pages for the OCR spike are `tests/fixtures/spike/page-{10,12,15,19,21,30}.png` (git-ignored).

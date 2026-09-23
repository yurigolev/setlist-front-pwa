# Design QA — song view and edit

## Evidence

- Source visual truth: `design/mockups/song-view-ionic-dark.png` and `design/mockups/song-form-ionic-dark.png`, each 853 × 1844 pixels (approximately 426 × 922 CSS pixels at 2× density).
- Browser implementation: `http://localhost:5173/songs/2eb51bab-3dd7-4494-a256-8c6f9b24bacc` and `/edit`, dark theme, same title, artist, and notes as the mockup.
- Captures: `/Users/1g/.codex/visualizations/2026/09/22/01a0c9d6-4a26-7401-a188-d73cd3a71c39/song-view-mobile.png` and `/Users/1g/.codex/visualizations/2026/09/22/01a0c9d6-4a26-7401-a188-d73cd3a71c39/song-edit-mobile.png`.
- The in-app browser's narrowest override rendered at 480 × 922 CSS pixels; its screenshots are 960 × 1844 pixels. Comparison accounted for the wider implementation viewport and extra capture canvas. Exact pixel alignment is therefore unavailable.

## Findings

- [P2] Populated media state remains visually unverified. Both source images contain notebook photos and MP3, while the browser test song has no attachments. The code renders a thumbnail row, MP3 tile in edit mode, and player in view mode, but their visual fidelity against the reference cannot be judged from the captured state. Add two photos and an MP3 to the test song, then capture both routes at the same viewport.
- [P3] The source textarea includes a paperclip ornament. The implementation uses the separate attachment action below the form, so the ornament is omitted to avoid a duplicate control.

## Checked surfaces

- Typography: system sans, title hierarchy, label and note sizes checked in the browser. The implementation is slightly denser than the source at the available 480 px width.
- Spacing and layout: form fields, notes panel, attachments heading, save CTA, and fixed bottom navigation are present in the correct order. The textarea and field gaps were reduced after the first comparison so the action area fits the mobile viewport.
- Colors: dark background, raised field surfaces, muted labels, thin borders, and turquoise primary actions use the shared shadcn-style tokens.
- Images: no fabricated thumbnails are shipped. User-selected PNG/JPEG/WebP files render from local storage; media crop and quality await a populated visual check.
- Copy: title, artist, notes, attachment action, and save action match the intended Russian flow.

## Interaction and technical checks

- Created a song, opened its detail page, opened the `reka-ui` actions menu, entered edit mode, saved notes, and returned to view.
- Changed the title and used Back; the unsaved title did not persist.
- New attachments and removals are staged until Save; the edit component test confirms MP3 appears as a tile without the pinned player.
- Browser console showed no errors or warnings in the checked flow.
- `npm run build` passed; `npm test` passed (7 files, 16 tests).

## Comparison history

1. The first browser pass showed editing directly on the detail route. The detail route was changed to read-only, with `/songs/:id/edit` for editing.
2. The first edit capture showed a tall textarea hiding attachments behind the save action. Field and textarea dimensions were adjusted, then the mobile form was captured again.
3. The source shows image thumbnails and an audio tile in one row. The edit attachment layout was updated to use one three-column grid; component tests passed afterward. A populated browser capture is still required.

## Gallery player update — 2026-09-23

### Evidence

- Source visual truth: `/Users/1g/.codex/generated_images/01a0cd70-17dc-78c3-baec-72b1dda6ee47/exec-4b1b62de-c21b-4f99-9ff6-d99d51a5a030.png` (390 × 844).
- Browser implementation: the live Setlist song route at `http://localhost:5173/songs/e9d3bd87-0822-4848-8455-19ef74367c15`, captured in the current browser session with populated images and `батареи.mp3` in the open-gallery state.
- Compared state: gallery open, image 1/10 and 3/10, 540 × 1280 browser capture (the existing local application viewport). The screenshot stage, navigation hint and player were reviewed together with the selected visual target; the implementation uses the real selected media rather than generated placeholder assets.

### Findings and resolution

- [resolved P1] The original gallery hid the player and reserved 58 px for thumbnails. The player is now rendered inside the gallery and the thumbnail rail is removed.
- [resolved P1] Playback controls are still usable in gallery mode: play/pause and the native range scrubber share the same audio element as the normal song screen. The component test exercises this control.
- [P3] The viewer's actual image aspect ratio determines the available stage height, so its exact crop may vary more than the fixed mock. This is intentional: `object-fit: contain` keeps every chord screenshot fully visible.

### Required fidelity surfaces

- Fonts and typography: existing system UI, title and small timing labels retain their prior hierarchy; filename truncation remains available through `.player-content`.
- Spacing and layout rhythm: the removed thumbnail rail gives the player its own 80 px bottom zone; the stage now receives the remaining height and never has controls overlaid on it.
- Colors and tokens: the player uses the existing dark graphite surface, primary-blue play control and shared contrast tokens.
- Image quality and asset fidelity: selected screenshots continue to use their original stored image files, unmodified and uncropped beyond contain-fit.
- Copy and content: current screenshot counter, swipe hint, playback filename and timing remain real application content.

### Interaction and technical checks

- Browser: opened populated gallery and confirmed the persistent player is visible with no thumbnail strip.
- Unit test: `npm test -- --run src/components/AttachmentList.test.ts` — 4 passed, including the gallery play control.
- Build: `npm run build` — passed.

### Comparison history

4. Replaced the gallery thumbnail rail with an in-dialog player after selecting the revised visual. Browser evidence showed the player, swipe hint and full screenshot stage together; no P0/P1/P2 difference remains.

final result: passed

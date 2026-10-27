# Song tags — current behavior

Current UI: multi-select ANY (at least one selected tag), combined with text/audio filters. All tags stay visible without tag search, collapse controls or an ANY/ALL selector. The library filter has no heading or selection count; selected tags expose Reset and a matching-song count. The song form shows its heading and selected count. Tag settings support an optional color via 12 swatches, HEX, lazily loaded ChromePicker and “Без цвета”. Saving requires a valid name and a changed name or color. Offline snapshots retain tag colors and assignments.

Current code review follow-up (2026-10-26): frontend 158 tests, production build and lint passed; backend disposable QA suite and 13 setlist API scenario groups passed, along with typecheck, build, lint and migration check. OpenSpec strict validation and both repository diff checks passed. Repeat source review found no remaining actionable findings in the six reviewed issues. Browser visual checks were not rerun for this cleanup.

The sections below record earlier QA runs and screenshots. Their test totals and intermediate UI descriptions are historical evidence, not verification of the current working tree. Current requirements live in `openspec/changes/song-tags/`.

# Historical QA: Tag colors — 2026-10-26

- `vue-color` ChromePicker styled with existing surface, border, ring, typography and rounded controls. Loaded on opening custom color; alpha disabled. Palette of 12 colors, HEX field, live chip preview, explicit “Без цвета”.
- New tags receive a client-side suggestion from the least-used palette colors. Existing uncolored tags stay neutral. Backend stores nullable uppercase HEX and never generates colors; PATCH omission preserves color, null clears it.
- Shared AppTag carries color through settings, selection/filter, song details and compact library rows. Selection retains tag color and adds a check mark and outline.
- Real components verified in an isolated in-memory fixture at 390×844, 320×740 and 1280×900, with no horizontal overflow. HEX, picker click, keyboard arrows and synthetic touch events update the same preview; save closes the dialog and restores trigger focus. API mutations in the fixture stay in memory.
- Mobile picker screenshot: `.playwright-cli/page-2026-10-26T18-52-34-043Z.png`; desktop palette: `.playwright-cli/page-2026-10-26T18-55-03-533Z.png`. The temporary fixture was removed after verification.
- Frontend: 156 tests, lint and production build passed. Backend: 40 tests plus 13 setlist API scenario groups, typecheck, build, migration check and lint passed. Tests cover color validation, null/omitted semantics, color-only PATCH and revision behavior, copy mapping, cancellation, native HEX validity and offline snapshot persistence.
- Additive migration `0009_tag_colors` applied to the persistent local backend; API rebuilt and healthy. Existing tags remain uncolored. Local app: http://127.0.0.1:46544/.

## Historical QA: Library tag filter — 26 October 2026

final result: passed

Selected target: generated image exec-c60105d6-2a31-4538-b33d-0444f3bfe471.png, option 1 revised without condition selector. Scope: inline library tag block; existing header, song row spacing, typography and universal tag visuals retained as requested.

Evidence: /Users/1g/.codex/visualizations/2026/10/26/01a1792c-d523-7252-a51d-54a307f5142c/tags/library-filter-comparison.png and library-filter-mobile.png. Reference normalized to 390×844 beside native 390×844 capture. Same dark theme, six tags, two selected; fixture has 3 matching songs rather than illustrative 12. Fixture renders real LibraryView, TagPicker, AppTag and layouts with in-memory data; user database untouched.

Initial comparison: filter heading and outer spacing too large (P2). Reduced heading to 16px and vertical spacing to 16px/12px; recaptured and compared side by side. Final scoped comparison: compact two-row cloud, count/reset alignment, reusable icon pills, separator and results count match the intended hierarchy. Existing app fonts/colors and row padding retained. No raster assets required. Selected style uses existing AppTag tint/ring rather than adding separate library visuals. No outstanding P0/P1/P2. Browser verified multi-selection ANY (union includes both single-tag songs), count 2, result 3, reset restores all 4. Search remains hidden with six options, appears above eight. Unit tests cover search and reset. All 149 tests, build and lint passed.

---

# Historical QA: Track tags — shared chips follow-up

Date: 2026-10-26 (Europe/Moscow).

- Source visual truth: approved settings chips, `/Users/1g/.codex/visualizations/2026/10/26/01a1792c-d523-7252-a51d-54a307f5142c/tags/page-mobile-final.png`; the user's attached old checkbox form identifies the surface to update.
- Implementation: `/Users/1g/.codex/visualizations/2026/10/26/01a1792c-d523-7252-a51d-54a307f5142c/tags/track-edit-chips.png` and `/Users/1g/.codex/visualizations/2026/10/26/01a1792c-d523-7252-a51d-54a307f5142c/tags/track-view-chips.png`, real SongFormView/SongView rendered in a temporary in-memory fixture at390 ×844 CSS/image pixels. Browser viewport override585 ×1266 compensates devicePixelRatio1.5; screenshots are not stretched.
- Combined comparison: `/Users/1g/.codex/visualizations/2026/10/26/01a1792c-d523-7252-a51d-54a307f5142c/tags/track-tags-comparison.png`, settings style reference left, new track edit right. Full screens and the readable chip groups were inspected together. Different screen content is intentional; comparison concerns tag shape, padding, icon, selected state and typography.
- Typography: same AppTag15px text and22px Phosphor tag icon on mobile, no separate checkbox labels.
- Spacing/layout: same48px minimum height and10px18px inner padding; naturally wrapped rows,10px gaps. On the track view,24px separates tags from notes. Form chips are expanded; library filter remains collapsible.
- Colors/tokens: same surface/border/ring tokens; selected chips have a ring and subtle blue surface. No ellipsis or remove icon in toggle chips.
- Assets: existing Phosphor icons, no generated assets or approximations required.
- Copy/content: «Теги песни», selected count, all existing tags; creation remains in settings. Search appears in the form when more than eight tags exist.
- Browser checks: toggled Светлое on and Грустное off, saved, then verified only Лаунж and Светлое on SongView. Read-only tags have no buttons; editor chips use aria-pressed. Browser uses in-memory store mutations; user data untouched. Fixture removed after verification.
- Regression:148 tests passed; build and lint passed. Tests cover expanded chips, multi-select/removal, disabled state, search/filter and offline viewer filtering.
- Findings: no actionable P0/P1/P2 differences. Existing long edit-page heading wrapping predates this change and is outside tag scope.

final result: passed

---

# Historical QA: Song tags — chips and modal QA

Date: 2026-10-26 (Europe/Moscow).

## Source and rendered evidence

- Selected visual target: `/Users/1g/.codex/generated_images/01a1792c-d523-7252-a51d-54a307f5142c/exec-ba6056ba-83dd-43b1-82c8-f19017629b52.png`.
- Explicit later user adjustments: smaller tag padding, no ellipsis icon; then +4px horizontal padding per side with unchanged vertical padding. Final navigation request combines members and invitations into one «Доступ» tab; owner navigation is now «Общее / Теги / Доступ».
- Source image: 1012 × 1554 pixels, normalized proportionally to 845 × 1297 in `/Users/1g/.codex/visualizations/2026/10/26/01a1792c-d523-7252-a51d-54a307f5142c/tags/source-normalized.png`.
- Browser CSS viewport: 845 × 1297. IAB viewport override 1268 × 1946 compensates host devicePixelRatio 1.5. Native screenshots are 845 × 1297 with no stretching. The initial low-level screenshot had a 70px bottom crop; it was compared using a matching crop, never stretched in the final evidence.
- Final screenshot: `/Users/1g/.codex/visualizations/2026/10/26/01a1792c-d523-7252-a51d-54a307f5142c/tags/dialog-final-compact.png`.
- Full comparison, source left / implementation right: `/Users/1g/.codex/visualizations/2026/10/26/01a1792c-d523-7252-a51d-54a307f5142c/tags/comparison-final-compact.png`.
- Focused comparison of modal typography, field and footer: `/Users/1g/.codex/visualizations/2026/10/26/01a1792c-d523-7252-a51d-54a307f5142c/tags/comparison-dialog-focus.png`.
- Page without forms: `/Users/1g/.codex/visualizations/2026/10/26/01a1792c-d523-7252-a51d-54a307f5142c/tags/page-desktop-final.png`.
- Mobile 390 × 844 CSS/image pixels: `/Users/1g/.codex/visualizations/2026/10/26/01a1792c-d523-7252-a51d-54a307f5142c/tags/page-mobile-final.png`; modal state before the last horizontal-only padding change: `/Users/1g/.codex/visualizations/2026/10/26/01a1792c-d523-7252-a51d-54a307f5142c/tags/dialog-mobile.png`.
- Actual application components rendered with the app layout and all three production stylesheets in a temporary local fixture. Store mutations were replaced with in-memory test data; no user songs or tags were modified. The fixture was removed after verification. The production dev URL remains http://127.0.0.1:46544/.

## Findings and comparison history

- [P2, fixed] Initial chips were too small and arranged differently from the selected target; increased headings and adjusted grouping before recapture. Later user explicitly preferred compact natural wrapping, smaller inner spacing and no ellipsis; final geometry follows that direction.
- [P2, fixed] Initial modal typography was too small and its vertical position differed from the target. Adjusted heading, description, footer controls and modal position; the full and focused final comparisons verify the correction.
- [P2, fixed] Broad song-row span selectors could override the reusable tag internals. Limited artist-text styling to direct children and used AppTag in every tag surface.
- No actionable P0/P1/P2 findings remain. Existing app shell is intentionally retained.

## Required fidelity surfaces

- **Typography:** system sans retained, tag names 16px/15px; modal title 30px/23px and readable 16px/14px description. Existing app-shell metrics retained. Minor raster-font and icon weight differences are P3.
- **Spacing/layout:** modal 584px maximum, mobile width358px at viewport390 with 16px edges; no horizontal overflow. Desktop chips remain56px high (12px 22px padding), mobile48px (10px 18px). Horizontal padding reflects the user's final +4px adjustment; editing controls exist only inside the dialog.
- **Colors/tokens:** existing #1b1c27 base, surface/foreground/primary/ring variables, quiet red deletion and dimmed modal overlay. Generated raster grain/gradient is not reproduced as product UI.
- **Image/asset fidelity:** no custom raster assets are required. Phosphor tag/plus/trash/close icons are reused from the app's library. Ellipsis intentionally removed per user. No homemade icon artwork.
- **Copy/content:** Russian headings and labels match selected direction. Save is intentionally disabled until name changes; focused input ring and selected text are real accessibility state absent from the mock. Length guidance is accessible but visually hidden.

## Interaction and regression checks

- Browser: existing tag opens modal and focuses/selects its name; rename updates the chip and returns focus to its trigger.
- Browser: add opens a modal; duplicate-name error keeps the form and text; corrected name saves successfully.
- Browser: delete enters a second modal state with affected-song count; confirming removes only the tag and returns focus to Add when its trigger is gone.
- Browser: desktop and mobile modals, no page inputs; mobile content width390 equals viewport390, dialog stays within screen. Escape/outside closing and focus behavior use Reka primitives; close and outside actions are blocked during pending mutation.
- Tests:146 passed, including reusable static tag semantics, disabled action, modal rename/error/retry/delete/scope changes, and existing filters/cache/API regressions. Build and lint passed.
- Browser: final owner navigation has three tabs; «Доступ» shows participant list and invitations together. Final targeted regression checks:8 passed; rebuilt and lint passed after merging tabs.
- Browser console error entries: none in the final fixture.

## Follow-up Polish

- P3: system-font metrics, quiet delete-link size and retained navigation shell differ slightly from the generated image. No clipping or unusable controls.

## Implementation Checklist

- [x] Universal store-independent AppTag for static, editable and removable tags.
- [x] Reuse in settings, picker, library and song detail without nested buttons.
- [x] Modal-only CRUD with confirmation and error/loading states.
- [x] Compact padding, no ellipsis, unchanged heights after horizontal adjustment.
- [x] Compare full and focused browser-rendered evidence; verify mobile and primary actions.

final result: passed

---

# Setlivo login — selected concept QA

Date: 2026-10-23 (Europe/Moscow).

## Source and rendered evidence

- Source visual truth: `/Users/1g/.codex/generated_images/01a16766-e908-7b71-ad83-33f8901af763/exec-5e2e8439-cd1c-407c-9719-043204e946e8.png` — first displayed design selected by the user.
- Evidence directory: `/Users/1g/.codex/visualizations/2026/10/23/01a16766-e908-7b71-ad83-33f8901af763/`.
- Original source: 1381 × 1139 pixels; normalized to the intended 875 × 721 CSS target in `login-design-source-normalized.png`.
- Implementation: `http://127.0.0.1:46544/login`, `login-desktop-final.png` (875 × 721 image pixels and CSS viewport). Browser page scaling was compensated by a 1313 × 1082 viewport override; actual document dimensions were verified. The implementation screenshot was not stretched.
- Matched state: remembered account, expired session and a completed cached library.
- Full-view comparison: `login-comparison-final.png` (source left, implementation right).
- Focused typography/button/fallback comparison: `login-focus-final.png` (source left, implementation right).
- Mobile: `setlivo-login-mobile.png`, 390 × 844 CSS/image pixels, no horizontal or vertical overflow.
- Narrow/error state: `setlivo-login-error-mobile.png`, 320 × 640 CSS/image pixels; callback-error query rendered readably with no horizontal overflow.

## Findings and comparison history

Initial comparison (`login-comparison-before-polish.png`, `login-focus-before-polish.png`):

- [P2, fixed] Offline link/caption were too prominent and spaced too far apart. Reduced type to 13/10px and tightened spacing; recentered the content. Final full/focused captures confirm the correction.
- [P2, fixed] Browser title still said Setlist. Updated HTML title and verified the loaded title is Setlivo.
- [P3] System-font wordmark metrics and vertical positioning differ slightly from the generated image. Existing product font is retained; no clipping, collision or wrapping defect.

Post-fix comparison: no actionable P0/P1/P2 findings remain.

## Required fidelity surfaces

- **Typography:** centered Setlivo wordmark, 46px system sans on desktop and 42px at narrow widths; 16px subtitle. Exact visible copy retained. Small generated-font differences are P3.
- **Spacing/layout:** compact 340px group, page surface instead of an app card, no old remote header or repeated session notice. Empty shared header is hidden while its registration anchors remain stable for other screens. Mobile safe-area padding retained.
- **Colors/tokens:** existing #1b1c27 background, off-white foreground, muted secondary text and sage fallback. The generated mock's raster grain is not a product asset; the existing flat product surface is retained.
- **Image/asset fidelity:** original official Yandex SVG used with unchanged colors/icon/wording. Native focus/keyboard behavior retained. Standard 56px button height is intentional instead of reproducing raster dimensions. Setlivo is editable brand text rather than decorative image artwork.
- **Copy/content:** Setlivo, “Песни и сетлисты под рукой”, one primary action and conditional offline fallback. Only the redundant expired-session boilerplate is suppressed on login. Genuine failures/pending logout remain visible. Offline access requires a complete snapshot in the remembered account's namespace and is hidden for logout/access denial.

## Interaction and regression checks

- Browser: clicked the saved-library link; actual saved songs opened with “Нужен вход”, read-only notice and disabled add-song control.
- Browser: official button artwork loaded; proper accessible login label.
- Browser: unavailable-provider callback query rendered at 320px without overflow.
- Browser console inspection returned no error entries in this preview.
- Frontend suite: **117 tests passed**, including safe login returnTo, complete/incomplete cache, account changes, pending logout and callback errors.
- Scoped ESLint, vue-tsc, formatting, diff check and local Docker frontend build passed.
- Only local frontend rebuilt/recreated for this screen. Backend/storage were not restarted. No Git publication or production deployment.
- Viewport overrides reset; verified in-app preview remains open.

## Open questions / follow-up polish

- Optional P3: choose a dedicated brand font later if exact generated-wordmark metrics are desired.
- Existing Chrome PWA tabs may retain the old shell; verified fresh in-app preview shows the updated build. No cookie or private-storage clearing was performed.
- Real provider consent was not repeated for this visual change; the existing login handler and session safeguards are retained and regression-tested.

## Implementation checklist

- [x] Selected design implemented in the existing app.
- [x] Cached-library fallback works without weakening session/access rules.
- [x] Desktop/mobile states captured and compared; P2 findings fixed and recaptured.
- [x] Tests, lint, types and frontend build passed.

final result: passed

---

# Previous design QA history

# Setlists redesign QA

final result: passed

## Evidence

- Source: `/Users/1g/.codex/generated_images/01a12fc1-e8b7-7b51-9aa9-1522e82dd709/exec-9ab1e860-225e-4eda-a6d5-27a5f609cccb.png` (853 × 1844).
- Implementation: `http://127.0.0.1:46544/setlists`.
- Screenshot: `/Users/1g/.codex/visualizations/2026/10/12/01a12fc1-e8b7-7b51-9aa9-1522e82dd709/setlists/mobile.jpg` (390 × 844).
- Combined comparison: `/Users/1g/.codex/visualizations/2026/10/12/01a12fc1-e8b7-7b51-9aa9-1522e82dd709/setlists/comparison.jpg` (780 × 844, source left, implementation right).
- CSS viewport: 390 × 844. Browser reports DPR 1.5; screenshot API returns CSS-sized pixels. Source normalized to 390 × 844 for comparison.
- State: authenticated, dark theme, two real setlists, second selected, creation dialog closed.
- Form evidence: `/Users/1g/.codex/visualizations/2026/10/12/01a12fc1-e8b7-7b51-9aa9-1522e82dd709/setlists/form-320.jpg`.

## Findings

No actionable P0/P1/P2 differences in the combined comparison.

- Typography: native system sans-serif matches the intended hierarchy, 32px mobile heading, readable body and role labels. Titles wrap for long real names instead of clipping.
- Layout: profile, heading, primary create action, grouped rows, selected tint/check and bottom navigation retain target hierarchy. Controls have 44px minimum touch areas. 320px screen has no horizontal overflow.
- Colors: existing Focused Glass tokens retained. Selected copy uses a lighter blue for readability. Generated background texture omitted in favor of the existing app background.
- Assets: original avatar retained; Phosphor library used for playlist, settings, chevron, plus and check. Existing shared bottom navigation retained.
- Copy: real backend titles retained (the second is `Еще сет лист`, unlike mock copy). No invented counts, dates or features.
- Full comparison shows readable labels, icons and spacing at CSS pixel size; an additional focused crop was unnecessary.

## Fix and comparison history

- Initial browser inspection: oversized heading and excessive row gaps relative to target. Reduced heading to 32px and tightened header/action/list spacing. Current combined screenshot verifies those adjustments.
- Form inspection: default focus landed on close button. Added explicit name-field autofocus. Subsequent browser inspection confirms focus on `setlist-create-title`.

## Interaction checks

- New setlist opens a labeled accessible dialog and focuses name input.
- Empty name disables submit; entering a name enables it.
- Escape closes dialog and restores trigger focus.
- Settings gear opens settings for the selected setlist.
- Setlist row opens its song library; bottom navigation returns to setlists.
- Browser console error check returned no errors.
- `npm run build` passed (TypeScript and production bundle).
- Creation POST was not submitted during QA; existing store/API behavior is retained.
- Empty/loading/offline presentation implemented; those states were not simulated in the browser.

## Follow-up polish

- P3: exact synthetic mock icon shape and text weight differ slightly from native system font and Phosphor icons.
- P3: shared bottom navigation retains its existing dimensions rather than altering unrelated screens.

## Implementation checklist

- [x] Implement selected direction in existing page.
- [x] Preserve opening, settings and creation APIs.
- [x] Accessible creation dialog and focused name field.
- [x] Browser-check mobile screen, narrow form and transitions.
- [x] Compare normalized source and rendered output together.
- [x] Production build passes.

## Scoped follow-up: synchronization and timestamps

final result: passed

- User annotations authorize per-setlist synchronization, synchronization of all setlists below the list, and last successful synchronization timestamps.
- Latest screenshot: `/Users/1g/.codex/visualizations/2026/10/12/01a12fc1-e8b7-7b51-9aa9-1522e82dd709/setlists/sync-times-mobile.jpg` (390 × 844 CSS pixels).
- Combined source/current comparison: `/Users/1g/.codex/visualizations/2026/10/12/01a12fc1-e8b7-7b51-9aa9-1522e82dd709/setlists/sync-comparison.jpg` (780 × 844, source left).
- Typography, palette, avatar, list grouping, create action and bottom navigation remain consistent. Extra row height is intentional to show synchronization dates. Icon library remains Phosphor.
- Requested sync icons replace decorative chevrons to keep separate 44px settings/sync controls on narrow screens. General synchronization appears below the list. No unrelated redesign.
- Current-year dates use compact day/month/time; older dates include the year. Previous timestamps survive refresh failures. Global time records the last fully successful bulk run.
- At 320 CSS pixels no horizontal overflow; actions and labels remain visible. Form and navigation preserved. No actionable P0/P1/P2 visual findings.
- Browser verified an individual background synchronization, successful bulk run for two setlists, unchanged selected setlist, and timestamp persistence after page reload. Browser error log empty.
- Relevant store/snapshot tests: 29 passed. Production build passed.
- Full suite: 67 passed, 2 failed in `AttachmentList.test.ts` (pause expectation and download link expectation). AttachmentList was not modified by this follow-up. Those failures remain unresolved.
- Tests cover cache isolation, duplicate request coalescing, late responses after logout, revoked access, successful timestamp restoration and preserving the successful timestamp on failed refresh.

## Songs page timestamp follow-up

final result: passed

- Scoped change: last successful selected-setlist timestamp below the existing toolbar on the songs page. Existing snapshot metadata supplies the persisted date; both pages share `formatSyncTime`.
- Evidence: `/Users/1g/.codex/visualizations/2026/10/12/01a12fc1-e8b7-7b51-9aa9-1522e82dd709/setlists/songs-sync-time.jpg`, 390 × 844 CSS pixels.
- Existing palette, typography, toolbar, search, song list and navigation retained. Timestamp uses the existing secondary text color at 0.8rem. No horizontal overflow at 390 or 320 CSS pixels.
- Browser verified timestamp visible from persisted snapshot and unchanged after manual refresh failed because backend/session verification was unavailable. Error is separate from successful timestamp.
- Successful live refresh could not be verified in this turn because the local preview/backend was no longer listening. Existing store timestamp tests cover successful updates and failure preservation.
- Production build passed; 29 store/snapshot tests passed. No new business logic introduced.


# Song detail redesign QA — 2026-10-12

final result: passed

## Evidence

- Source: `/Users/1g/.codex/generated_images/01a12fc3-e141-70a1-857b-17da4e4403ac/exec-d6f0ad50-6582-4874-95c9-195f167f4294.png` (853 × 1844), normalized to 390 × 844.
- Browser implementation: `http://127.0.0.1:46544/songs/4b6e2c9d-7c09-4f7f-a668-18c35013298b`, plus a temporary local Vue fixture using the same SongView and AttachmentList with 8 references to the real image and 3 references to the real audio. Fixture removed after testing; no server data was created or changed.
- CSS viewport: 390 × 844, DPR 1.5; screenshot output 390 × 844.
- Implementation evidence: `/Users/1g/.codex/visualizations/2026/10/12/01a12fc3-e141-70a1-857b-17da4e4403ac/song/multiple-after.png`.
- Combined comparison: `/Users/1g/.codex/visualizations/2026/10/12/01a12fc3-e141-70a1-857b-17da4e4403ac/song/comparison-after.png`.
- Gallery evidence: `/Users/1g/.codex/visualizations/2026/10/12/01a12fc3-e141-70a1-857b-17da4e4403ac/song/gallery.png`.
- State: dark theme, authenticated song detail, 8 images and 3 audio rows, first audio selected.

## Findings and intentional differences

No remaining actionable P0/P1/P2 findings in the checked state.

- Typography: existing system sans, 30px title, readable section labels and notes; filenames wrap within flexible rows.
- Layout: global edit action moved to toolbar; standalone song identity; notes then grouped images/audio; copy form collapsed below files. Three thumbnails and +N when more than four images. Scrollable content reserves 224px plus safe area for the persistent controls.
- User explicitly requested preserving the existing photo viewer and floating player format. Gallery markup and styles retained; existing page bubble and bottom navigation remain instead of the flat bars in the source. Consequently more list content needs scrolling than in the mock; bottom padding lets it move fully above the controls.
- Colors: existing graphite/blue theme tokens retained; selected audio uses existing ring color. Synthetic background texture omitted.
- Assets: actual attachments used without invented chord sheets. Eight-image fixture repeats the real image to exercise overflow, not to change product data. Images use contain rather than cropping narrow files. Phosphor icons retained.
- Copy: real notes/title/artist and dynamic counts. Unselected audio shows actual file size when duration is not loaded rather than invented durations. Image downloads remain available in a compact disclosure.
- Full combined comparison is readable at CSS size; gallery screenshot additionally verifies the protected viewer and player surface.

## Comparison history

- First comparison (`comparison-before.png`): section gaps and row heights pushed audio far below the reference. Reduced identity/notes spacing, section type sizes and row heights.
- Second comparison (`comparison-after.png`): rhythm now closer to source. Remaining bottom-control geometry is explicitly preserved by user request, not a drift to fix.

## Validation

- Browser: selected second audio; it appears in gallery bubble. Play/pause succeeded; gallery advanced from image 4 to 5; closing gallery kept selected audio and playback position. Copy disclosure opens destination select and submit button. Copy POST not submitted.
- Regression tests: overflow opens first hidden image; selection changes audio; same media element and seek position survive opening/closing gallery; unavailable files disabled; image downloads preserved.
- `npm run build`: passed. `npm test`: 11 files, 69 tests passed.
- Later browser session reset lost authentication in the temporary fixture; no new final narrow-screen or editor-navigation claim is made. Existing editor route and permission checks retained.

## Follow-up polish / limits

- P3: existing floating controls and native icon/font shapes intentionally differ from generated reference.
- Narrow-screen overflow, copy POST and editor save were not browser-tested during this change.

# Profile redesign QA — 2026-10-12

final result: passed

## Evidence and normalization

- Source visual truth: `/Users/1g/.codex/generated_images/01a12fc8-0f5d-7202-81c1-c819c9f2c524/exec-8fa80390-299d-4c2b-8eab-7a9da6fa0fce.png` (853 × 1844), normalized to 390 × 844.
- Implementation: actual `App.vue` and `ProfileView.vue` rendered in an isolated Pinia fixture, with a memory router and a stubbed logout action. Real sessions were not modified. Fixture intentionally exercises the existing avatar fallback (no photo).
- CSS viewport: iframe 390 × 844. Outer in-app browser reports DPR 0.5 and 780 × 1688 CSS viewport; screenshot clip output 780 × 1688 includes the 390 × 844 iframe at top left. Normalization crops that exact iframe; does not rescale its UI.
- Implementation evidence: `design/qa/profile/mobile.jpg`; normalized capture: `design/qa/profile/mobile-normalized.jpg`.
- Combined source-left/implementation-right evidence: `design/qa/profile/comparison.jpg` (780 × 844), opened and reviewed after spacing changes.
- Narrow offline evidence: `design/qa/profile/offline-320.jpg`, 320 × 640 CSS iframe at top left of screenshot.
- State: dark, account present, online; additional narrow offline state. No setlist or sync content.

## Findings and required fidelity surfaces

No remaining actionable P0/P1/P2 findings.

- Typography: existing system sans-serif retained; 32px title, 22px account name, 15px username, 14px status and 16px exit action. Wrapping supported for long identity fields.
- Layout: centered identity, thin divider, left-aligned logout and anchored navigation match the selected composition. No duplicate SessionHeader on profile. No overflow observed at 320px; controls retain at least 44px touch targets.
- Colors: existing graphite/violet palette and mint/coral semantic colors retained. No amber primary action or light theme.
- Assets: existing UserAvatar component continues to render the real account photo when available; initials state verified here. Standard Phosphor icons retained, including shared UserCircle navigation icon instead of the generated mock's simplified silhouette.
- Copy: profile/account/status/logout only. Removed setlist section, sync date, refresh action and profile-triggered library load.
- Full-size combined comparison makes all text/icons readable; an additional focused crop was unnecessary for this minimal screen.

## Comparison history

Initial 390px comparison found excess spacing in the identity cluster, pushing the divider/logout below the source. Reduced name margins, username/status line heights and bottom padding. Post-fix combined capture shows the intended hierarchy and proportions. Minor residual vertical differences (~12px) and system font rendering are P3 polish.

## Interaction and technical validation

- Logout click on isolated fixture transitions to login heading.
- Songs and Setlists buttons transition to their routes; shared account header remains on those routes.
- Offline label stays readable on 320px screen and logout remains available.
- Existing auth test suite: 8 tests passed, including logout behavior. Production build passed.
- Console checked: in-app browser reported MutationObserver injection errors during iframe navigation. No MutationObserver exists in project source; these were not application errors. No Vue or application errors observed.
- Real server session revocation was covered by the existing auth tests, not exercised against the user's live account.

## Follow-up polish

- Optional: match generated typography and divider position more closely; original product font and real avatar behavior intentionally retained.

# Profile compact redesign QA — 2026-10-12

final result: passed

## Evidence

- Source: `/Users/1g/.codex/generated_images/01a13011-d3ae-79b3-96e5-f6a4b460a886/exec-02c0ffb8-e02d-4196-b618-2afa7d0a81de.png` (873 × 1800). User selected first direction and requested removing the page heading; revised image is the visual target.
- Implementation: actual ProfileView and shared AppLayout rendered in an isolated local Pinia fixture with memory router. Authentication initialization and logout stubbed; no real sessions or server data changed. Fixture removed after QA.
- Evidence: `design/qa/profile-redesign/mobile.png` (390 × 804); combined source-left/current-right comparison `design/qa/profile-redesign/comparison.png` (780 × 804).
- Viewport: 390 × 804 CSS iframe. Browser override produces outer 780 × 1608 at DPR 0.5; screenshot API returned twice requested clip dimensions. Exact 390 × 804 iframe crop retained without UI scaling; source resized to match CSS dimensions.
- Online account with initials fallback. Actual account photo remains supplied by unchanged UserAvatar; fixture lacks the user's photo deliberately.
- Narrow state: `design/qa/profile-redesign/offline-320.png`, 320 × 640, long display name and username, offline.

## Findings and comparison history

- Initial comparison: account details and logout sat about 30px too low. Reduced avatar to 80px, connection gap/bottom padding, account padding and detail-row height.
- Post-fix combined comparison reviewed: compact left identity, connectivity copy, account details and separated logout retain selected hierarchy. Remaining 10–15px rhythm differences and native font/icon shapes are P3.
- No remaining actionable P0/P1/P2 findings.
- Typography: native system sans, 22px identity, 16px connectivity heading, 14px helper/detail text, 13px section label. Long fields wrap at 320px without clipping.
- Layout: visible page heading removed; account name remains semantic h1. Shared floating nav and safe-area spacing retained. All bottom navigation and logout targets remain visible in checked narrow state.
- Colors: existing Focused Glass tokens and mint/amber/coral semantics retained. Synthetic mock background texture intentionally omitted.
- Assets: unchanged live UserAvatar with initials fallback, Phosphor icons throughout. No newly generated production assets required.
- Copy: selected online text retained; offline and access-denied states have distinct truthful explanations. Missing username hides corresponding account detail.
- Full combined comparison is readable at CSS size; no focused crop needed for this sparse screen.

## Validation and limits

- Songs, Setlists and Profile navigation exercised through shared AppLayout in fixture.
- Stubbed logout transitions to login and hides private navigation. Real logout not executed against the user's account.
- Offline long-identity screen checked at 320px; access-denied state checked in browser; error console empty.
- Production build passed after latest changes. Existing auth suite: 8 tests passed.
- Real authenticated route could not be inspected because in-app browser required login. Backend/session behavior retained; visual checks used isolated fixture.
- Concurrent project changes moved navigation ownership to AppLayout; profile-specific navigation overrides removed. Other layout changes preserved.

## Header layout redesign — 2026-10-12

Source visual truth: `/Users/1g/.codex/generated_images/01a1301d-c680-7062-bfe4-9db554783696/exec-e260c4a2-e5f0-4767-b4f9-216e65bef5c3.png` (1412 × 1114).
Implementation: `output/header-qa/library-final.png`; combined evidence: `output/header-qa/comparison-final.png`.
Viewport: browser DOM reports 480 × 700 CSS pixels; browser capability reports DPR 0.5. Screenshot output includes extra blank canvas; compare the app-owned 480px region. Source scaled proportionally to 480 × 379; implementation cropped to the same header/content region. Screenshot normalization is evidence processing only.
State: isolated visual fixture using real AppLayout, PageHeader and page components, with two songs, online status, owner membership and sync time 12 October 15:36. Avatar intentionally exercises existing initials fallback; authenticated photo remains UserAvatar's existing behavior. No backend data altered.

Findings and comparison history:
- Initial comparison: heading, profile name and filter smaller than selected target; header vertical gaps excessive. Increased heading scale, name/filter sizes; reduced context and search spacing. Recaptured and inspected both source and final screenshot together.
- Profile drift on navigation: row centering tied its position to heading height. Top-aligned the account block with constant 56px minimum area. DOM measurements across Library → Setlists: x=1015.703125, y=26 on both routes.
- Final: no actionable P0/P1/P2 findings in changed header. Composition, palette, system font, setlist context, sync action, search plus add action, underline sorting and playback filter match chosen structure. Existing song-row typography/navigation and minimum 44px targets retained; full list styling outside change scope. Borders/radii use existing tokens; Phosphor icons retained. No new raster assets required.
- Focused comparison: header typography and context/search spacing reviewed in combined image; lower content not a new design surface.

Checks: search filters to Кукушка; add opens Новая песня; back restores library; Setlists and Profile navigation show one h1 within layout; redundant setlist description removed; no horizontal overflow at observed mobile width; no console warnings/errors. New PageHeader regression test passes, including reactive title, working action and cleanup of heading/context on unmount. Build passes. Full suite: 69 passed, one failure in existing AttachmentList download test (`chords.png` expected, undefined received); unrelated to header.

Remaining verification gap: real Telegram session and backend mutations not exercised in visual fixture. Smaller than 480px breakpoints reviewed in CSS but not browser-verified because browser viewport backend clamps width.

final result: passed

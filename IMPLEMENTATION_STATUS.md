# Implementation status

Updated 2026-11-14. Local application implementation; hosted release and broader browser acceptance remain pending.

## Current application

- Single-owner Better Auth login, private sessions and account/security controls.
- Verified R2 image/PDF uploads, multipart transfers, genuine progress, animated verification, private downloads/previews and durable thumbnail processing.
- Nested folders, collections, rename/description/move/star, bulk operations, trash, recovery and confirmed permanent deletion.
- PDF reader with extraction, annotations, notes, bookmarks and reading progress. Scanned PDFs explicitly require OCR; no OCR pipeline is bundled.
- Database-backed filename/trigram and PDF full-text search with filters, snippets, page references, sorting and pagination.
- Secure, revocable, optionally password-protected share links.
- Real analytics, three-entry overview activity and a paginated activity page, settings, local-time presentation (IST for Indian devices), larger text, custom controls and scrollable navigation.
- Inngest durable processing/cleanup; persistent local runner starts with `npm run dev`. Production requires signed provider configuration.

## AI removal

The owner requested removal of all AI and semantic-search features. Removed inference clients, summary endpoint and draft UI, semantic controls/ranking, provider/model environment variables, vector-index script and AI settings. Retained PDF text extraction and thumbnail processing as ordinary file features; retry actions are named reprocess.

Generated and applied migration 0005. It drops `file_embeddings` and its vector indexes, the generated image-caption column, and AI-only settings columns. It rebuilds the full-text metadata index, removes obsolete AI state and attempts to drop the unused vector extension without CASCADE. Existing tracked migrations/snapshots remain unchanged for reliable upgrades. No original R2 files, PDF annotations or extracted text are removed by this migration.

## Validation and limitations

Automated test suites and test-runner dependencies were removed at the owner's request. No new test files are created and no automated tests are run. Source validation uses strict TypeScript, ESLint and a production build; live database catalog checks verify migration results. Full browser workflows are not claimed as verified.

Production deployment, recovery rehearsal, accessibility/performance review and configured cloud workflow acceptance remain pending. No upload resumability across reloads, OCR, malware scanner, passkeys or 2FA are implemented. Default upload ceiling is 1 GiB (configurable up to 5 GiB); processing defaults to 50 MiB and 2,000 PDF pages. Bulk downloads use individual browser downloads.

Current checks: production build, strict TypeScript and ESLint passed. Database catalog checks confirmed embeddings, vector indexes, vector extension and AI columns are absent; the ordinary text-search index exists and all three file records remain. Drizzle generation reports no further schema changes. No automated tests were run.

## Details freshness and subtle interface refinement

The completed uploaded PDF was ready in PostgreSQL, while the open details dialog retained its earlier file-object snapshot. Replaced that static dialog body with an owner-authenticated details query that fetches current metadata and refreshes every three seconds during pending/preparing states. It exposes no R2 object keys or session data. Ordinary PDF extraction and preview creation remain; no AI code was reintroduced.

Redesigned details with a document preview, compact metadata rows, explicit preview/text-search status, retry handling and an Open PDF action. Reduced normal interface text by roughly half to one pixel, refined cards/navigation/dialog styling and moved initial modal focus to its accessible heading. Owner credentials and files were unchanged.

Strict TypeScript and ESLint passed. No automated tests were added or run; browser interaction was not verified in this update.

## Workspace UX and sharing visibility

- Refined workspace navigation, cards, search, toolbars, tables, empty states and small-screen layouts. Added removable filter chips and clear-all behavior, accurate page result ranges, Ctrl/Cmd+A page selection and Escape clearing, a sticky selection toolbar, search clearing, account navigation, and mobile navigation focus/scroll management. Typography remains compact.
- Shared files show a Revoke sharing action. The Sharing details menu works for images and PDFs. The document reader includes per-file shared-link creation/history, created/expiration/last-opened dates, actual access counts, active-viewer counts and confirmed Expire now actions. Link records are server-filtered and paginated.
- Removed the oversized PDF page-number input; compact previous/next controls and a page counter preserve page navigation.
- Migration 0006 adds `share_viewers`: hashed per-tab viewer identifiers, recent heartbeat timestamps and short-lived expiry. Public presence requires a live share and valid signed HttpOnly grant, has origin/input/rate controls, and reports visible authorized tabs seen within 45 seconds. It measures viewing sessions, not unique people. Owner counts refresh every five seconds; public heartbeats occur every 15 seconds, leaving/removal is best effort, and stale rows are pruned by cleanup.
- Active presence revalidates the share and renews the five-minute grant while the page is visible; a revoked/expired share stops rendering when the next heartbeat detects it. Revocation deletes presence rows. AI and vector storage remain absent.
- No automated tests were added or run. Browser interaction is not claimed as verified.

Verification for this update: migration 0006 applied; live read-only queries confirmed the presence index exists and AI/vector tables remain absent. Real sharing aggregation returned one link, one validated view and zero active viewers at inspection time. Production build passed, with subsequent TypeScript/lint checks covering the final source refinements. No browser interaction or automated tests are claimed as executed.

## Collapsible sidebar and clearer preparation history

Added an accessible desktop collapse/expand control beside search, a compact icon rail with labeled navigation, matching workspace width adjustment, and a device-persisted preference. Mobile retains its full navigation drawer.

Renamed Processing history to File preparation and added a plain explanation of PDF text extraction, preview generation and storage cleanup. History is collapsed by default. The owner-protected settings response now indicates whether each job matches its file's current processing generation; older attempts are labeled previous and cannot trigger retry controls. No history records were deleted and no processing status was fabricated.

Strict TypeScript passed. No automated tests were added or run; browser interaction was not verified in this update.

## Tooltips and settings simplification

Added shared Radix tooltip primitives/provider and descriptive hover/focus tooltips to 67 labeled interactive controls, plus shared button/select controls for future reuse. Composition preserves dropdown/popover/modal triggers and existing action labels; tooltip content renders in a portal and supports keyboard dismissal. Native duplicate titles were removed from wrapped controls.

Removed preparation history, related Settings state/types, job queries/polling and obsolete history CSS. Current preparation status/retry and durable job execution remain functional outside Settings. Updated error text to avoid directing users to the removed history. Hid only the sidebar scrollbar; wheel, trackpad, touch and keyboard scrolling remain enabled. Navigation, search and profile controls remain in place, matching the owner's clarification.

No automated tests were created or run; browser interaction is not claimed as verified.

Tooltips/settings update validation: production build, strict TypeScript and ESLint passed. No test files were added and no automated tests were run.

## Expanded product UI/UX pass

- New overview welcome panel with a real active-storage donut, MIME-based byte breakdown, real monthly-upload count, working upload/new-folder actions and quick navigation. Statistics are linked to relevant views.
- More deliberate workspace hierarchy, compact typography, unified surface/border/button styling, dark-theme treatment and mobile layouts, centralized in `src/app/design.css`.
- File cards gain accessible hover/focus star/detail actions and working shared-access indicators; touch devices retain visible controls. File-drop feedback covers the workspace and respects the current destination folder.
- Settings has URL-addressable, keyboard-accessible Account/Appearance/Storage/Security sections. Existing forms retain state across tab changes. Appearance uses visual theme/view/density cards with real persisted preferences. Upload concurrency moved into Storage.
- Password visibility controls use a shared forwarded-ref input and apply to login, account password forms and password-protected sharing. Password values are not logged or persisted by the visibility control.
- Sharing pages gain actual filtered access/presence summaries, clearer status chips, file navigation and mobile table presentation. Activity text uses readable event labels; upload charts include accessible descriptions of actual daily values.
- No automated tests were created or run. Browser interaction was not verified during this pass. Existing AI removal, private storage, owner authorization, hidden sidebar scrollbar and tooltips are preserved.

Validation for the expanded design pass: production build, strict TypeScript and ESLint passed. There were no database schema changes, no new test files, and no automated tests were run. Full browser visual/interaction verification remains unexecuted.

## Density behavior and input guidance

Consolidated the previous partial compact styles into a shared density-token policy in the final design stylesheet. Both layouts now set explicit file preview/grid spacing, metadata/folder padding, list-row padding, Settings/form/group spacing and related panel spacing. Mobile receives corresponding values; fonts and interactive control sizes remain readable. Settings reports the active persisted choice immediately.

Added contextual placeholders to 16 previously uncovered text/password/number/readonly fields and textareas, including metadata forms, PDF notes/bookmarks, account/password fields, share forms and duplicate-file naming. Shared inputs supply type-appropriate fallbacks for future fields; checkbox, radio, range, file and other unsupported placeholder types are excluded. No credentials or data were changed.

No automated tests were added or run; browser interaction is not claimed as verified.

## Font family and size preferences

Added Appearance typography controls for Inter, DM Sans, Manrope, System and Georgia, with small/default/large/extra-large base text sizes, a live preview, immediate device persistence and reset. Bundled DM Sans/Manrope locally and corrected Inter's font-family name to match its bundled variable font.

A global preference synchronizer validates stored identifiers against allowlists and updates document-root CSS properties. All app stylesheet pixel font sizes and 65 inline interface font sizes use the same scale, so dialogs/tooltips also follow the preference. Mobile text inputs retain a minimum 16px font; no layout/PDF scaling or credential/database changes were introduced.

Strict TypeScript and ESLint passed. No test files were added or automated tests run; browser interaction was not verified in this update.

## Inngest removal (supersedes earlier provider setup notes)

Removed both Inngest packages, its API endpoint/client/functions, the combined dev runner, job-service scripts, provider credentials/configuration and related setup instructions. `npm run dev` starts Next.js directly. The running app-specific local CLI was stopped.

Preserved required file operations as owner-authenticated, origin-checked app requests instead of external jobs. PDF preparation advances at most ten pages per request, checkpoints its next page, and resumes while the owner keeps the app open/returns later. Image previews and recoverable R2-first deletion remain functional code paths. Per-file database leases serialize operations across generations; failures retain useful state and support explicit retry. Limits remain 50 MiB and 2,000 pages, with the 50 MiB server-request cap enforced even if a larger environment value is supplied.

Migration 0007 adds the next-page checkpoint to the existing processing-state table; this is recovery state, not an external queue/provider requirement. Maintenance/optional trash retention now run only during owner visits. R2 lifecycle remains the independent cleanup backstop while the app is closed. UI copy no longer refers to provider credentials or a local job runner.

Migration 0007 was applied successfully. Production build (including TypeScript) and ESLint passed after removal. No automated tests were added or run. Live upload/deletion acceptance and browser interaction are not claimed as executed during this removal.

## Vercel PDF preparation packaging

Found the production operations file trace included the PDF.js entry module but omitted its dynamically loaded server worker and rendering assets. Added route-specific file-tracing includes for the legacy worker, standard fonts, CMaps, WASM and ICC profiles, and configured filesystem asset paths for server extraction/rendering. The operations route explicitly uses Node.js. Reader failure copy now refers to preparation and distinguishes the size limit.

Production build (including TypeScript), ESLint and generated artifact inspection passed: the operations trace now includes the worker and all five asset groups. No test files were created or tests run. Vercel runtime logs were not available; this fixes a verified packaging defect, with production retry still requiring verification after deployment.

## Thumbnail-only preparation, simpler search, and appearance refresh

Removed server PDF text extraction, page-text storage code, content snippets/page-reference results and the PDF content-search panel. File search now matches only display/original names, extensions and MIME types with database-side pagination/sorting. The search form offers name and type controls. PDF preparation renders only page one for a thumbnail and records page count; scanned PDFs need no OCR. Original delivery, selection-based highlights, annotations, bookmarks and reading progress remain supported.

Migration 0008 removes the old extracted-text table/index and page cursor, and clears obsolete OCR-only states when thumbnails already exist. It is prepared but NOT applied to the configured database: older deployed app versions still reference the table. New application code can run against the existing schema for review; stop older versions before applying cleanup. Existing extracted text remains stored until migration is applied.

Refined workspace surfaces, sidebar navigation, search controls, file-card selection/hover states, table headers, empty states and settings spacing. Appearance now provides 11 font styles (including humanist Source Sans 3 and handwritten Caveat, Kalam and Patrick Hand), a visual font gallery, eight sizes from 13px to 22px base, a live preview and browser persistence. Fonts are bundled locally. Keyboard focus, touch actions, responsive font cards and reduced-motion behavior are retained.

Production build including TypeScript, standalone typecheck, ESLint and diff whitespace checks passed. No test files were added or tests run; browser behavior and live thumbnail generation have not been verified in this update. No changes were committed or pushed, as requested.

## Typography dropdown revision and release

At the owner's subsequent request, replaced the font-card gallery and size buttons with the existing Radix-based Select controls. All 11 styles and eight sizes remain available, with font-specific option lettering, a live preview, reset, immediate browser persistence and a stacked mobile layout. Removed obsolete gallery styling. Production build including TypeScript, ESLint and whitespace checks passed. No tests were added or run. The owner authorized committing and pushing the accumulated UI and extraction-removal changes. Migration 0008 remains unapplied to the configured database.

## Performance improvements

Configured Vercel sin1 to match the locally configured Singapore Neon region. This changes live execution only after redeployment; production latency improvement is not yet measured. File-list counts/results and workspace metadata queries now run concurrently. Autocomplete has a dedicated authenticated five-result endpoint using one application query rather than six workspace queries plus authentication. Browser fetch cancellation is propagated for suggestions and file requests.

Initial file results are fetched server-side and hydrated with a request-local QueryClient; server/client share query keys and ISO date serialization. Authentication memoization remains scoped to one React render, with no cross-request session cache. Optional screens/dialogs and full analytics split from core file browsing. The existing build artifact comparison showed initial dashboard entry scripts decrease from approximately 187 KiB gzip to 178 KiB; this is a local build-size comparison, not an end-user timing benchmark.

Files and analytics refresh every two minutes instead of frequent polling; operations back off from 15 seconds to two minutes while idle and wake immediately on local events. Metadata stale time defaults to one minute. Mutations invalidate related keys, stars update optimistically with per-file duplicate protection and rollback, and upload completion does not wait for unrelated refreshes. Private thumbnail ETags permit authenticated 304 responses before R2 fetches; originals/public shares retain no-store. Fonts and deep offset pagination remain future optimization areas.

Production build including TypeScript and ESLint passed. No tests were added or run; authenticated browser workflows and post-deployment latency remain unmeasured. No new schema migration is required. Prior migration 0008 was successfully applied and verified at the owner's intervening request. Performance edits remain local and uncommitted.

## General file workspaces, dynamic types and sharing fixes

Removed the fixed upload-format restriction and picker accept list. Names/sizes and MIME syntax remain validated; detected MIME is recorded and known inline types require signatures. Unknown/active formats are attachment-only, and text/Office previews render escaped browser-side content with bounded reads. General files finalize ready without image processing; retrying a generic file cannot enter Sharp. No new migration is needed.

Added /files/[id] with private image zoom, media controls, text/JSON, simplified DOCX/XLSX/PPTX, metadata, original download and FileSharing. Legacy/binary formats provide bounded byte previews and native-app download; full-fidelity rendering of every format is not claimed. Public shared files use the same safe preview component after authorization. Upload verification still checks size and conditional staging copy; completion remains idempotent.

Database-generated extension/MIME facets replace fixed type controls, and storage distribution includes all MIME types. Active sharing replaces Share file with Revoke link in menus/details and share management, with confirmation. New forms default to the next calendar day at the same local hour/minute. Existing expiry/password customization remains available.

No test files were added or tests run. Final production build (including strict TypeScript), ESLint and whitespace checks passed. Browser previews and live new-format upload/share flows have not been executed during this update. Changes remain local and uncommitted.

## Shared-link lifecycle, one active share and reusable URLs

Added active-first listing with database-enforced visibility filters: active links persist; expired/revoked links disappear from listings 24 hours after the first access-ending timestamp. Counts, totals, file-level management and pagination share this policy. Revocation skips already-ended links rather than resetting history. The shared page links to generic file workspaces and provides Open/Copy for each listed state; inactive public URLs still fail authorization.

Share creation rejects existing active links under the transaction write lock. Migration 0009 adds a share lookup index, resolves older duplicate active links by retaining the newest, and installs a database trigger guard. Applied successfully. Read-only verification found the trigger enabled, index present and no duplicate active links; there were no duplicates before migration, so no original links needed revoking.

New raw token URLs are recoverable with a domain-separated HMAC based on a random UUID and server secret; only hashes persist. Older random-token links are supported with versioned signed aliases bound to the existing record/hash. Original URLs remain unchanged and all aliases share the same access controls/counters; no second active share is created. Secret rotation changes signed aliases; owner management can regenerate them.

Production build including TypeScript, ESLint and diff checks passed before final documentation updates; final synchronization follows. No test files were added or tests run. Authenticated browser workflows/concurrency load tests were not executed. This release also includes the previously pending general-file uploads, previews, dynamic filters and default share expiry changes.

## Correct active-share counts and remove /shared revoke action

Identified the repeated file-menu bug in generated SQL: Drizzle single-table projection rewriting removed the outer files qualifier inside the correlated share-count subquery, so s.file_id compared against the inner share row id. Replaced the outer reference with explicit SQL identifiers so the generated query uses files.id. Existing menu logic can now show Revoke link from authoritative state.

Removed the Revoke button, its dialog and mutation handler from the /shared overview, retaining Open/Copy. Revocation remains available through file menus and file-level management. Read-only verification compared the file-list service to an independently joined aggregate: one visible file, one with an active link, zero mismatches. Build including TypeScript, ESLint and whitespace checks passed. No test files were added or test suite run; browser interaction was not executed. No database writes were performed. Changes remain uncommitted and unpushed as requested.

## Inline file-name editing

Added a shared editable-name component to grid and list views. Double-click enters a focused selected input; blur/Enter saves, Escape cancels, and Enter/F2 provides keyboard access. The list file icon retains the open-file action so the first click does not navigate before a double-click can edit the name. Trashed-file names remain noneditable.

Uses the existing authenticated, validated rename API, leaves description untouched, and updates file/detail caches after successful persistence before targeted background invalidation. Unchanged names skip requests; invalid names and request failures return to the original label with an inline error. A submission guard prevents duplicate blur/Enter saves. No schema change or test files. Production build passed; final strict typecheck and ESLint passed after small validation/focus refinements. Browser interactions have not been executed. All changes, including the preceding share-menu fix, remain local and uncommitted.

## Locked rename extensions, unchanged-save guards and menu layout

Added shared base-name/extension helpers. Inline and modal rename edit only the base name, with an immutable suffix outside the input and an adjusted length limit. Inline unchanged/whitespace-only edits skip requests; modal saves skip requests unless the base name or description changed. The API also rejects extension changes and returns early for unchanged metadata, avoiding update timestamps and activity writes.

Removed thumbnail inset padding while retaining contain sizing so one axis fills its preview. File/folder/collection action triggers measure available viewport space on pointer/keyboard opening and prefer top or bottom accordingly; Radix collision handling remains enabled. Action menu height uses its available-space variable plus a 440px cap, with internal scrolling and scroll containment.

Production build including TypeScript, ESLint and whitespace checks passed. No test files were added or tests run; browser layout/interaction remains for visual review. No database migrations or live file writes. Changes remain uncommitted and unpushed, together with prior local fixes.

## Fit-to-view images, live sessions and unified multi-type search

Replaced width-based 100% image sizing with a shared image viewer that measures natural image dimensions and the actual available viewport. Default/reset fit both axes; zoom reflects the actual scale. View full uses native fullscreen (original-image fallback where unavailable). Owner/public previews share this behavior. Inline edit hides the extension while preserving it for saves; input typography/height match the normal file label.

Removed the Filters toggle and secondary search card. One toolbar now holds search, clear, sort/view controls and a checkbox multi-type menu. Repeated type URL values survive parsing, SSR hydration and stable cache keys, then combine through parameterized OR predicates. Type chips remove individual selections. The footer upload banner renders only on /. Read-only verification used one stored type plus a second filter value: both survived parsing/query-key construction and the service count matched an independent database predicate.

Presence no longer deletes a session when the shared tab becomes hidden. Valid open pages heartbeat every 20 seconds; counts require a real heartbeat within 90 seconds. Page close/unmount creates a closed-session tombstone; late updates cannot revive it. BFCache restoration uses a new viewer ID. Maintenance removes sessions after five minutes without a heartbeat. This measures recently connected authorized shared-page sessions, not unique people or attention.

Production build including TypeScript, ESLint and read-only filter checks passed. No test files were added or test suite run; browser/fullscreen/presence interaction still requires visual review. No migration or live file mutations were performed. Changes remain local and uncommitted along with prior fixes.


## Root vs Recent, folder passwords and stable inline editing

Committed and pushed the preceding UI/sharing fixes as `e70aa6d` before beginning this batch. This batch remains local and uncommitted.

Added optional passwords when creating folders, Better Auth password hashing, session-bound 30-minute unlocks, manual Lock/Unlock folder menu actions, and a shared unlock panel for the workspace and destination picker. Nested folder ancestry is checked in server-side listings, search suggestions, collections, direct file/PDF access, uploads, mutations and cleanup requests. Password hashes are excluded from client responses. Protected tree sharing is blocked and moves into protected ancestry revoke links. Applied migration 0010 successfully to the configured database; read-only checks confirmed its table, column and access functions. Existing folders remain unchanged. No test data or credentials were created.

Clarified My files (root) and Recent (cross-folder recent open/upload order) and added Opened/Uploaded labels in Recent. The inline editor measures its original label's width, height and actual font, hides the immutable extension, and resets input scrolling to the beginning on focus. Only truncated names animate across their label on hover/keyboard focus, with reduced-motion support. Existing unchanged-save and extension guards remain.

Production build including TypeScript passed. ESLint and final strict TypeScript/whitespace checks passed. No test files were created and no test suite was run. Browser interaction and the complete protected-folder workflow still require manual review; these checks do not certify end-to-end behavior.


## First-open dialog loading isolation

Traced the first-open workspace skeleton to lazy dialog imports suspending without a nearby boundary. The installed Next.js loadable implementation creates its own boundary only when a loading component is supplied (or SSR is disabled); the existing default imports therefore reached the dashboard loading boundary.

Added a Suspense boundary around the shared Dialog body with an accessible local loading indicator. This covers file details, folder details, file/folder moves, collection pickers, collection file selection and sharing details together. Dialog title and close controls remain available while the module loads; no cache clearing, navigation or extra workspace refetch is added. Existing read-only open handlers do not invalidate workspace data; mutation invalidation remains unchanged.

No test files added and no test suite run. Production build (including TypeScript) and ESLint passed. Browser first-open interaction has not been executed. Changes remain uncommitted.


## Locale/timezone hydration mismatch

Replaced implicit server/browser date formatting at every shared date-helper UI call site with a hydration-aware formatter hook. Server rendering and initial hydration use the same explicit locale/timezone snapshot; subsequent browser rendering uses the owner's browser locale/timezone. Applied across the workspace, file/folder details, file workspace, sharing panels, shared links, activity, analytics and account session dates. Calendar-only analytics dates retain their actual calendar day across timezones.

Production build including strict TypeScript passed. Direct formatter verification confirmed identical initial output under UTC and Los Angeles process timezones, correct explicit India/New York output, and a stable date-only day. ESLint passed. No test files were added and no test suite was run. Browser hydration has not been executed. These changes remain local and uncommitted.


## Popup scrollbar appearance

Hidden visible scrollbar tracks on the shared dialog container and its nested scrollable content using standard scrollbar-width and WebKit scrollbar rules. Overflow remains auto, so long popup content stays reachable with wheel, trackpad, touch and keyboard. Added scroll containment to the dialog. CSS formatting/parser and whitespace checks passed. No test files or test suite; browser appearance not verified. Changes remain uncommitted.


## File-page expanded previews and metadata editing

Reverted the uncommitted grid/list image-popup change. Cards and menus retain the existing navigation. The expanded preview lives only on /files/[id], through Expand preview or a click on the inline image. A shared capability map drives both rendering and action availability for images, text/JSON/code, supported media containers and modern Office documents (20 MB limit). Unsupported binaries keep their byte/download fallback and do not offer expansion. Office previews retain their simplified read-only rendering limits. PDFs continue to use the dedicated document reader.

Expansion reuses ContentPreview and the authenticated content endpoint inside the shared dialog. The inline viewer unmounts while expanded to avoid duplicate media playback and outstanding text/Office requests. The popup has a bounded responsive viewport, download and close controls. Image fitting, zoom and fullscreen reuse the existing viewer. No new provider, upload behavior, migration or server extraction was added.

Added Edit file on the file workspace for base name and description. Extensions remain read-only; unchanged values skip requests. Runtime name validation, API errors, pending state and an accessible saved message are included. Changes persist through the existing authenticated rename API; file lists/details and related metadata queries update after success. No synthetic timestamps are written to the cache.

Production build including strict TypeScript and ESLint passed. No test files were added and no test suite run. Browser layout, popup and edit interactions remain for manual review. Changes remain uncommitted and unpushed as requested.


## Secure folder deletion directly from Trash

Replaced silent skipping of locked trash contents with a complete scope authorization check before any new purge/job mutations. This covers single-folder permanent deletion and Empty trash across multiple or nested protected folders, including protected active ancestors of individually trashed files. A missing grant produces a structured, owner-scoped HTTP 423 folder challenge; no restore/move is required.

Added a shared authorization prompt/retry hook around workspace mutations. Password prompts show the actual protected folder name, retain wrong-password/rate-limit errors, support cancellation, and retry the original action after each successful unlock. Multiple required passwords are requested sequentially. The Trash folder menu also unlocks in place. Fixed subtree lock selection to return an actual password-bearing folder whose ancestors are accessible, rather than an arbitrary locked descendant. Existing valid session grants are reused.

Production build including strict TypeScript, ESLint, formatting and whitespace checks passed. A read-only database execution confirmed the ancestry query is valid; the configured database had no locked trash target to challenge at that point. No data was restored/deleted, no test fixtures/files created and no test suite run. The full multi-folder password/cancel workflow remains for manual browser verification. No migration required. Changes remain local and uncommitted.

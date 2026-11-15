# VAULTSPACE

A private, intelligent space for everything worth keeping.

VAULTSPACE is a Next.js App Router application with real Neon PostgreSQL metadata, private Cloudflare R2 storage, Better Auth owner sessions, and authenticated request-driven file operations. It contains no production seed files, placeholder statistics, simulated uploads, or authentication bypass.

**Release state:** implemented locally and undergoing verification. The owner reports successful migrations and owner provisioning. Full hosted acceptance and deployment verification remain pending. Do not treat a passing build as production certification. See [implementation status](IMPLEMENTATION_STATUS.md).

## Local setup

Use Node.js 24 and npm. Work inside this directory; sibling projects are unrelated.

```powershell
npm ci
Copy-Item .env.example .env.local
# Fill the variables in your editor or secret manager, never in a chat or commit.
npm run db:migrate
npm run owner:provision
npm run dev
```

Provisioning requires `OWNER_EMAIL`, `OWNER_PASSWORD` (8–128 characters), and optional `OWNER_NAME`. No default account or public registration exists. The database permits one user only. Remove the provisioning password from the environment after use. Repeated provisioning fails without replacing the owner.

Until Neon and authentication are configured, protected pages redirect to a configuration-aware login screen. Missing R2 credentials produce a service error; they do not activate local storage. File operations require no third-party job service. No AI provider, model credentials or semantic search are used.

File preparation and cleanup run through authenticated `/api/operations` requests while the owner keeps the app open. There is no external runner, event key or job-service deployment. PDF preparation renders only the first-page thumbnail and reads the page count. No document text is extracted or stored. Pending work resumes on a later visit; interrupted requests have an expiring database lease. Processing errors remain visible and can be retried.


## Implemented code paths

- Owner login/logout, database sessions, password changes, profile updates, and session revocation.
- Private, verified direct uploads; real XHR progress; 16 MiB multipart parts; configurable part concurrency; retries and cancellation; duplicate checksum choices.
- Grid/list file browsing with database pagination and sorting; nested folders with cycle checks; rename/description/move/star; virtual collections; bulk file actions.
- Private previews and range delivery; request-generated image/PDF thumbnails; two-minute owner download signatures.
- PDF.js reader with page thumbnails, zoom/fit/rotation/fullscreen, browser printing, text selection highlights, notes, bookmarks, and saved page/zoom.
- Database-backed file-name and file-type search, with server-side filtering, sorting and pagination.
- High-entropy hashed share tokens; optional scrypt passwords; expiration/revocation; five-minute HttpOnly public access grants; live validated-access counters.
- Trash, restore, tracked, request-driven permanent object cleanup, empty trash, and opt-in retention policies with confirmation.
- Paginated owner-only `/activity` history, three-entry overview activity preview, scrollable sidebar and animated transfer/verification feedback.
- Database aggregates, upload activity, file-type distribution, largest files, storage warnings, job diagnostics, and persisted settings.

These describe implemented integrations, **not successful cloud tests**.

## Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Start Next.js and copy the matching PDF browser worker |
| `npm run build` / `npm start` | Build and serve production output |
| `npm run typecheck` | Strict TypeScript |
| `npm run lint` | ESLint |
| `npm run db:generate` | Generate schema changes; review SQL before applying |
| `npm run db:migrate` | Apply tracked migrations, including extensions and search indexes |
| `npm run owner:provision` | One-time secure owner creation |
| `npm run services:check` | Read-only cloud checks without printing credential values |

## Search and operational limits

File pages hydrate initial owner-scoped results from the server. Autocomplete uses `/api/search/suggestions` (five matches, one application query); workspace reads run concurrently. File metadata stays fresh for one minute, with file/analytics refresh intervals of two minutes and earlier mutation-specific invalidation. Idle operation polling backs off to two minutes and wakes immediately on local upload/cleanup events. Thumbnail responses support private ETag revalidation after authentication; originals and public shares remain non-cacheable.

Vercel functions are configured for Singapore (`sin1`) to match the configured Neon region (`ap-southeast-1`). Deploy this configuration for it to take effect; update it if the production database moves.

Search matches display names, original file names, extensions and MIME types. Descriptions, folder/collection names and file contents are not searched. Filtering, ranking, sorting and pagination happen in the database. There is no semantic search, model inference, vector storage or AI credential requirement.

The default per-file upload ceiling is 1 GiB, configurable up to the 5 GiB server-side copy ceiling. No total quota exists unless the owner sets one. Request-based preparation is capped at 50 MiB per original; larger originals remain downloadable and report processing limits. Scanned PDFs receive thumbnails without any OCR or extraction requirement. No OCR or malware scanner is bundled.

Multipart retries work during the current transfer. A failed whole-file retry starts a new upload; reload/crash resumability and pause/resume are not implemented. Abandoned sessions are cleaned up. Bulk downloads issue at most ten individual browser downloads; there is no archive generator. Browser printing opens the protected original in the browser's PDF viewer.

## Interface and validation

Dates and times use the viewer's device timezone (IST on an Indian device). Date filters, sharing expiration controls and upload analytics follow that same timezone. Database timestamps remain timezone-aware UTC instants. Custom Radix dropdowns and calendars support keyboard navigation; shared styled inputs and balanced typography apply throughout the app. File details fetch current metadata and refresh during preview/text preparation.

At the owner's request, automated test files, test runners and CI test steps have been removed. Use `npm run typecheck`, `npm run lint`, and `npm run build` for source validation, plus the manual deployment smoke checklist.

## Deployment and operations

Read [DEPLOYMENT.md](DEPLOYMENT.md), [SECURITY.md](SECURITY.md), and [ARCHITECTURE.md](ARCHITECTURE.md). The requested deployment target is Vercel; this repository is not exported as a static site or converted to Sites Worker hosting.


The GitHub Actions workflow assumes this application is the repository root. In a monorepo, move the workflow to the repository root and set its working directory/cache path to this subdirectory. The workflow has been authored but has not executed here.

AI removal migration: `npm run db:migrate` applies `0005_massive_tiger_shark.sql`, which removes embeddings, AI-only columns, obsolete AI states and the unused vector extension. Earlier tracked migrations remain unchanged so existing installations can upgrade reliably. Original files, annotations and PDF text remain intact.

Sharing details are available from each file menu and in the PDF reader. They show creation/expiry, validated views and recent active viewing sessions; Expire now revokes a link. Active viewers count authorized visible browser tabs seen within 45 seconds, not unique people. Apply migration 0006 with `npm run db:migrate` before using presence tracking.

Desktop navigation can collapse to an icon rail using the toggle beside global search; the preference persists on the device. Mobile navigation continues to open as a full drawer. Preparation history is not shown in Settings. Thumbnail preparation continues while the app is open, with current status and retry available in file details.

Labeled icon actions use shared Radix tooltips on hover and keyboard focus, including selection actions, navigation, PDF tools and modal controls. The sidebar scrollbar is visually hidden while scrolling remains enabled.

The redesigned overview includes a real storage distribution chart, linked statistics and quick access to documents, images, starred files and collections. File cards offer hover/focus actions for starring, details and shared access. Settings has keyboard-accessible Account, Appearance, Storage and Security sections; appearance choices save immediately on the device. Password fields support show/hide controls. Sharing summaries use real filtered access/presence data and adapt into stacked rows on mobile.

Content density changes spacing across file grids/lists, folders, activity and Settings immediately, and persists on this device. Compact layout retains readable font sizes and controls. Text/password/number inputs and textareas provide contextual placeholders; labels remain present for accessibility.

Appearance also includes font family and font size controls with a live preview and reset. Inter, DM Sans and Manrope are bundled locally; System and Georgia use device fonts. Small/default/large/extra-large scale interface typography from 14/15/16/18px base sizes. Choices persist on this browser and affect dialogs/tooltips too. Document content keeps its original formatting; mobile text inputs retain a 16px minimum to avoid focus zoom.

Inngest removal: apply migration 0007 with `npm run db:migrate` to add the PDF page cursor. `npm run dev` now starts Next.js directly. Preparation and automatic retention progress only while the app is open; they are not a hosted scheduler or durable external execution service. Private originals stay downloadable if preparation is paused or exceeds its limits. R2 lifecycle rules remain the offline backstop for abandoned staging objects and multipart uploads.

## Thumbnail-only preparation and typography

Content search and stored PDF extraction have been removed. Migration 0008 drops `pdf_pages`, its text index, and the obsolete page cursor. It also clears obsolete OCR warnings when a thumbnail already exists. The migration is prepared but not automatically applied: stop older app versions before running `npm run db:migrate`, because they still reference the removed table. Originals, thumbnails, annotations, bookmarks and reading progress are retained. The new code can be reviewed against the existing schema before applying cleanup.

Appearance offers 11 locally bundled/system font styles, including humanist Source Sans 3 and handwritten Caveat, Kalam and Patrick Hand, plus eight text sizes from 13px to 22px base. Styled dropdowns select font style and text size, with a live lettering preview; choices apply immediately and persist in this browser.

## General files and private previews

Upload any file type within the configured size/name policy. The picker is unrestricted; file filters are generated from stored extensions/MIME types, not a fixed PDF/image list. File bytes remain in R2, including unknown formats. PDFs retain their reader; other files open at `/files/[id]` with details, downloads and live share management. Only PDFs/raster images need thumbnails; other files finalize ready without a processing job.

Private previews support raster images, browser-supported audio/video, escaped text/JSON, and simplified DOCX/XLSX/PPTX content. Office preview limits: 20 MiB compressed, 3,000 archive entries, 4 MiB per XML part, 8 MiB total decoded XML; spreadsheets show up to 10 sheets, 300 populated rows and 40 columns; presentations show up to 30 slides. Text preview is capped at 512 KiB. Layout, charts, embedded media and formula recalculation are not reproduced. Legacy DOC/XLS/PPT and other unsupported binaries have metadata, a first-1-KiB byte preview and download for their native application. This is not universal full-fidelity document rendering.

Preview parsing runs only while viewing a file and is not stored or searched. HTML/SVG/code are shown as escaped text; unknown formats and executables are attachment-only. No files are sent to Google/Microsoft or another preview provider.

Share forms default to tomorrow at the same local clock time. Existing active links replace the file-menu creation action with Revoke link; revocation still asks for confirmation. Share management shows active-link revocation rather than another Create link action while a link remains active. No schema migration is required for this update.

## Share lifecycle and saved link access

The shared-links page lists active links indefinitely and shows revoked/expired links for 24 hours after access first ended. Rows and counts use the same database-time visibility rule; active rows appear first. The history window is display retention, not reactivation or deletion of revocation records. Expired/revoked URLs can be copied or visited but do not grant file access.

Each file has at most one active share. Creation checks under the vault transaction lock and migration 0009 adds a database guard plus a supporting index. The migration keeps the newest link if older data has duplicate active links, revokes the others, and logs those changes. It was applied and verified in the configured database. Other deployments must run `npm run db:migrate` before release.

Open and Copy are available for all listed links. New token URLs are owner-recoverable using a domain-separated HMAC and random share UUID; only the SHA-256 hash is stored. Older random-token shares use a signed alias bound to the same share ID and stored hash. Their original URLs remain valid under the same policy; the alias does not create a second share and uses the same password, expiry, revocation, throttling and counters. Rotating BETTER_AUTH_SECRET invalidates previous aliases; the owner can generate current aliases again by reopening share management. Raw token hashes and secrets are not sent to clients.

File names support inline rename in grid and list views: double-click the name, edit it, then press Enter or click outside to save. Escape cancels. Keyboard users can focus a name and press Enter/F2 to edit. Open files through their preview or file icon. Invalid/unchanged names do not create rename requests; failures retain the original name and display an inline error.

Rename editors expose only the base name. The popup shows a locked extension suffix; inline editing hides the suffix to preserve the original label width. Unchanged names (including whitespace-only edits) skip the rename request; the edit dialog also checks description changes. The server rejects extension changes and skips unchanged metadata writes. File action menus prefer the vertical side with more available space, remain within viewport collision padding, and scroll internally when needed. Thumbnails use contain fitting without inset padding, filling their width or height without cropping.

Image previews now fit their natural dimensions to the available card width and height, with a live zoom percentage, Fit reset and View full control on both owner and public shared pages. Only deliberate zooming beyond the viewport introduces image scrollbars. File pages use one toolbar for name search, Clear, sorting/view mode and checkbox-based multi-type selection. Repeated `type` URL parameters combine with OR in PostgreSQL and persist across reloads; individual filter chips can be removed. The upload banner appears only on /.

Live shared-page sessions send real heartbeats every 20 seconds, including while backgrounded. Active counts require a heartbeat within 90 seconds and an unexpired authorization/share. Page close sends a closed-session marker; stale sessions disappear naturally if the browser stops sending. These are open shared-page sessions, not unique people or proof of attention.


## Folder passwords and filename interaction

Create folder now offers an optional password (8-128 characters). Folder passwords are hashed with Better Auth's supported password hasher. Opening a protected folder requires its password; grants last up to 30 minutes in the current login session. Use the folder menu to lock it earlier. Nested protected folders require their own unlocks. Keep these passwords safe: there is no password recovery interface.

This is application access control, not encryption. Locked contents are excluded from file browsing, Recent, search, collection results, activity filenames and named analytics results; direct file, preview, download and PDF endpoints also check ancestor locks. Aggregate storage totals still include protected files for accurate accounting. Public sharing is disabled within protected folder trees, and moving a shared file/tree into one revokes existing links.

Migration `0010_goofy_payback` adds nullable folder password hashes, session-bound unlock records and recursive access functions. Run `npm run db:migrate` in other environments before deploying this version. Existing folders remain unprotected.

My files lists the vault root and its folders. Recent lists files across folders, ordered by the most recent open/upload by default, and labels its dates accordingly. Inline rename measures the original label's width, height and font; it starts at the beginning of the base name and preserves the extension. Truncated filenames scroll on hover or keyboard focus, respecting reduced-motion preferences.

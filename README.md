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

File preparation and cleanup run through authenticated `/api/operations` requests while the owner keeps the app open. There is no external runner, event key or job-service deployment. PDF text extraction is split into at most ten pages per request with a persisted page cursor. Pending work resumes on a later visit; interrupted requests have an expiring database lease. Processing errors remain visible and can be retried.


## Implemented code paths

- Owner login/logout, database sessions, password changes, profile updates, and session revocation.
- Private, verified direct uploads; real XHR progress; 16 MiB multipart parts; configurable part concurrency; retries and cancellation; duplicate checksum choices.
- Grid/list file browsing with database pagination and sorting; nested folders with cycle checks; rename/description/move/star; virtual collections; bulk file actions.
- Private previews and range delivery; request-generated image/PDF thumbnails; two-minute owner download signatures.
- PDF.js reader with page thumbnails, zoom/fit/rotation/fullscreen, browser printing, text selection highlights, notes, bookmarks, and saved page/zoom.
- PostgreSQL full-text and trigram search; filters and excerpts; ranked filename and PDF text results with page references.
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

Search uses PostgreSQL full-text indexes for metadata and extracted PDF text, plus filename trigram matching. Filtering, ranking, sorting and pagination happen in the database. There is no semantic search, model inference, vector storage or AI credential requirement.

The default per-file upload ceiling is 1 GiB, configurable up to the 5 GiB server-side copy ceiling. No total quota exists unless the owner sets one. Request-based preparation is capped at 50 MiB per original and a 2,000-page PDF cap; larger originals remain downloadable and report processing limits. Image-only PDFs report OCR required. No OCR or malware scanner is bundled.

Multipart retries work during the current transfer. A failed whole-file retry starts a new upload; reload/crash resumability and pause/resume are not implemented. Abandoned sessions are cleaned up. Bulk downloads issue at most ten individual browser downloads; there is no archive generator. Browser printing opens the protected original in the browser's PDF viewer.

## Interface and validation

Dates and times use the viewer's device timezone (IST on an Indian device). Date filters, sharing expiration controls and upload analytics follow that same timezone. Database timestamps remain timezone-aware UTC instants. Custom Radix dropdowns and calendars support keyboard navigation; shared styled inputs and balanced typography apply throughout the app. File details fetch current metadata and refresh during preview/text preparation.

At the owner's request, automated test files, test runners and CI test steps have been removed. Use `npm run typecheck`, `npm run lint`, and `npm run build` for source validation, plus the manual deployment smoke checklist.

## Deployment and operations

Read [DEPLOYMENT.md](DEPLOYMENT.md), [SECURITY.md](SECURITY.md), and [ARCHITECTURE.md](ARCHITECTURE.md). The requested deployment target is Vercel; this repository is not exported as a static site or converted to Sites Worker hosting.


The GitHub Actions workflow assumes this application is the repository root. In a monorepo, move the workflow to the repository root and set its working directory/cache path to this subdirectory. The workflow has been authored but has not executed here.

AI removal migration: `npm run db:migrate` applies `0005_massive_tiger_shark.sql`, which removes embeddings, AI-only columns, obsolete AI states and the unused vector extension. Earlier tracked migrations remain unchanged so existing installations can upgrade reliably. Original files, annotations and PDF text remain intact.

Sharing details are available from each file menu and in the PDF reader. They show creation/expiry, validated views and recent active viewing sessions; Expire now revokes a link. Active viewers count authorized visible browser tabs seen within 45 seconds, not unique people. Apply migration 0006 with `npm run db:migrate` before using presence tracking.

Desktop navigation can collapse to an icon rail using the toggle beside global search; the preference persists on the device. Mobile navigation continues to open as a full drawer. Preparation history is not shown in Settings. Preview and PDF-text preparation continue in the background, with current status and retry available in file details.

Labeled icon actions use shared Radix tooltips on hover and keyboard focus, including selection actions, navigation, PDF tools and modal controls. The sidebar scrollbar is visually hidden while scrolling remains enabled.

The redesigned overview includes a real storage distribution chart, linked statistics and quick access to documents, images, starred files and collections. File cards offer hover/focus actions for starring, details and shared access. Settings has keyboard-accessible Account, Appearance, Storage and Security sections; appearance choices save immediately on the device. Password fields support show/hide controls. Sharing summaries use real filtered access/presence data and adapt into stacked rows on mobile.

Content density changes spacing across file grids/lists, folders, activity and Settings immediately, and persists on this device. Compact layout retains readable font sizes and controls. Text/password/number inputs and textareas provide contextual placeholders; labels remain present for accessibility.

Appearance also includes font family and font size controls with a live preview and reset. Inter, DM Sans and Manrope are bundled locally; System and Georgia use device fonts. Small/default/large/extra-large scale interface typography from 14/15/16/18px base sizes. Choices persist on this browser and affect dialogs/tooltips too. Document content keeps its original formatting; mobile text inputs retain a 16px minimum to avoid focus zoom.

Inngest removal: apply migration 0007 with `npm run db:migrate` to add the PDF page cursor. `npm run dev` now starts Next.js directly. Preparation and automatic retention progress only while the app is open; they are not a hosted scheduler or durable external execution service. Private originals stay downloadable if preparation is paused or exceeds its limits. R2 lifecycle rules remain the offline backstop for abandoned staging objects and multipart uploads.

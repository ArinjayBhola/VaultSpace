# Deployment runbook

## Provision services

1. Create a Neon PostgreSQL project near the intended Vercel region. Store its TLS connection URL as `DATABASE_URL`; use a pooled runtime connection. Keep separate development, test and production resources.
2. Apply the tracked Drizzle migrations with `npm run db:migrate`. The first migration enables `pg_trgm`; the next adds full-text/trigram indexes and a folder-cycle trigger. Do not replace these migrations with `drizzle-kit push`, which omits handwritten SQL.
3. Create a **private** Cloudflare R2 bucket. Disable public `r2.dev` access and public custom domains. Create an API token scoped to that bucket with the read/write/delete/multipart permissions the application requires.
4. Set `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, and `R2_BUCKET_NAME`. Override `R2_ENDPOINT` only when necessary.
5. Adapt [deploy/r2-cors.json](deploy/r2-cors.json) to the exact development and production origins. Remove the placeholder origin. Allow browser PUT uploads and GET/HEAD signed reads; expose ETag. Never use `*` for origins.
6. Configure an R2 lifecycle rule for `staging/`: expire objects after two days and abort incomplete multipart uploads after seven days (or the provider-supported equivalent). The application cleans sessions after their 24-hour expiry; bucket lifecycle is a backstop for outages between R2 creation and database acknowledgement. Do not apply automatic expiry to `originals/` or `derived/`.

## Authentication and first deploy

10. Generate at least 32 cryptographically random characters for `BETTER_AUTH_SECRET` using a secret manager or cryptographic generator. Set `BETTER_AUTH_URL` and `NEXT_PUBLIC_APP_URL` to the exact production HTTPS origin, without a trailing slash. Preview deployments require their own matching origins and isolated resources; do not reuse production data casually.
11. Provision the owner once from a trusted shell pointed at production Neon. Use environment variables or a secret manager. Do not put the password in shell arguments or source control. On PowerShell, an interactive option is:

```powershell
$env:OWNER_EMAIL = Read-Host 'Owner email'
$vaultPassword = Read-Host 'Initial owner password' -AsSecureString
$vaultCredential = [PSCredential]::new('owner', $vaultPassword)
$env:OWNER_PASSWORD = $vaultCredential.GetNetworkCredential().Password
npm run owner:provision
Remove-Item Env:OWNER_PASSWORD
Remove-Variable vaultPassword, vaultCredential
```

The command uses Better Auth's supported password hashing and a database transaction. The database's singleton constraint rejects a second owner. No web setup or signup route is enabled.

12. Put this application in its own repository, or set Vercel's project root to `VAULTSPACE` in a containing repository. Select Next.js and Node.js 24. Build with `npm run build`, install with `npm ci`. `vercel.json` sets those conventions. Runtime secrets belong in Vercel's environment settings, never `NEXT_PUBLIC_*` variables.
15. Confirm `public/pdf.worker.min.mjs` was copied during build and is served at `/pdf.worker.min.mjs`; it must match the pinned React-PDF/PDF.js version. No CDN worker is used.

## Post-deployment smoke test

- Anonymous page requests redirect to `/login`; anonymous APIs reject access. Public registration must fail even when called directly.
- Log in as the provisioned owner; verify secure HttpOnly cookies and session expiry. Log out, revoke a session, and change the password.
- Upload an actual image and text PDF. Inspect R2 to verify staging and private originals, and Neon to verify completed upload records. A stopped browser transfer must never appear as a completed file.
- Upload a multipart file, interrupt a part, retry, cancel another upload, and test an expired signature. Repeat completion on an accepted upload: it must return the same file without a second job/record.
- Verify pending/failed jobs are visible, reconnect the provider, and confirm actual PDF text, page count and thumbnails. Test encrypted, corrupt, scanned and oversized PDFs.
- Open a private image and PDF, verify range responses (`206`), and download through the short-lived owner signature. No public bucket URL should work without a signature.
- Create a nested folder and collection, rename/move/star files, and refresh. Attempt a folder cycle and duplicate sibling name; both must fail. Verify collection deletion preserves original objects.
- Select PDF text, highlight it, add a note and bookmark, change zoom/rotation, then reload and reopen. Verify coordinates and saved reading position.
- Search filename, document content and combined filters. Confirm trashed files are excluded. With AI consent enabled, verify real indexing and hybrid results with page/caption snippets. Simulate a provider error and retry it.
- Create password-protected and expiring shares. Test wrong password, expiration and revocation from a separate browser. Verify grants stop working after revocation or trashing. Confirm access counts change only after validated authorization.
- Trash and restore a file and folder subtree. Permanently delete a test resource and verify originals, derived assets and metadata disappear after successful jobs. Interrupt R2 deletion and confirm retry preserves diagnostics and prevents restoring a partly deleted file.
- Compare analytics with SQL aggregates. Distinguish active, trash and derived sizes from billed R2 storage. Test the storage warning and opt-in retention confirmation.
- Verify keyboard navigation, dialogs, upload feedback, mobile layouts and themes on actual browsers. Run the isolated automated suite before releasing real data.

## Backup and recovery

Enable Neon point-in-time recovery/retention suitable for the selected plan and periodically export an encrypted database backup. Back up R2 originals to a separate access-controlled bucket/account or external durable backup, together with an object-key manifest and a consistent database snapshot. A metadata-only backup cannot recover deleted bytes.

Rehearse recovery into **new** Neon and R2 resources, apply any needed migrations, reconcile object keys/checksums and counts, then verify login, annotations, collections and downloads. Decide whether shares should remain valid after recovery; rotating `BETTER_AUTH_SECRET` invalidates sessions/grants. Revoke share rows explicitly if bearer links must cease working. Record recovery-point/recovery-time targets and test the procedure.

Redact `/s/*` and `/api/public/*` token-bearing paths in platform access logs and log drains. The application does not log raw tokens, passwords, AI keys, R2 secrets, or extracted text, but hosting access logs can capture URLs independently of application logging.


## File operations without a job provider

Apply migration 0007 before deploying. Owner-only `/api/operations` requests handle one file operation at a time, with PDF extraction limited to ten pages per request and a persisted cursor. This endpoint has a 120-second limit; use a Vercel plan/configuration that supports it. Preparation is capped at 50 MiB and 2,000 PDF pages; larger originals remain available with a visible preparation limit. Work progresses while the app is open and visible and resumes on the next visit. No scheduled maintenance executes while the app is closed; retention runs on owner visits, and R2 lifecycle is the independent offline backstop. No external queue or runner keys are needed.

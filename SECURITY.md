# Security review and operating assumptions

This is a code review record, not a penetration-test or production-readiness certificate. Service configuration became available late; only read-only cloud health checks were performed. No live production security test or deployment was performed.

## Implemented controls

- Database singleton owner constraint; disabled Better Auth signup; CLI-only owner provisioning; library password hashing; database-backed sessions; secure production cookies; logout, password change and revocation.
- Server session validation in page layouts and independent route handlers. Anonymous API access fails before touching the database when no cookies exist. Public share grants authorize only their explicitly shared file; file operations require the owner session and trusted origin.
- Origin checks on application mutations, Better Auth's origin/CSRF handling on auth endpoints, Zod input schemas, 256 KiB application JSON limits, parameterized SQL, allowlisted sorting and bounded pagination.
- Database-backed login throttling. Vercel's trusted client-address header is selected in production. Public share authorization has a durable per-share 20-attempt/minute budget rather than trusting arbitrary client headers.
- Private R2 originals. Uploads use random staging IDs, short-lived PUT/part signatures, independently verified size and file signatures, ETag-conditional server copy, and a database lock around final copy/finalization. A still-valid staging PUT cannot overwrite an accepted original. Failed distributed operations remain tracked for cleanup.
- MIME/extension allowlist and actual file signature inspection; supported formats exclude HTML, SVG and executable uploads. Downloads use safe encoded attachment names. Private inline previews use supported raster formats or PDF rendering. PDF.js annotation links are disabled in the owner canvas reader.
- Five-minute HttpOnly share grants bound to one share; revalidation on every public byte request; 256-bit random bearer tokens stored as SHA-256 hashes; salted scrypt passwords; expiry and revocation; no owner metadata in public responses; no-store and no-referrer policies.
- Trashed resources are excluded from ordinary queries and public shares. Permanent cleanup deletes R2 bytes before relational metadata. Candidate deletion remains repeatable; missing objects are safe to delete again. Scheduled lifecycle cleanup and bucket lifecycle provide separate recovery paths.
- Activity logs avoid sensitive content and expire after 180 days. Terminal job diagnostics expire after 90 days; rate-limit rows after seven days. Owner download signatures expire after two minutes. Share streaming is separately authorized and does not expose a storage key.

## Release checks still required

Manually verify critical workflows against isolated Neon and R2 resources; verify cookies, rate limits, CSRF rejection, storage signatures, multipart failures, duplicate completion, range delivery and request-driven cleanup under failures. Browser rendering/accessibility and cross-browser PDF highlight behavior still need manual browser verification.

Verify Vercel log redaction for token-bearing paths and protect environment secrets and cloud dashboards. Confirm backups and recovery, dependency audit results, least-privilege R2 permissions and private bucket settings at deployment time.

There is no bundled OCR or malware scanner, no passkey/2FA integration, and no external security audit. For malware scanning, insert a quarantined scanning job before accepting a file for processing/sharing, record scanner verdict/version, and fail closed before granting access. This is an extension point, not a claimed feature.

Shared-viewer presence is authorized by an unexpired signed HttpOnly grant and a live, unrevoked share. Heartbeats validate origin and Zod input, are rate-limited per share, and store only a hash of the random tab identifier. Presence cannot be used to authorize file content. Valid visible-page heartbeats renew a five-minute grant; expired grants require authorization again. Owner-only statistics exclude revoked/expired grants and stale heartbeats. Development request logging excludes token-bearing share and presence paths.

Request-based operations require owner authentication, trusted origin and validated JSON. PostgreSQL row locks and SKIP LOCKED claim work; expiring leases serialize each file across generations. PDF page progress is persisted in short batches and metadata is kept until storage cleanup succeeds. No unauthenticated job-provider endpoint or event/signing keys remain.

# Satya Scan

**AI-Assisted Legal Metrology Compliance Platform**  
The Sixth Sense | SIH26034 | Hackathon prototype

Live Cloudflare demo: https://satya-scan.arunchandel1780.workers.dev

Hosted on Cloudflare Workers with D1 persistence for inspection records and images. The application has Administrator and Inspector accounts with server-enforced access control.

Satya Scan pre-screens visible packaged-product declarations. It separates OCR, extraction and configurable validation, then asks an inspector to review the evidence. It does not determine legal compliance.

## Working flow

Image upload -> quality checks -> real English OCR -> structured fields -> PASS / CHECK / NOT DETECTED -> original image and text evidence -> manual review -> printable report -> persistent history.

- The New inspection screen offers **Use device camera** and **Upload image**. Camera capture uses a live, rear-facing device stream where available; denied, missing, stalled or unsupported camera access gives a clear upload fallback.
- A selected image receives a single-view preview with **Retake** and **Replace image** actions, basic quality guidance and a visible primary-label slot. The current evidence model deliberately keeps one image reliable while leaving room for additional package views in a later phase.
- JPG, JPEG, PNG, WebP; 10 MB upload limit and 40 megapixel decode limit.
- Actual Tesseract.js OCR runs in a browser worker. Engine and English model are served with the app, without an API key or third-party OCR request.
- Three clearly labeled prepared demos: complete declarations, uncertain consumer care, and no visible MRP. Select a demo and Start analysis. A separate button runs real OCR on the same sample image.
- Image quality estimates resolution, brightness, contrast and sharpness. It cannot establish absence of glare, obstruction, curvature or off-image declarations.
- Seven extracted fields; six configurable presence/format/readability checks. Rule settings are snapshotted into each inspection.
- Click a check to see its original text and highlighted region. Zoom and scroll the image or inspect all OCR lines.
- Original fields and OCR remain unchanged after a reviewer correction. Confirm a verified value, retain a finding, or mark a check not applicable with a reason.
- Finalization needs a reviewer name, explicit acknowledgement, and a recorded review for every uncertain/missing active check. A reviewed finding can still be CHECK or NOT DETECTED.
- Finalized records are immutable. Reports contain the original image, original extraction, final checks, reasons, confidence, reviewer remarks and rule snapshot.
- Download a self-contained HTML report, or choose Print / Save PDF. PDF uses the browser print dialog.
- History, records and original images are stored on the server; they survive page reloads. Demo records are explicitly marked.

## Run locally

Requires Node.js 22.13+ and npm. Node 24 is recommended. No Python, OCR service account or cloud account is needed for local use.

```sh
npm ci
npm run ocr:prepare
npm run build
npm run db:local
npm start
```

Open the local address printed by the server (normally http://127.0.0.1:8787). Keep the terminal open during the demo. Local database and image storage live under .wrangler/state. Run db:local again after a schema change; already recorded migrations are skipped.

For development after the build and migration steps:

```sh
npm run dev
```

The development preview uses http://localhost:5173. Frontend and backend run together in this one process. No separate backend service is necessary. OCR assets are already included; ocr:prepare regenerates them from the locked packages.

## Access control

- Administrators land on an oversight dashboard with system-wide inspection totals, a filterable review queue, recent activity, Inspector workload and account access. **Review queue** is the primary action; starting an inspection remains available as a secondary action.
- Administrators can view all inspection records, use configurable demo rules, and provision, suspend or restore Inspector accounts through **Manage accounts**. Suspending an Inspector revokes their active sessions.
- Inspectors land on a personal dashboard with current totals, recent assigned records and a continue-review card. They can create and view only their own records and evidence. Their account identity is set on the server when an inspection is saved; it cannot be supplied by the browser.
- Passwords are stored as salted PBKDF2-SHA-256 hashes. Authentication uses opaque, hashed, HttpOnly, SameSite session cookies, with sessions stored server-side for 12 hours.
- There is no public sign-up. Existing inspection rows without an owner are treated as legacy records and are visible only to Administrators.

The first Administrator is created once through the protected bootstrap endpoint. Set a high-entropy `AUTH_BOOTSTRAP_KEY` secret in the local `.dev.vars` file or deployment environment, then make a same-origin `POST /api/auth/bootstrap` request with that key in `x-satya-bootstrap-key` and an email, display name and strong password. The endpoint refuses to create a second initial administrator. For a production deployment, set the value as a Worker secret; never commit it or expose it in client code.

## Architecture

React + TypeScript + Vinext/Vite; reusable Radix/Shadcn controls; Tesseract.js; Cloudflare Worker API; D1 SQLite records; optional R2 image storage, with transactional D1 image chunks when R2 is not configured. Local equivalents run through Wrangler. This keeps the demo to one application rather than a separately configured Python backend.

- app/inspection-app.tsx: guided inspector interface, evidence and human review.
- lib/image.ts: upload validation, image preparation and quality heuristics.
- lib/camera.ts: user-safe camera fallback messages for unavailable device capture.
- lib/ocr.ts: cancellable OCR worker and progress.
- lib/inspection.ts: types, extraction, configurable rule evaluation and status aggregation.
- lib/validation.ts: server-side input validation and recomputation of final results.
- lib/database.ts and app/api/inspections: persistence and image access.
- lib/auth.ts and app/api/auth: password hashing, server-side sessions and login/logout.
- app/api/admin/dashboard, app/admin-dashboard.tsx and app/admin-portal.tsx: server-authorized Admin metrics, review queue, team activity and dashboard navigation.
- app/api/users and app/admin-user-manager.tsx: Administrator-only Inspector provisioning and access suspension/restoration.
- app/inspector-dashboard.tsx and app/inspector-portal.tsx: Inspector dashboard, session-continuable review state and role-specific navigation.
- lib/report.ts: escaped, self-contained printable report.
- db/schema.ts and drizzle/: schema and migrations.
- public/samples/: fictional demo fixtures and explicitly prepared OCR metadata.

API: GET/POST /api/inspections, GET /api/inspections/:id, GET /api/inspections/:id/image, GET/POST /api/users, PATCH /api/users/:id, GET /api/admin/dashboard, and the session/login/logout/bootstrap endpoints under /api/auth. Protected inspection requests always derive the user and role from the server-side session. POST finalizes an inspection; retrying the same ID returns the saved record rather than creating a duplicate. A failed save leaves the review on screen.

The Sites deployment can use its owner-only access gate. A direct Cloudflare Workers deployment requires an application account to view saved inspections. Use the supplied fictional labels when demonstrating the prototype. It is not yet a multi-tenant service or a production identity-management system.

## Rule semantics

Rules are **Configurable / Demo Rules**, version demo-prescreen-v1. No complete statutory rulebook, category exemptions or exact typography requirements have been encoded. Manufacturer/packer/importer, quantity, MRP, batch and consumer care are presence/format checks. Batch applicability remains a reviewer decision.

Overall precedence: NOT DETECTED, then CHECK, then PASS. Excluded checks are NOT APPLICABLE. All checks excluded cannot be finalized as PASS. A blank value cannot pass simply by being marked reviewed. Conflicting declarations require review.

OCR confidence bands use the engine's line confidence: High >= 85, Medium >= 60, otherwise Low. These are extraction heuristics, not accuracy percentages or legal certainty. Demo confidence is prepared metadata. Quality thresholds are prototype heuristics only.

## Two-minute demo

1. Sign in with an Inspector account, open Harvest Oat Biscuits and Start analysis. The inspector identity is assigned from the signed-in account.
2. Click MRP and show the source region and OCR text.
3. Start a new inspection with Nilgiri Leaf Tea. Show CHECK and its uncertain number.
4. In Consumer care, enter 1800-123-456 and explain in the remark that this is a simulated manual verification; Confirm the verified value and Save review.
5. Review Declaration readability with an explicit remark. Show that original OCR still contains the uncertain number.
6. Acknowledge final review and Finalize & save inspection.
7. View the report, choose Print / Save PDF, then open the same inspection from History.
8. Show Everyday Rice for NOT DETECTED. Retain the missing-price finding with a remark to demonstrate that review does not automatically mean PASS.

For a live OCR demonstration, download a sample PNG, upload it as your own image, and Start analysis, or use Read this sample with real OCR instead. Demo processing and real OCR are distinct modes.

## Verification

```sh
npm test
npx tsc --noEmit
```

The focused tests cover upload rejection before OCR, camera fallback guidance, three outcomes, price formats, batch false positives, multiline extraction, conflicting declarations, confidence settings, manual correction, missing values, finalization, server-side derivation and report escaping. The local API smoke test can be run with Node 24 while npm run dev is running:

```sh
node tests/api-smoke.mjs
```

The authentication smoke test needs the same local `AUTH_BOOTSTRAP_KEY` used by the preview. It checks invalid login, logout, role mismatch, protected Admin data, Admin-only provisioning, Inspector suspension/restoration, Inspector record isolation, and legacy-record visibility.

```sh
AUTH_TEST_BOOTSTRAP_KEY="your-local-bootstrap-key" node tests/auth-smoke.mjs
```

It creates explicitly named verification records only in the local preview database and checks persistence, image bytes, original text, rule snapshots and idempotent retries. Build and type checks passed. Real Node OCR was checked on two distinct synthetic labels, including bounding boxes. No accuracy benchmark is claimed. The deployed Cloudflare page, history endpoints, validation errors and OCR assets passed HTTPS checks. Real browser OCR on the fictional Harvest Oat Biscuits label produced PASS; source evidence and the review form were checked. A public test-record save was not performed because automatic approval review blocked creating that record. Remote write persistence, report click-through and responsive visual QA remain unverified; local persistence and report tests passed. Optional WebMCP history search is feature-detected; a supported WebMCP validation context was not available.

## Limitations and future scope

English text only; complex layouts, glare, curvature and poor photos may produce incomplete extraction. Regex extraction is deliberately small and can miss unfamiliar label phrasing. One analyzed image per inspection; inspect all package surfaces physically when needed. Reports are HTML with browser PDF printing. The dashboard can continue an incomplete review while its browser session remains open; drafts are not yet persisted after a reload. History shows the latest 500 saved records. Password reset, MFA, administrator deactivation, category-aware legal rules, tamper-proof audit chain, benchmarked accuracy and government integration are not yet implemented.

Future improvements: category-specific rules reviewed against authoritative sources, multilingual OCR, multiple label images, better extraction, measured OCR evaluation and authorized team access.

> Satya Scan provides AI-assisted inspection and pre-screening. Final regulatory determination remains with the authorized inspector/compliance authority.

## Direct Cloudflare deployment

This deployment uses a Cloudflare Worker and one D1 database. R2 activation is not required: images are stored in bounded database chunks in the same transaction as their inspection. Existing R2-based local storage remains supported.

Authorize Wrangler with database access, create or select the satya-scan database, then create cloudflare-target.json containing account_id and database_id (these are resource identifiers, not secrets).

```sh
npm run build
npm run cloudflare:prepare
npm run cloudflare:migrate
npm run cloudflare:deploy
```

The Cloudflare configuration is generated alongside the Worker output. Re-run cloudflare:prepare after every build. The printed workers.dev address is the deployment URL; local test history is not copied to cloud storage. No deployment is complete until Wrangler reports success.

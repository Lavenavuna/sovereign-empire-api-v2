# Sovereign Empire API v2

Phase 1 is now wired for a **real-estate wholesaling** workflow with governed agents.

## Core Runtime

- `server.js` — API runtime with DNA governance, approvals, trust reporting, and wholesaling routes.
- `scheduler.js` — research -> disposition strategy -> gated deal-close draft cycle.
- `config/agents.js` — single source of truth for agent triggers/prompts/tiers.

## New Wholesaling API (Phase 1)

Base path: `/api/wholesale`

- `GET /overview` — counts + average assignment potential
- `GET /properties` — list sourced/analyzed properties
- `POST /properties` — create off-market property lead
- `PATCH /properties/:id` — update property fields and distress data
- `POST /ingestion/import-csv` — import lateral county/public channel CSV into properties (tax/foreclosure/probate/divorce/code_enforcement/deed_lien)
- `POST /ingestion/merge-score` — recompute merged distress scoring and set `pipelineStatus`
- `GET /properties/queue/new` — review unprocessed properties (`pipelineStatus = new`) for scoring queue
- `POST /properties/:id/analyze` — run ARV/rehab/MAO/assignment analysis
- `GET /investors` — list cash buyers/investors
- `POST /investors` — register investor buy box
- `POST /buyers/intake` — intake buyers with proof-of-funds and qualification fields
- `POST /buyers/webhook/free-intake` — free-form/webhook buyer intake (Google Form/Typeform/Zapier payloads) routed through SB17 + tiering
- `POST /buyers/import-csv` — bulk import buyer/investor rows from CSV text (includes SB17 screening fields)
- `GET /buyers/capital-readiness-todos` — list no-cost-now + paid-later buyer acquisition execution checklist
- `PATCH /buyers/capital-readiness-todos/:id` — update checklist status (`pending|in_progress|done|blocked`) and notes
- `PATCH /investors/:id/verify` — update proof-of-funds verification and buyer qualification status
- `PATCH /investors/:id/foreign-screening` — screen/update foreign buyer profile for SB17 compliance
- `POST /properties/:id/match-investors` — rank investor matches
- `GET /deals` — list active deal records
- `GET /pipeline` — revenue pipeline view (deal + invoice + payment status)
- `GET /kpi/targets` — list KPI targets (or query `?month=YYYY-MM`)
- `PUT /kpi/targets/:month` — upsert monthly KPI target object
- `PATCH /deals/:id/source-economics` — capture channel/zip/cost/outcome/fee for deal source ROI
- `PATCH /deals/:id/offer-confidence` — set ARV/rehab confidence + rent comp and manual override
- `PATCH /deals/:id/close-path` — tag assignment vs double-close and funding readiness
- `PATCH /deals/:id/disposition-timeline` — record SLA timestamps and auto-compute breach flags
- `PATCH /deals/:id/status` — update stage/status/notes
- `POST /deals/:id/follow-up` — log follow-up actions (email/SMS/WhatsApp/call prep)
- `POST /deals/:id/outreach-draft` — generate disclosure-bound outreach draft (seller or buyer, human-dispatch)
- `POST /deals/:id/call` — log call outcomes and call notes
- `POST /deals/:id/close` — move deal to closed-pending-payment and auto-create invoice
- `POST /deals/:id/request-close-approval` — queue a T2 approval for deal close
- `POST /deals/:id/compliance/disclosures` — record seller/buyer disclosure attestations + legal metadata (supports state-specific fields like registration ID, separate disclosure timestamp, cancellation window, and close deadline)
- `POST /deals/:id/revenue-received` — mark payment received and auto-generate receipt
- `POST /autopilot/hunt` — run high-velocity revenue hunter pass (draft follow-ups + queue close approvals)
- `GET /compliance/playbook` — view active state-law playbook, targets, and legal gate requirements
- `GET /compliance/foreign-buyers` — show active SB17-designated country list used by the gate
- `PATCH /compliance/settings` — set active target states (only supported profiles can be targeted)

State is persisted in `wholesale-state.json`.

## Existing Endpoints

- `GET /api/leads` now reads `wholesale-state.json` first (falls back to legacy high-velocity state).
- `GET /api/invoices` and `POST /api/invoices/generate` read/write `invoices.json`.
- `POST /api/invoices/:invoiceNumber/pay` marks an invoice paid and generates a receipt.
- `GET /api/invoices/receipts` lists generated receipts from `receipts.json`.

## Revenue workflow (live process)

1. Add property + seller contact (`seller.name`, `seller.email`, `seller.phone`).
2. Analyze numbers (`/properties/:id/analyze`) and match investors (`/properties/:id/match-investors`).
3. Record legal disclosures (`/deals/:id/compliance/disclosures`) and confirm attorney-reviewed templates.
4. Track outreach with `/deals/:id/follow-up` and `/deals/:id/call`.
5. Close the deal with `/deals/:id/close` to create an invoice (compliance gate enforced).
6. Confirm payment with `/deals/:id/revenue-received` to generate the receipt.

Yes — phone and email are tracked for both seller and buyer/investor contacts in deal history and billing records.

## State-law compliance playbook (U.S. targeting)

- Compliance is now **fail-closed** for close approvals and auto-hunter close queuing.
- A deal cannot be closed/queued unless all required legal fields exist. Baseline fields:
  - `sellerDisclosureProvidedAt`
  - `buyerDisclosureProvidedAt`
  - `attorneyReviewedTemplate = true`
  - `disclosureVersion`
  - `marketingMode = contract_only`
- Compliance rules are now **profile-based per state** (not hardcoded TX only). Active profiles include `TX`, `FL`, `GA`, `AZ`, plus placeholder templates for stricter-regulation states (`OH`, `CT`).
- Placeholder profiles support structured rule fields for expansion:
  - `separateDisclosureDocumentProvidedAt`
  - `wholesalerRegistrationId`
  - `sellerCancellationWindowDays` + `sellerCancellationWindowDisclosedAt`
  - `contractSignedAt` + `closeDeadlineAt`
- Default active target is `TX`. Additional state targets are configurable only when a supported legal profile exists.
- This is an operational compliance layer, not legal advice. Validate each active state with qualified local counsel before scaling.

## Foreign buyer compliance gate (TX SB17)

- Investor profiles now include `foreignBuyerProfile` screening data.
- Matching and close execution fail closed when a buyer is blocked by the SB17 designated-country gate.
- Close requests require an eligible matched investor (`investorId`) so the gate can be enforced and logged.
- Current designated-country list in code: `CN, RU, IR, KP`.

## Buyer qualification and segmentation

- Buyers now support qualification fields (funding source, lender, last close timeline, target areas, preferred deal type, title reference).
- `proofOfFundsStatus` and `qualificationStatus` are tracked and influence investor match ranking.
- Optional `channels` and `sourcePlatform` fields help track which marketplaces/networks produced each buyer profile.

## Tarrant tax-roll ingestion (always-on sourcing)

- Ingestion module path: `src/ingestion/tarrant-taxroll`
- This module ingests county tax-roll records, normalizes distress signals, and upserts directly into `wholesale-state.json` as new sourced properties/deals.
- Required env:
  - `TARRANT_TAXROLL_URL` (current weekly download URL)
- Commands:
  - `npm run ingest:tarrant`
  - `npm run ingest:tarrant:scheduler`
  - `npm run ingest:tarrant:test:build`
  - `npm run ingest:tarrant:test`
- `layout-config.js` contains provisional fixed-width offsets and must be validated against Tarrant's official layout before production use.
- Multi-channel import path is now supported for manual/semi-automated sources that do not expose reliable APIs.

## Revenue OS (compounding execution fields)

- Monthly KPI targets are persisted in `meta.kpiTargets` (`revenueTarget`, `avgFeeTarget`, `closesTarget`, `contractsTarget`, `leadsTarget`, `daysToCloseTarget`).
- Every deal now supports:
  - `sourceEconomics` (channel, zip, lead/contract/close dates, outcome, fee actual)
  - `offerConfidence` (ARV/rehab confidence + source, rent comp + source, manual override)
  - `dispositionTimeline` (contract/blast/response/EMD/close timestamps + SLA breach flags)
  - `closePath` (assignment/double-close, funding readiness, tagged-before-blast)
- Revenue close approvals are now blocked unless compliance + ops gates pass (including low-confidence override and close-path readiness).

## Run

```bash
npm install
npm start
```

Optional:

- `npm run agent` -> scheduler loop
- `npm run agent:legacy` -> legacy orchestrator
- `npm run revenue` -> legacy revenue pipeline

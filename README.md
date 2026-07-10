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
- `POST /properties/:id/analyze` — run ARV/rehab/MAO/assignment analysis
- `GET /investors` — list cash buyers/investors
- `POST /investors` — register investor buy box
- `POST /properties/:id/match-investors` — rank investor matches
- `GET /deals` — list active deal records
- `PATCH /deals/:id/status` — update stage/status/notes
- `POST /deals/:id/follow-up` — log follow-up actions (email/SMS/WhatsApp/call prep)
- `POST /deals/:id/call` — log call outcomes and call notes
- `POST /deals/:id/close` — move deal to closed-pending-payment and auto-create invoice
- `POST /deals/:id/revenue-received` — mark payment received and auto-generate receipt

State is persisted in `wholesale-state.json`.

## Existing Endpoints

- `GET /api/leads` now reads `wholesale-state.json` first (falls back to legacy high-velocity state).
- `GET /api/invoices` and `POST /api/invoices/generate` read/write `invoices.json`.
- `POST /api/invoices/:invoiceNumber/pay` marks an invoice paid and generates a receipt.
- `GET /api/invoices/receipts` lists generated receipts from `receipts.json`.

## Revenue workflow (live process)

1. Add property + seller contact (`seller.name`, `seller.email`, `seller.phone`).
2. Analyze numbers (`/properties/:id/analyze`) and match investors (`/properties/:id/match-investors`).
3. Track outreach with `/deals/:id/follow-up` and `/deals/:id/call`.
4. Close the deal with `/deals/:id/close` to create an invoice.
5. Confirm payment with `/deals/:id/revenue-received` to generate the receipt.

Yes — phone and email are tracked for both seller and buyer/investor contacts in deal history and billing records.

## Run

```bash
npm install
npm start
```

Optional:

- `npm run agent` -> scheduler loop
- `npm run agent:legacy` -> legacy orchestrator
- `npm run revenue` -> legacy revenue pipeline

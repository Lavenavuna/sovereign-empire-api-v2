# DNA_NOTES.md — How the self-evolving DNA layer works

## The problem this solves
Every time the system's behavior needed adjusting (a new agent, a tier that
should be stricter, a pattern worth reacting to), it meant a manual patch —
me rewriting files, you pushing them. That doesn't scale as the system runs
on its own for weeks/months.

## The design
Two layers:
- **Baseline** (`config/agents.js`) — hardcoded defaults. Changed only by an
  actual code edit + git commit. This is deliberate and rare.
- **Evolved layer** (`config/dna-overrides.json`) — runtime state the system
  itself can propose changes to. Read at runtime, merged over the baseline.

## The loop
1. After every scheduler cycle, `analyzeAndPropose()` looks at real evidence
   in `audit-log.json` — rejection patterns, ungrounded research streaks, etc.
2. If something crosses a threshold, it writes a proposal to
   `dna-proposals.json` with the evidence and reasoning. **Nothing changes yet.**
3. You review pending proposals: `GET /api/dna/proposals`
4. You approve or reject: `POST /api/dna/proposals/:id/approve` or `/reject`
5. On approval, the change is written to `config/dna-overrides.json`, and
   `config/dna-changelog.json` gets a permanent, dated entry recording what
   changed and why — a running history of how the system has evolved.

## The one hard rule
**Overrides can only tighten a tier, never loosen one.** This is enforced in
two places independently (belt and suspenders):
- `config/agents.js` `getTier()` ignores any override that would rank below baseline
- `lib/dnaEvolution.js` `applyProposal()` refuses to even write a loosening override

Verified this holds: tried to approve a proposal loosening `deal-closer` from
T2 to T0 — refused automatically, tier stayed T2. A tier can only get *more*
cautious over time on its own; making it *less* cautious always requires you
to actually edit `config/agents.js` and commit that change deliberately.

## What it currently watches for
- A T1 agent with 3+ rejected outputs in the last 7 days → proposes tightening to T2
- RAG-loop research running consistently ungrounded → flags it (doesn't retier,
  since that's an infrastructure gap, not a permissions problem)

This list is intentionally short and conservative to start. Add more patterns
to `analyzeAndPropose()` in `lib/dnaEvolution.js` as you see what's actually
worth flagging in practice — better to add patterns from real evidence than
to guess a long list upfront.

## What this does NOT do
- It does not add new agents on its own — that's still a deliberate decision.
- It does not touch prompts, triggers, or pricing — only tier strictness.
- It does not auto-commit `config/dna-overrides.json` to git — it's local
  runtime state (same file-persistence caveat as everything else: confirm
  your Railway volume, or it resets on redeploy).


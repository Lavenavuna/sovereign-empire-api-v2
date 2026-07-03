// config/AgentDNA.js
// DEPRECATED — this used to define a separate, disconnected 12-agent registry
// pointing at a sibling directory (../../sovereign-empire-dna-.../agents/) that
// doesn't exist in this repo. It was never imported by server.js, so it was dead
// code running against nothing.
//
// This file now just re-exports the real, single-source-of-truth registry from
// ./agents.js, so nothing breaks if some other file still imports from here.
// Safe to delete this file entirely once you've confirmed nothing references it —
// search the repo for "AgentDNA" to check.

export { AGENTS, AGENT_TIER, getTier, getPrompt, selectAgent, RAG_LOOP_AGENTS } from './agents.js';


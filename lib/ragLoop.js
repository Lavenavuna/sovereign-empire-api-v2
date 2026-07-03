// lib/ragLoop.js
// Bounded RAG loop for T0 research agents (market-researcher, competitor-analyzer).
//
// IMPORTANT — READ THIS: this repo has no wired data source (no search API key,
// no Supabase pgvector, nothing) for true external retrieval. This module will NOT
// fabricate "grounded" findings to paper over that gap. If no retrieval source is
// registered, it says so explicitly in the output and the audit trail — because a
// fake-grounded Trust Report would be worse than no report at all, given the whole
// "Governed Ops" pitch is that findings are actually sourced.
//
// To make this real: call registerRetrievalSource() with a function that takes a
// query string and returns { source, snippet } or null. Good candidates: a web
// search API (SerpAPI, Bing, Brave Search), or a wrapper around apify-lead-integration.js
// if it can answer general market/competitor queries (check what it actually returns
// before wiring it here).

import { logAction } from './auditLog.js';

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';
const retrievalSources = [];

export function registerRetrievalSource(fn) {
    retrievalSources.push(fn);
}

export function hasRetrievalSource() {
    return retrievalSources.length > 0;
}

async function retrieve(query) {
    const results = [];
    for (const source of retrievalSources) {
        try {
            const r = await source(query);
            if (r) results.push(r);
        } catch (e) {
            console.error('Retrieval source failed:', e.message);
        }
    }
    return results;
}

async function callModel(systemPrompt, userPrompt) {
    if (!OPENROUTER_API_KEY) {
        return { content: '⚠️ OPENROUTER_API_KEY not set.' };
    }
    try {
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + OPENROUTER_API_KEY,
                'Content-Type': 'application/json',
                'HTTP-Referer': 'https://sovereign-empire.com',
                'X-Title': 'Sovereign Empire RAG Loop'
            },
            body: JSON.stringify({
                model: 'deepseek/deepseek-chat',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ],
                max_tokens: 700,
                temperature: 0.4
            })
        });
        const data = await response.json();
        return { content: data.choices?.[0]?.message?.content || '' };
    } catch (e) {
        return { content: '', error: e.message };
    }
}

/**
 * Runs a bounded RAG loop for a T0 research agent.
 * @param {string} agentName
 * @param {string} query
 * @param {number} maxIterations
 */
export async function runRagLoop(agentName, query, maxIterations = 3) {
    const trace = [];
    let iteration = 0;
    let allRetrieved = [];

    while (iteration < maxIterations) {
        iteration++;
        const retrieved = await retrieve(query);
        allRetrieved = allRetrieved.concat(retrieved);

        const grounded = allRetrieved.length > 0;
        const groundingText = grounded
            ? allRetrieved.map(r => `[${r.source}] ${r.snippet}`).join('\n')
            : 'NO EXTERNAL SOURCES RETRIEVED — no retrieval source is currently registered for this deployment.';

        const check = await callModel(
            'You are a strict research assistant. You only trust the retrieved context given to you, never unverified prior knowledge.',
            `Query: ${query}\n\nRetrieved context:\n${groundingText}\n\nBased ONLY on the retrieved context, can you answer confidently? Reply CONFIDENT or NEEDS_MORE, then a one-line reason.`
        );
        const confident = /^CONFIDENT/i.test(check.content?.trim() || '');

        trace.push({ iteration, query, sourcesRetrieved: allRetrieved.length, grounded, confident });
        logAction({ agent: agentName, tier: 'T0', action: 'rag-loop-iteration', iteration, grounded, confident });

        if (confident || iteration === maxIterations) break;
        query = query + ' (more specific, recent data)';
    }

    const finalGrounded = allRetrieved.length > 0;
    const synthesisPrompt = finalGrounded
        ? `Using ONLY this retrieved context, write a concise research summary:\n\n${allRetrieved.map(r => `[${r.source}] ${r.snippet}`).join('\n')}`
        : `No external sources were retrieved for "${query}" — no retrieval source is configured on this deployment. Do NOT invent specific facts, figures, or sources. State plainly that this finding is unverified and requires either a human researcher or a configured retrieval source before it can be trusted.`;

    const synthesis = await callModel(
        'You are a research analyst. Never state a specific fact, statistic, or named source unless it appears in the retrieved context given to you.',
        synthesisPrompt
    );

    logAction({
        agent: agentName, tier: 'T0', action: 'rag-loop-complete',
        iterations: iteration, grounded: finalGrounded, sourcesUsed: allRetrieved.length
    });

    return {
        success: true,
        agent: agentName,
        grounded: finalGrounded,
        iterations: iteration,
        sourcesUsed: allRetrieved.length,
        trace,
        result: synthesis.content
    };
}


import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';

const app = express();
const PORT = process.env.PORT || 8082;

// Health check
app.get('/health', (req, res) => res.send('OK'));

// Model list (must match what OpenRouter supports)
app.get('/v1/models', (req, res) => {
    res.json({
        data: [
            { id: 'claude-3-haiku-20240307' },
            { id: 'claude-3-sonnet-20240229' },
            { id: 'claude-3-opus-20240229' },
            { id: 'gpt-3.5-turbo' },
            { id: 'gpt-4' }
        ]
    });
});

// Proxy ALL /v1/messages requests to OpenRouter
app.use('/v1/messages', createProxyMiddleware({
    target: 'https://openrouter.ai/api/v1/chat/completions',
    changeOrigin: true,
    pathRewrite: { '^/v1/messages': '' },
    onProxyReq: (proxyReq, req, res) => {
        // Add OpenRouter API key
        const apiKey = process.env.OPENROUTER_API_KEY;
        if (!apiKey) {
            console.error('OPENROUTER_API_KEY is missing!');
            res.status(500).send('Missing API key');
            return;
        }
        proxyReq.setHeader('Authorization', `Bearer ${apiKey}`);
        proxyReq.setHeader('Content-Type', 'application/json');
        // Optional: identify your app to OpenRouter
        proxyReq.setHeader('HTTP-Referer', 'https://railway.app');
        proxyReq.setHeader('X-Title', 'Claude Code Proxy');
    },
    onError: (err, req, res) => {
        console.error('Proxy error:', err);
        res.status(502).send('Proxy error: ' + err.message);
    }
}));

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Proxy running on port ${PORT}`);
    console.log(`Using OpenRouter: ${!!process.env.OPENROUTER_API_KEY}`);
});

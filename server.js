import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';

const app = express();
const PORT = process.env.PORT || 8082;

// 🔍 Log ALL requests
app.use((req, res, next) => {
    console.log(`🔍 ${req.method} ${req.url}`);
    next();
});

app.get('/health', (req, res) => res.send('OK'));

app.get('/v1/models', (req, res) => {
    res.json({
        data: [
            { id: "claude-3-haiku-20240307" },
            { id: "claude-3-sonnet-20240229" },
            { id: "claude-3-opus-20240229" }
        ]
    });
});

// Proxy for Anthropic Messages API endpoint
app.use('/v1/messages', createProxyMiddleware({
    target: 'https://openrouter.ai/api/v1/chat/completions',
    changeOrigin: true,
    pathRewrite: { '^/v1/messages': '' },
    onProxyReq: (proxyReq, req, res) => {
        const apiKey = process.env.OPENROUTER_API_KEY;
        if (!apiKey) {
            console.error('❌ OPENROUTER_API_KEY missing');
            res.status(500).send('Missing API key');
            return;
        }
        proxyReq.setHeader('Authorization', `Bearer ${apiKey}`);
        proxyReq.setHeader('Content-Type', 'application/json');
        console.log('➡️ Proxying to OpenRouter');
    },
    onError: (err, req, res) => {
        console.error('❌ Proxy error:', err.message);
        res.status(502).send('Proxy error');
    }
}));

// Catch-all for any other routes (will help debug)
app.use('*', (req, res) => {
    console.log(`❌ 404 for ${req.method} ${req.url}`);
    res.status(404).send(`Route ${req.method} ${req.url} not found`);
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Proxy running on port ${PORT}`);
    console.log(`✅ Using OpenRouter: ${!!process.env.OPENROUTER_API_KEY}`);
});

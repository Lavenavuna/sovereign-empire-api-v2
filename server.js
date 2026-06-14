import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';

const app = express();
const PORT = process.env.PORT || 8080;

// Model mapping: what Claude Code sends → what OpenRouter expects
const modelMap = {
    "claude-3-haiku-20240307": "anthropic/claude-3-haiku-20240307",
    "claude-3-sonnet-20240229": "anthropic/claude-3-sonnet-20240229",
    "claude-3-opus-20240229": "anthropic/claude-3-opus-20240229",
    "claude-3.5-sonnet-20240620": "anthropic/claude-3.5-sonnet-20240620"
};

app.use(express.json());

app.use((req, res, next) => {
    console.log(`🔍 ${req.method} ${req.url}`);
    next();
});

app.get('/health', (req, res) => res.send('OK'));

app.get('/', (req, res) => res.send('Proxy running'));

app.get('/v1/models', (req, res) => {
    res.json({
        data: [
            { id: "claude-3-haiku-20240307" },
            { id: "claude-3-sonnet-20240229" },
            { id: "claude-3-opus-20240229" }
        ]
    });
});

// Intercept and modify the request body to map the model
app.use('/v1/messages', (req, res, next) => {
    if (req.body && req.body.model) {
        const originalModel = req.body.model;
        if (modelMap[originalModel]) {
            req.body.model = modelMap[originalModel];
            console.log(`🔄 Mapping model: ${originalModel} → ${req.body.model}`);
        }
    }
    next();
});

// Proxy to OpenRouter
app.use('/v1/messages', createProxyMiddleware({
    target: 'https://openrouter.ai/api/v1/chat/completions',
    changeOrigin: true,
    pathRewrite: { '^/v1/messages': '' },
    onProxyReq: (proxyReq, req, res) => {
        proxyReq.removeHeader('Authorization');
        proxyReq.setHeader('Authorization', `Bearer ${process.env.OPENROUTER_API_KEY}`);
        proxyReq.setHeader('Content-Type', 'application/json');
        console.log('➡️ Proxying to OpenRouter');
    },
    onError: (err, req, res) => {
        console.error('❌ Proxy error:', err.message);
        res.status(502).send('Proxy error');
    }
}));

app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Proxy running on port ${PORT}`);
    console.log(`✅ Using OpenRouter: ${!!process.env.OPENROUTER_API_KEY}`);
});

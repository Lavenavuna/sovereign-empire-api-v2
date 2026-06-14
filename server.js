import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';

const app = express();
const PORT = process.env.PORT || 8082;

app.use((req, res, next) => {
    console.log(`${req.method} ${req.url}`);
    next();
});

app.get('/health', (req, res) => res.send('OK'));

app.get('/v1/models', (req, res) => {
    res.json({
        data: [
            { id: 'claude-3-haiku-20240307' },
            { id: 'claude-3-sonnet-20240229' }
        ]
    });
});

// Choose your provider: OpenRouter (easiest) or NVIDIA
const API_TARGET = process.env.OPENROUTER_API_KEY
    ? 'https://openrouter.ai/api/v1/chat/completions'
    : 'https://integrate.api.nvidia.com/v1/chat/completions';

const AUTH_HEADER = process.env.OPENROUTER_API_KEY
    ? `Bearer ${process.env.OPENROUTER_API_KEY}`
    : `Bearer ${process.env.NVIDIA_NIM_API_KEY}`;

app.use('/v1/messages', createProxyMiddleware({
    target: API_TARGET,
    changeOrigin: true,
    pathRewrite: { '^/v1/messages': '' },
    onProxyReq: (proxyReq) => {
        proxyReq.setHeader('Authorization', AUTH_HEADER);
        proxyReq.setHeader('Content-Type', 'application/json');
    }
}));

app.listen(PORT, '0.0.0.0', () => console.log(`Proxy on ${PORT}`));

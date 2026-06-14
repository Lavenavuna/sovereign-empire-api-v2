import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';

const app = express();
const PORT = process.env.PORT || 8080;

app.use(express.json());

app.use((req, res, next) => {
    console.log(`🔍 ${req.method} ${req.url}`);
    next();
});

app.get('/health', (req, res) => res.send('OK'));

app.get('/v1/models', (req, res) => {
    res.json({
        data: [
            { id: "claude-3-haiku-20240307" },
            { id: "claude-3-sonnet-20240229" }
        ]
    });
});

// Model mapping
const modelMap = {
    "claude-3-haiku-20240307": "anthropic/claude-3-haiku-20240307",
    "claude-3-sonnet-20240229": "anthropic/claude-3-sonnet-20240229"
};

app.post('/v1/messages', async (req, res) => {
    try {
        let body = req.body;
        
        // Map the model
        if (body.model && modelMap[body.model]) {
            body.model = modelMap[body.model];
            console.log(`🔄 Mapped model to: ${body.model}`);
        }
        
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });
        
        const data = await response.json();
        res.status(response.status).json(data);
    } catch (error) {
        console.error('Error:', error.message);
        res.status(502).json({ error: error.message });
    }
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Proxy running on port ${PORT}`);
    console.log(`✅ OpenRouter API key set: ${!!process.env.OPENROUTER_API_KEY}`);
});

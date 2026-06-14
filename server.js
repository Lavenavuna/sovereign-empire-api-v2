import express from 'express';

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

app.post('/v1/messages', async (req, res) => {
    try {
        const body = req.body;
        console.log(`📝 Request model: ${body.model}`);
        
        const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: "deepseek-chat",
                messages: body.messages,
                max_tokens: body.max_tokens || 500,
                temperature: body.temperature || 0.7
            })
        });
        
        const data = await response.json();
        console.log(`✅ DeepSeek response status: ${response.status}`);
        
        if (data.choices && data.choices[0]) {
            // Convert to Anthropic-compatible format
            res.json({
                id: data.id,
                type: "message",
                role: "assistant",
                content: [{
                    type: "text",
                    text: data.choices[0].message.content
                }],
                model: body.model,
                usage: data.usage
            });
        } else {
            console.error('DeepSeek error:', data);
            res.status(response.status).json(data);
        }
    } catch (error) {
        console.error('❌ Error:', error.message);
        res.status(502).json({ error: error.message });
    }
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Proxy running on port ${PORT}`);
    console.log(`✅ DeepSeek API: ${process.env.DEEPSEEK_API_KEY ? 'Configured' : 'MISSING!'}`);
});

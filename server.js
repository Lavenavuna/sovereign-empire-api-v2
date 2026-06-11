const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Simple routes that ALWAYS work
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Server is running',
    time: new Date().toISOString()
  });
});

app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Sovereign Empire API</title>
      <style>
        body { font-family: Arial; text-align: center; padding: 50px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; }
        h1 { font-size: 3rem; }
        .status { background: rgba(255,255,255,0.2); padding: 20px; border-radius: 10px; margin: 20px auto; max-width: 500px; }
        .green { color: #90ff90; font-weight: bold; }
      </style>
    </head>
    <body>
      <h1>🏰 Sovereign Empire API</h1>
      <div class="status">
        <p>Status: <span class="green">✓ ONLINE</span></p>
        <p>AI Model: <strong>Claude Sonnet 4.5</strong></p>
        <p>Server: Running on port ${PORT}</p>
        <p>Time: ${new Date().toLocaleString()}</p>
      </div>
      <p>✅ Your API is working!</p>
      <p>Endpoint: <code>/health</code></p>
    </body>
    </html>
  `);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`✓ Server running on port ${PORT}`);
  console.log(`✓ Health: http://localhost:${PORT}/health`);
});

// Keep alive
setInterval(() => {
  console.log('Heartbeat');
}, 30000);

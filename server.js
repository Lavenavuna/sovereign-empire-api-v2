const express = require('express');
const cors = require('cors');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Initialize Claude - FIXED VERSION
let anthropic;
const apiKey = process.env.ANTHROPIC_API_KEY;

console.log(`API Key exists: ${!!apiKey}`);
console.log(`API Key length: ${apiKey ? apiKey.length : 0}`);

try {
  if (apiKey && apiKey.startsWith('sk-ant')) {
    anthropic = new Anthropic({
      apiKey: apiKey,
    });
    console.log('✓ Claude Sonnet 4.5 ready');
  } else {
    console.log('⚠ Invalid or missing ANTHROPIC_API_KEY');
  }
} catch (error) {
  console.log('⚠ Claude init error:', error.message);
}

// HEALTH CHECK
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'Server is running',
    anthropic: !!anthropic,
    time: new Date().toISOString()
  });
});

// HOMEPAGE
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
        code { background: #333; padding: 5px 10px; border-radius: 5px; }
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
      <p>Try: <code>/health</code></p>
    </body>
    </html>
  `);
});

// GENERATE BLOG POST
app.post('/api/blog', async (req, res) => {
  const { topic, tone = 'professional', length = 'medium' } = req.body;

  if (!topic) {
    return res.status(400).json({ error: 'Topic is required' });
  }

  if (!anthropic) {
    return res.status(500).json({ error: 'Claude API not configured. Please add ANTHROPIC_API_KEY to Railway variables.' });
  }

  try {
    const lengthMap = {
      short: '300 words',
      medium: '600 words',
      long: '1000 words'
    };

    const message = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 2000,
      temperature: 0.7,
      system: `You are a professional blog writer. Write in a ${tone} tone.`,
      messages: [
        {
          role: 'user',
          content: `Write a blog post about "${topic}". Make it approximately ${lengthMap[length]}. Include a title, introduction, 3 main points, and a conclusion.`
        }
      ]
    });

    res.json({
      success: true,
      ai_model: 'Claude Sonnet 4.5',
      topic,
      tone,
      length,
      content: message.content[0].text,
      wordCount: message.content[0].text.split(' ').length
    });
  } catch (error) {
    console.error('Claude error:', error);
    res.status(500).json({ error: 'Failed to generate content', details: error.message });
  }
});

// GENERATE SOCIAL MEDIA POST
app.post('/api/social', async (req, res) => {
  const { topic, platform = 'twitter', style = 'engaging' } = req.body;

  if (!topic) {
    return res.status(400).json({ error: 'Topic is required' });
  }

  if (!anthropic) {
    return res.status(500).json({ error: 'Claude API not configured.' });
  }

  const platformLimits = {
    twitter: '280 characters',
    linkedin: '1500 characters',
    instagram: '2200 characters',
    facebook: '2000 characters'
  };

  try {
    const message = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 800,
      temperature: 0.8,
      system: `You are a social media expert. Create ${style} posts for ${platform}.`,
      messages: [
        {
          role: 'user',
          content: `Create a ${platform} post about "${topic}". Keep it under ${platformLimits[platform]}. Include 3 relevant hashtags.`
        }
      ]
    });

    const content = message.content[0].text;
    const hashtags = content.match(/#\w+/g) || [];

    res.json({
      success: true,
      ai_model: 'Claude Sonnet 4.5',
      platform,
      topic,
      style,
      content,
      hashtags
    });
  } catch (error) {
    console.error('Claude error:', error);
    res.status(500).json({ error: 'Failed to generate social post' });
  }
});

// GENERATE SEO CONTENT
app.post('/api/seo', async (req, res) => {
  const { keyword, contentType = 'meta' } = req.body;

  if (!keyword) {
    return res.status(400).json({ error: 'Keyword is required' });
  }

  if (!anthropic) {
    return res.status(500).json({ error: 'Claude API not configured.' });
  }

  try {
    const prompts = {
      meta: `Generate SEO meta title (under 60 chars) and meta description (under 160 chars) for keyword: "${keyword}"`,
      headings: `Generate an SEO-optimized H1, H2, and H3 heading structure for content about "${keyword}"`,
      full: `Generate SEO-optimized content (500 words) about "${keyword}" including meta tags, headings, and body content`
    };

    const message = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1500,
      temperature: 0.6,
      system: 'You are an SEO expert. Follow SEO best practices.',
      messages: [
        {
          role: 'user',
          content: prompts[contentType]
        }
      ]
    });

    res.json({
      success: true,
      ai_model: 'Claude Sonnet 4.5',
      keyword,
      contentType,
      content: message.content[0].text
    });
  } catch (error) {
    console.error('Claude error:', error);
    res.status(500).json({ error: 'Failed to generate SEO content' });
  }
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✓ Server running on port ${PORT}`);
  console.log(`✓ Claude: ${anthropic ? 'Ready' : 'Not configured'}`);
});

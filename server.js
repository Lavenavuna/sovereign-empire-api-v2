const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const Anthropic = require('@anthropic-ai/sdk');
const path = require('path');

dotenv.config();

const app = express();
// Use Railway's port or default to 3000
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Initialize Claude
let anthropic;
try {
  anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });
  console.log('Claude initialized successfully');
} catch (error) {
  console.error('Failed to initialize Claude:', error.message);
}

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date(), port: PORT });
});

// Serve HTML page
app.get('/', (req, res) => {
  try {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  } catch (error) {
    res.json({ message: 'Sovereign Empire API is running', status: 'online' });
  }
});

// API Status
app.get('/api/status', (req, res) => {
  res.json({
    status: 'online',
    message: 'Sovereign Empire API - AI Content Automation',
    ai_model: 'Claude Sonnet 4.5',
    endpoints: {
      'POST /api/blog': 'Generate blog post',
      'POST /api/social': 'Generate social media post',
      'POST /api/seo': 'Generate SEO content',
      'GET /health': 'Health check'
    }
  });
});

// Generate Blog Post
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

// Generate Social Media Post
app.post('/api/social', async (req, res) => {
  const { topic, platform = 'twitter', style = 'engaging' } = req.body;

  if (!topic) {
    return res.status(400).json({ error: 'Topic is required' });
  }

  if (!anthropic) {
    return res.status(500).json({ error: 'Claude API not configured. Please add ANTHROPIC_API_KEY to Railway variables.' });
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

// Generate SEO Content
app.post('/api/seo', async (req, res) => {
  const { keyword, contentType = 'meta' } = req.body;

  if (!keyword) {
    return res.status(400).json({ error: 'Keyword is required' });
  }

  if (!anthropic) {
    return res.status(500).json({ error: 'Claude API not configured. Please add ANTHROPIC_API_KEY to Railway variables.' });
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
  console.log(`Server running on port ${PORT}`);
  console.log(`AI Model: Claude Sonnet 4.5 ready`);
});

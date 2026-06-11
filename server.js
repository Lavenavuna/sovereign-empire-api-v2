const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const Anthropic = require('@anthropic-ai/sdk');

dotenv.config();

const app = express();  // ← app is created HERE
const PORT = process.env.PORT || 3000;

// Middleware - THESE go after app is created
app.use(cors());
app.use(express.json());
app.use(express.static('public'));  // ← THIS LINE HERE

// Initialize Claude
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Rest of your routes...
app.get('/health', (req, res) => {
  res.json({ status: 'OK' });
});

// ... etc

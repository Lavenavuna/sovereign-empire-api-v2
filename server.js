// Initialize Claude
let anthropic;
try {
  if (process.env.ANTHROPIC_API_KEY) {
    anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
    console.log('✓ Claude Sonnet 4.5 ready');
  }
} catch (error) {
  console.log('⚠ Claude not configured');
}

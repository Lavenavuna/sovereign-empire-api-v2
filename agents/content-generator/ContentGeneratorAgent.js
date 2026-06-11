import AgentDNA from '../AgentDNA.js';

class ContentGeneratorAgent extends AgentDNA {
  constructor() {
    super({
      agentId: 'content-generator-001',
      agentType: 'content_generator',
      version: '1.0.0',
      llmModel: 'claude-sonnet-4.5',
      qualityThreshold: 0.75,
      contentType: 'blog_post'
    });
  }

  async generateContent(topic, contentType = 'blog_post', wordCount = 2000, tone = 'professional', keywords = []) {
    const prompt = `Write a ${contentType} about: "${topic}"\n\nRequirements:\n- Word count: ${wordCount} words\n- Tone: ${tone}\n- Keywords to include: ${keywords.join(', ')}\n- SEO optimized\n- Engaging and informative\n- Include subheadings\n\nStart writing now:`;
    return await this.execute(prompt);
  }
}

export default ContentGeneratorAgent;

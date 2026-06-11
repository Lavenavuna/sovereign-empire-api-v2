import AgentDNA from '../AgentDNA.js';

class SocialMediaAgent extends AgentDNA {
  constructor() {
    super({
      agentId: 'social-media-001',
      agentType: 'social_media_distributor',
      version: '1.0.0',
      llmModel: 'claude-haiku-4.5',
      qualityThreshold: 0.65,
      contentType: 'quick_task'
    });
  }

  async createSocialPosts(blogContent, platforms = ['twitter', 'linkedin', 'instagram']) {
    const prompt = `Create social media posts from this blog content:\n\nContent:\n${blogContent.substring(0, 500)}...\n\nPlatforms: ${platforms.join(', ')}\n\nFollow platform-specific rules for character limits and tone.`;
    return await this.execute(prompt);
  }
}

export default SocialMediaAgent;

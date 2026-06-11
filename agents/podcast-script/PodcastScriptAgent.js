import AgentDNA from '../AgentDNA.js';

class PodcastScriptAgent extends AgentDNA {
  constructor() {
    super({
      agentId: 'podcast-script-001',
      agentType: 'podcast_script_writer',
      version: '1.0.0',
      llmModel: 'claude-sonnet-4.5',
      qualityThreshold: 0.74,
      contentType: 'blog_post'
    });
  }

  async writePodcastScript(topic, duration = '20_minutes', style = 'conversational') {
    const prompt = `Write a podcast episode script about: "${topic}"\n\nRequirements:\n- Duration: ${duration}\n- Style: ${style}\n- Include: Hook, 3 main points, storytelling, CTA\n- Format with speaker labels and [MUSIC] annotations`;
    return await this.execute(prompt);
  }
}

export default PodcastScriptAgent;

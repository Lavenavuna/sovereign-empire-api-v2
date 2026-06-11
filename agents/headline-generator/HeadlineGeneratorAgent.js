import AgentDNA from '../AgentDNA.js';

class HeadlineGeneratorAgent extends AgentDNA {
  constructor() {
    super({
      agentId: 'headline-generator-001',
      agentType: 'headline_generator',
      version: '1.0.0',
      llmModel: 'claude-haiku-4.5',
      qualityThreshold: 0.68,
      contentType: 'quick_task'
    });
  }

  async generateHeadlines(topic, count = 10, style = 'curiosity') {
    const prompt = `Generate ${count} viral-worthy headlines about: "${topic}"\n\nStyle: ${style}\n\nRequirements:\n- Clickable and share-worthy\n- Under 60 characters each\n- Include power words\n- Diverse approaches`;
    return await this.execute(prompt);
  }
}

export default HeadlineGeneratorAgent;

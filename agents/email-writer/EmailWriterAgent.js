import AgentDNA from '../AgentDNA.js';

class EmailWriterAgent extends AgentDNA {
  constructor() {
    super({
      agentId: 'email-writer-001',
      agentType: 'email_writer',
      version: '1.0.0',
      llmModel: 'claude-haiku-4.5',
      qualityThreshold: 0.70,
      contentType: 'quick_task'
    });
  }

  async writeEmail(topic, audience = 'general', tone = 'professional', cta = 'Click here') {
    const prompt = `Write a compelling email about: "${topic}"\n\nRequirements:\n- Audience: ${audience}\n- Tone: ${tone}\n- Call-to-action: ${cta}\n- Length: 150-300 words\n- Subject line included`;
    return await this.execute(prompt);
  }
}

export default EmailWriterAgent;

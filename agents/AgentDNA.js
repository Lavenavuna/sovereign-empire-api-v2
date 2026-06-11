// ============================================================================
// AGENT DNA - Master Blueprint for All Agents
// Location: /agents/AgentDNA.js
// ============================================================================
// Every agent in the Sovereign Empire inherits from this DNA
// This ensures consistency, scalability, and self-improvement
// ============================================================================

import db from '../services/database.js';
import llmRouter from '../services/llm-router.js';

class AgentDNA {
  constructor(config = {}) {
    // DNA CORE IDENTITY
    this.agentId = config.agentId || `agent-${Date.now()}`;
    this.agentType = config.agentType || 'generic';
    this.version = config.version || '1.0.0';
    this.status = 'inactive';

    // DNA CONFIGURATION
    this.config = {
      llmModel: config.llmModel || 'claude-sonnet-4.5',
      maxRetries: config.maxRetries || 3,
      qualityThreshold: config.qualityThreshold || 0.7,
      autoSelfHeal: config.autoSelfHeal !== false,
      enableLogging: config.enableLogging !== false,
      ...config
    };

    // DNA METRICS (Tracked across all agents)
    this.metrics = {
      tasksCompleted: 0,
      averageQuality: 0,
      totalRevenue: 0,
      errorCount: 0,
      selfHealCount: 0,
      averageExecutionTime: 0,
      lastExecution: null,
      successRate: 0
    };

    // DNA MEMORY (Agents learn and improve)
    this.memory = {
      successPatterns: [],
      failurePatterns: [],
      userPreferences: {},
      optimizations: []
    };
  }

  async execute(input) {
    const startTime = Date.now();
    this.status = 'executing';

    try {
      console.log(`🧬 [${this.agentType}] Starting execution...`);
      await this.logActivity('execution_start', { input });

      const llmResponse = await this.callLLM(input);
      if (!llmResponse.success) throw new Error(`LLM failed: ${llmResponse.error}`);

      const quality = await this.evaluate(llmResponse.content);
      console.log(`⭐ Quality Score: ${quality.toFixed(2)}`);

      if (quality < this.config.qualityThreshold && this.config.autoSelfHeal) {
        console.log(`🔄 Quality below threshold, self-healing...`);
        return await this.selfHeal(input, quality);
      }

      const executionTime = Date.now() - startTime;
      await this.recordSuccess({
        input,
        output: llmResponse.content,
        quality,
        executionTime,
        model: llmResponse.model
      });

      this.status = 'ready';
      return {
        success: true,
        agentId: this.agentId,
        agentType: this.agentType,
        output: llmResponse.content,
        quality: quality,
        executionTime: executionTime,
        timestamp: new Date()
      };

    } catch (error) {
      console.error(`❌ [${this.agentType}] Execution failed:`, error.message);
      await this.handleError(error, input);
      this.status = 'error';
      return { success: false, agentId: this.agentId, error: error.message, timestamp: new Date() };
    }
  }

  async evaluate(output) {
    try {
      const evaluationPrompt = `Rate the quality of this output on a scale of 0.0 to 1.0 (only return a number): ${output.substring(0, 500)}...`;
      const response = await llmRouter.route(evaluationPrompt, { contentType: 'quick_task', maxRetries: 1 });
      const score = parseFloat(response.content);
      return isNaN(score) ? 0.5 : Math.min(1.0, Math.max(0.0, score));
    } catch (error) {
      console.error('Evaluation error:', error);
      return 0.5;
    }
  }

  async learn(result) {
    if (result.success && result.quality > 0.8) {
      this.memory.successPatterns.push({
        input: result.input,
        output: result.output,
        quality: result.quality,
        timestamp: new Date()
      });
      console.log(`📚 Learned success pattern #${this.memory.successPatterns.length}`);
    }

    if (!result.success) {
      this.memory.failurePatterns.push({
        input: result.input,
        error: result.error,
        timestamp: new Date()
      });
      console.log(`⚠️ Recorded failure pattern`);
    }

    await db.saveAgentMemory(this.agentId, this.memory);
  }

  async selfHeal(originalInput, failureQuality, attemptNumber = 1) {
    if (attemptNumber > this.config.maxRetries) {
      console.error(`🚨 Max self-heal attempts (${this.config.maxRetries}) exceeded`);
      return { success: false, error: 'Self-heal failed after max attempts', attemptNumber };
    }

    console.log(`🔧 Self-healing attempt ${attemptNumber}...`);

    try {
      await db.logSelfHealingEvent({
        agentId: this.agentId,
        issueType: 'low_quality_output',
        issueDescription: `Quality score ${failureQuality} below threshold ${this.config.qualityThreshold}`,
        healingAction: 'retry_with_improved_prompt',
        actionSuccessful: false,
        actionDetails: { attemptNumber, originalQuality: failureQuality }
      });

      const improvedInput = `
        Previous attempt quality: ${failureQuality}/1.0
        Please improve on: clarity, depth, relevance, accuracy
        
        Original request: ${originalInput}
        
        Make it better this time with more detail and precision.
      `;

      const response = await llmRouter.route(improvedInput, {
        contentType: this.config.contentType || 'blog_post',
        preferredModel: 'claude-sonnet-4.5',
        maxRetries: 1
      });

      if (!response.success) {
        return await this.selfHeal(originalInput, failureQuality, attemptNumber + 1);
      }

      const newQuality = await this.evaluate(response.content);
      console.log(`⭐ New quality after healing: ${newQuality.toFixed(2)}`);

      if (newQuality > this.config.qualityThreshold) {
        this.metrics.selfHealCount++;
        
        await db.logSelfHealingEvent({
          agentId: this.agentId,
          issueType: 'low_quality_output',
          healingAction: 'retry_with_improved_prompt',
          actionSuccessful: true,
          actionDetails: { attemptNumber, originalQuality: failureQuality, newQuality: newQuality }
        });

        return { success: true, output: response.content, quality: newQuality, healedFromQuality: failureQuality, attemptNumber };
      }

      return await this.selfHeal(originalInput, newQuality, attemptNumber + 1);

    } catch (error) {
      console.error(`Self-heal error on attempt ${attemptNumber}:`, error.message);
      return await this.selfHeal(originalInput, failureQuality, attemptNumber + 1);
    }
  }

  async handleError(error, input) {
    this.metrics.errorCount++;
    await db.logAgentActivity({
      agentId: this.agentId,
      action: 'error_occurred',
      status: 'error',
      details: { errorMessage: error.message, input: input }
    });
  }

  async recordSuccess(result) {
    this.metrics.tasksCompleted++;
    this.metrics.lastExecution = new Date();

    const totalQuality = this.metrics.averageQuality * (this.metrics.tasksCompleted - 1) + result.quality;
    this.metrics.averageQuality = totalQuality / this.metrics.tasksCompleted;

    const totalTime = this.metrics.averageExecutionTime * (this.metrics.tasksCompleted - 1) + result.executionTime;
    this.metrics.averageExecutionTime = totalTime / this.metrics.tasksCompleted;

    this.metrics.successRate = ((this.metrics.tasksCompleted - this.metrics.errorCount) / this.metrics.tasksCompleted * 100).toFixed(2);

    await this.learn({ success: true, ...result });
    await db.logAgentActivity({
      agentId: this.agentId,
      action: 'task_completed',
      status: 'success',
      details: { quality: result.quality, executionTime: result.executionTime }
    });
  }

  async callLLM(prompt) {
    return await llmRouter.route(prompt, {
      contentType: this.config.contentType || 'blog_post',
      agentId: this.agentId,
      maxRetries: this.config.maxRetries
    });
  }

  async logActivity(action, details = {}) {
    if (!this.config.enableLogging) return;
    await db.logAgentActivity({
      agentId: this.agentId,
      action: action,
      status: this.status,
      details: details
    });
  }

  getReport() {
    return {
      agentId: this.agentId,
      agentType: this.agentType,
      version: this.version,
      status: this.status,
      metrics: this.metrics
    };
  }

  printMetrics() {
    console.log(`
    ╔════════════════════════════════════════╗
    ║  🧬 AGENT DNA METRICS: ${this.agentType}
    ╠════════════════════════════════════════╣
    ║  Tasks Completed: ${this.metrics.tasksCompleted}
    ║  Average Quality: ${this.metrics.averageQuality.toFixed(2)}/1.0
    ║  Success Rate: ${this.metrics.successRate}%
    ║  Self-Heals: ${this.metrics.selfHealCount}
    ║  Errors: ${this.metrics.errorCount}
    ║  Avg Time: ${this.metrics.averageExecutionTime.toFixed(0)}ms
    ║  Total Revenue: $${this.metrics.totalRevenue.toFixed(2)}
    ╚════════════════════════════════════════╝
    `);
  }
}

export default AgentDNA;

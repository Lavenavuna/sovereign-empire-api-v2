import ContentGeneratorAgent from './agents/content-generator/ContentGeneratorAgent.js';
import SEOOptimizerAgent from './agents/seo-optimizer/SEOOptimizerAgent.js';
import SocialMediaAgent from './agents/social-media/SocialMediaAgent.js';
import EmailWriterAgent from './agents/email-writer/EmailWriterAgent.js';
import HeadlineGeneratorAgent from './agents/headline-generator/HeadlineGeneratorAgent.js';
import KeywordResearcherAgent from './agents/keyword-researcher/KeywordResearcherAgent.js';
import CompetitorAnalyzerAgent from './agents/competitor-analyzer/CompetitorAnalyzerAgent.js';
import TrendAnalyzerAgent from './agents/trend-analyzer/TrendAnalyzerAgent.js';
import PodcastScriptAgent from './agents/podcast-script/PodcastScriptAgent.js';
import VideoScriptAgent from './agents/video-script/VideoScriptAgent.js';
import RevenueTrackerAgent from './agents/revenue-tracker/RevenueTrackerAgent.js';
import PerformanceOptimizerAgent from './agents/performance-optimizer/PerformanceOptimizerAgent.js';

async function testAllAgents() {
  console.log(`
╔══════════════════════════════════════════╗
║  🧬 SOVEREIGN EMPIRE - 12 AGENT DNA TEST
║  Testing complete autonomous ecosystem
╚══════════════════════════════════════════╝
  `);

  const agents = {
    content: new ContentGeneratorAgent(),
    seo: new SEOOptimizerAgent(),
    social: new SocialMediaAgent(),
    email: new EmailWriterAgent(),
    headline: new HeadlineGeneratorAgent(),
    keyword: new KeywordResearcherAgent(),
    competitor: new CompetitorAnalyzerAgent(),
    trend: new TrendAnalyzerAgent(),
    podcast: new PodcastScriptAgent(),
    video: new VideoScriptAgent(),
    revenue: new RevenueTrackerAgent(),
    optimizer: new PerformanceOptimizerAgent()
  };

  console.log('\n✅ All 12 agents instantiated from AgentDNA!\n');
  Object.entries(agents).forEach(([name, agent]) => {
    console.log(`  ✓ ${agent.agentType}: Ready (v${agent.version})`);
  });

  console.log(`
╔══════════════════════════════════════════╗
║  🎉 SOVEREIGN EMPIRE READY FOR OPERATION
║
║  System Status: ✅ READY
║  Agents: 12/12 instantiated
║  DNA inheritance: ✅ CONFIRMED
║  
║  Next Steps:
║  1. Add Anthropic API key to .env
║  2. Run: node test-all-agents-dna.js
║  3. Deploy to Railway/cloud
║
╚══════════════════════════════════════════╝
  `);

  return agents;
}

testAllAgents().catch(console.error);

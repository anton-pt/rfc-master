import { generateText } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { RFCDomainModel, AgentType } from '../domain';
import { leadAgentTools, initializeTools } from '../tools/lead-agent-tools';

interface LeadAgentConfig {
  domainModel: RFCDomainModel;
  leadAgentId: string;
  systemPrompt: string;
}

export class LeadAgentService {
  private config: LeadAgentConfig;

  constructor(config: LeadAgentConfig) {
    this.config = config;
    initializeTools(config.domainModel, config.leadAgentId);
  }

  async handleUserRequest(userMessage: string, conversationHistory: any[] = []) {
    const messages = [
      {
        role: 'system' as const,
        content: this.config.systemPrompt
      },
      ...conversationHistory,
      {
        role: 'user' as const,
        content: userMessage
      }
    ];

    try {
      const result = await generateText({
        model: anthropic('claude-3-haiku-20240307'),
        tools: leadAgentTools,
        toolChoice: 'auto',
        messages,
        maxTokens: 2000
      });

      return {
        success: true,
        response: result.text,
        toolCalls: result.toolCalls,
        usage: result.usage
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        response: 'I apologize, but I encountered an error processing your request.'
      };
    }
  }

  async generateRFCFromDescription(description: string, sections?: string[]) {
    const userMessage = `Create an RFC document with the following description: "${description}"${
      sections ? ` Include these sections: ${sections.join(', ')}` : ''
    }. After creating the RFC, please search the codebase for relevant context and analyze the potential impact.`;

    return this.handleUserRequest(userMessage);
  }

  async reviewAndIterateRFC(rfcId: string, feedbackPrompt: string) {
    const userMessage = `For RFC ${rfcId}, please: 1) Get the current status and any open comments, 2) ${feedbackPrompt}, 3) Update the RFC based on any necessary changes, and 4) resolve any comments that were addressed.`;

    return this.handleUserRequest(userMessage);
  }

  async requestFeedback(rfcId: string, reviewerTypes: string[], concerns?: string) {
    const userMessage = `For RFC ${rfcId}, please request reviews from ${reviewerTypes.join(', ')} teams${
      concerns ? ` with focus on: ${concerns}` : ''
    }. Then check the current status and summarize what we're waiting for.`;

    return this.handleUserRequest(userMessage);
  }
}

// Example usage
async function demonstrateAIIntegration() {
  console.log('🤖 AI Integration Example - Lead Agent Service\n');

  // Setup
  const domainModel = new RFCDomainModel();
  const leadAgent = await domainModel.createAgent(
    AgentType.LEAD,
    'AI Lead Agent',
    { canEdit: true, canComment: true, canApprove: true }
  );

  const systemPrompt = `You are an expert software architect and lead agent responsible for managing RFC (Request for Comments) documents. Your role includes:

1. **RFC Creation**: Generate well-structured RFC documents based on user requirements
2. **Technical Research**: Search codebases and analyze impact of proposed changes  
3. **Review Coordination**: Request and manage reviews from specialized agent teams
4. **Feedback Integration**: Process reviewer feedback and update RFCs accordingly
5. **Status Tracking**: Monitor RFC progress and provide status updates

**Available Tools**: You have access to comprehensive RFC management tools including document creation, content updates, review requests, comment management, codebase search, and impact analysis.

**Communication Style**: Be thorough but concise. Explain your actions and reasoning. When using tools, describe what you're doing and why.

**Best Practices**: 
- Always search for relevant code context before making technical recommendations
- Request appropriate reviews based on the technical areas involved
- Address feedback constructively and update RFCs accordingly
- Keep stakeholders informed of progress and blockers`;

  const leadAgentService = new LeadAgentService({
    domainModel,
    leadAgentId: leadAgent.id,
    systemPrompt
  });

  console.log('1️⃣ Creating RFC from natural language description...\n');

  const createResult = await leadAgentService.generateRFCFromDescription(
    'We need to implement caching for our API responses to improve performance. The cache should support TTL, invalidation, and should work with Redis.',
    ['problem', 'solution', 'implementation']
  );

  if (createResult.success) {
    console.log('✅ RFC Creation Response:');
    console.log(createResult.response);
    console.log(`\n📊 Tool calls made: ${createResult.toolCalls?.length || 0}`);
  } else {
    console.log('❌ Error:', createResult.error);
    return;
  }

  // Extract RFC ID from tool calls (in a real app, you'd have a more robust way to do this)
  const createRfcCall = createResult.toolCalls?.find(call => call.toolName === 'createRFCDocument');
  const rfcId = createRfcCall?.result?.rfcId;

  if (!rfcId) {
    console.log('❌ Could not extract RFC ID from response');
    return;
  }

  console.log(`\n2️⃣ Requesting feedback from specialized teams...\n`);

  const reviewResult = await leadAgentService.requestFeedback(
    rfcId,
    ['backend', 'infrastructure', 'security'],
    'performance implications and Redis security configuration'
  );

  if (reviewResult.success) {
    console.log('✅ Review Request Response:');
    console.log(reviewResult.response);
  }

  console.log(`\n3️⃣ Simulating feedback and iteration...\n`);

  // Simulate some reviewer feedback first (in real usage, this would come from other agents)
  const backendAgent = await domainModel.createAgent(AgentType.BACKEND, 'Backend Expert');
  await domainModel.addComment({
    rfcId,
    agentId: backendAgent.id,
    agentType: AgentType.BACKEND,
    commentType: 'document-level',
    content: 'Consider implementing cache warming strategies for critical data. Also, we should add monitoring for cache hit rates.'
  });

  const iterationResult = await leadAgentService.reviewAndIterateRFC(
    rfcId,
    'address any performance and monitoring concerns raised by reviewers'
  );

  if (iterationResult.success) {
    console.log('✅ Iteration Response:');
    console.log(iterationResult.response);
  }

  console.log('\n4️⃣ Final conversation - status check...\n');

  const statusResult = await leadAgentService.handleUserRequest(
    `What's the current status of all RFCs? Provide a summary of what's pending and what actions are needed.`
  );

  if (statusResult.success) {
    console.log('✅ Status Summary:');
    console.log(statusResult.response);
  }

  console.log('\n🎯 Key Benefits of This Integration:');
  console.log('✓ Natural language interface for RFC management');
  console.log('✓ Automated tool selection based on user intent');
  console.log('✓ Comprehensive workflow orchestration');
  console.log('✓ Structured data management with AI reasoning');
  console.log('✓ Scalable architecture for complex RFC processes');
}

// Advanced example: Streaming responses for long operations
export async function streamingRFCGeneration(userRequest: string) {
  const domainModel = new RFCDomainModel();
  const leadAgent = await domainModel.createAgent(AgentType.LEAD, 'Streaming Lead Agent');
  
  initializeTools(domainModel, leadAgent.id);

  const result = await streamText({
    model: anthropic('claude-3-haiku-20240307'),
    tools: leadAgentTools,
    maxTokens: 2000,
    messages: [
      {
        role: 'system',
        content: 'You are a lead architect. Create RFCs and explain your process step by step.'
      },
      {
        role: 'user', 
        content: userRequest
      }
    ]
  });

  return result;
}

// Run the demonstration
if (require.main === module) {
  demonstrateAIIntegration().catch(console.error);
}
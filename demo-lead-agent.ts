#!/usr/bin/env tsx

/**
 * Demo script for Lead Agent RFC Generation
 * 
 * This demonstrates the complete RFC lifecycle:
 * 1. User requests RFC creation
 * 2. Agent gathers context and creates RFC
 * 3. Agent coordinates review process
 * 4. Agent processes feedback and updates RFC
 * 5. Agent finalizes RFC
 * 
 * Run with: npx tsx demo-lead-agent.ts
 */

import { RFCDomainModel, AgentType } from './src/domain';
import { InMemoryStorage } from './src/domain/storage/in-memory';
import { createLeadAgent } from './src/agents/lead-agent';
import { ResponseFormatter, InteractiveFormatter } from './src/agents/response-formatter';
import { createWorkflowEngine } from './src/agents/workflow-engine';

// Demo configuration
const DEMO_CONFIG = {
  useRealAI: false, // Set to true to use actual AI model
  showProgressIndicators: true,
  simulateTypingDelay: 1000
};

// Conversation scenarios
const CONVERSATION_SCENARIOS = [
  {
    name: 'RFC Creation',
    userMessages: [
      "Create an RFC for adding rate limiting to our REST API",
      "Add more details about the implementation approach",
      "Request review from backend and security teams"
    ]
  },
  {
    name: 'Review Processing',
    userMessages: [
      "Check for any review comments",
      "Address the security concerns about token storage",
      "Get the current RFC status"
    ]
  },
  {
    name: 'Context Gathering',
    userMessages: [
      "Search the codebase for authentication middleware",
      "Analyze the impact of these auth changes",
      "What are the suggested next steps?"
    ]
  }
];

async function simulateDelay(ms: number = DEMO_CONFIG.simulateTypingDelay): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function printSeparator(title: string): void {
  console.log('\n' + '='.repeat(80));
  console.log(`🎯 ${title}`);
  console.log('='.repeat(80) + '\n');
}

function printUserMessage(message: string): void {
  console.log(`👤 **User:** ${message}\n`);
}

function printAgentResponse(response: string): void {
  console.log(`🤖 **Lead Agent:**\n${response}\n`);
}

/**
 * Mock Lead Agent for demo purposes
 */
class MockLeadAgent {
  private domainModel: RFCDomainModel;
  private currentRFC: any = null;
  private conversationCount = 0;

  constructor(domainModel: RFCDomainModel) {
    this.domainModel = domainModel;
  }

  async processMessage(userMessage: string): Promise<any> {
    this.conversationCount++;
    await simulateDelay(500); // Simulate processing time

    // Determine response based on message content
    const message = userMessage.toLowerCase();

    if (message.includes('create') && message.includes('rfc')) {
      return await this.handleRFCCreation(userMessage);
    } else if (message.includes('review')) {
      return await this.handleReviewRequest(userMessage);
    } else if (message.includes('search') || message.includes('context')) {
      return await this.handleContextGathering(userMessage);
    } else if (message.includes('status')) {
      return await this.handleStatusRequest();
    } else if (message.includes('impact') || message.includes('analyze')) {
      return await this.handleImpactAnalysis();
    } else {
      return await this.handleGeneralResponse(userMessage);
    }
  }

  private async handleRFCCreation(userMessage: string): Promise<any> {
    // Create a real RFC in the domain model
    this.currentRFC = await this.domainModel.createRFC(
      'RFC: API Rate Limiting Implementation',
      `# RFC: API Rate Limiting Implementation

## Summary
This RFC proposes implementing rate limiting across our REST API to prevent abuse and ensure service reliability.

## Problem Statement
Our current API lacks rate limiting, making it vulnerable to:
- DDoS attacks and service overload
- Abuse by malicious actors
- Uneven resource consumption by heavy users

## Proposed Solution
Implement a token bucket rate limiting system with:
- Per-user and per-IP rate limits
- Redis-backed distributed rate limiting
- Configurable limits per endpoint
- Graceful degradation under load

## Implementation Plan
1. Create rate limiting middleware
2. Integrate with Redis for distributed state
3. Add configuration system for different limits
4. Implement monitoring and alerting
5. Gradual rollout starting with public endpoints

## Alternatives Considered
- Fixed window rate limiting (rejected - too strict)
- Sliding window (rejected - too complex for initial version)
- Third-party service (rejected - prefer in-house control)

## Risks and Mitigations
- **Risk:** False positives blocking legitimate users
  - **Mitigation:** Conservative initial limits with monitoring
- **Risk:** Redis dependency introduces new failure point
  - **Mitigation:** Graceful fallback to in-memory limiting

## Success Metrics
- 99.9% API uptime maintained
- < 0.1% false positive rate
- Response time impact < 10ms p95
`,
      'lead-agent-demo',
      'demo-session'
    );

    // Mock search results
    const searchResults = [
      {
        file: 'src/middleware/auth.ts',
        line: 23,
        matchedLine: 'export const authMiddleware = async (req, res, next) => {',
        context: {
          before: ['// Authentication middleware', '// Validates JWT tokens'],
          after: ['  const token = req.headers.authorization;', '  if (!token) return res.status(401);']
        }
      },
      {
        file: 'src/api/routes/users.ts',
        line: 45,
        matchedLine: 'router.get(\'/profile\', authMiddleware, getUserProfile);',
        context: {
          before: ['// User profile endpoints'],
          after: ['router.put(\'/profile\', authMiddleware, updateProfile);']
        }
      }
    ];

    // Mock impact analysis
    const impactAnalysis = {
      impacts: [
        {
          area: 'api',
          severity: 'high',
          description: 'All API endpoints will require rate limiting middleware',
          files: ['src/api/routes/*.ts', 'src/middleware/*.ts'],
          details: 'Rate limiting must be carefully integrated with existing auth flow'
        },
        {
          area: 'infrastructure',
          severity: 'medium',
          description: 'Redis deployment required for distributed rate limiting',
          files: ['docker-compose.yml', 'k8s/redis.yaml'],
          details: 'New Redis instance needed for rate limit state management'
        },
        {
          area: 'monitoring',
          severity: 'low',
          description: 'Metrics collection for rate limit effectiveness',
          files: ['src/metrics/rate-limits.ts'],
          details: 'Dashboard and alerting for rate limit violations'
        }
      ],
      summary: { high: 1, medium: 1, low: 1 }
    };

    const response = `I've created a comprehensive RFC for API rate limiting! Let me walk you through what I discovered:

${ResponseFormatter.formatSearchResults(searchResults)}

${ResponseFormatter.formatImpactAnalysis(impactAnalysis)}

The RFC includes:
✅ **Problem analysis** based on current API structure
✅ **Token bucket solution** with Redis backing
✅ **Implementation roadmap** with clear phases  
✅ **Risk assessment** with mitigation strategies
✅ **Success metrics** for measuring effectiveness

The RFC is now ready for review. I recommend requesting feedback from:
- **Backend team** for implementation approach
- **Infrastructure team** for Redis deployment
- **Security team** for abuse prevention strategies`;

    return {
      message: response,
      rfcArtifact: this.currentRFC,
      actions: [
        'Used searchCodebase',
        'Used analyzeImpact', 
        'Used createRFCDocument',
        'Used updateRFCContent'
      ],
      suggestions: [
        'Request reviews from backend, infrastructure, and security teams',
        'Add more specific rate limit values based on current traffic',
        'Consider adding examples of rate limit headers'
      ]
    };
  }

  private async handleReviewRequest(): Promise<any> {
    const response = `I've requested reviews from the backend, infrastructure, and security teams for the rate limiting RFC.

## 👥 Review Request Status

**Reviewers Assigned:**
- ⚙️ Backend Team: Focus on middleware integration
- 🏗️ Infrastructure Team: Redis deployment and scaling
- 🔒 Security Team: Abuse prevention and bypass protection

**Timeline:** Reviews typically complete within 2-3 business days

I've added a context comment highlighting the key areas for each team to focus on. The reviewers will provide feedback on:
- Implementation feasibility
- Performance implications  
- Security considerations
- Operational concerns

Once reviews start coming in, I'll help you process the feedback and update the RFC accordingly.`;

    return {
      message: response,
      actions: ['Used requestReview'],
      suggestions: [
        'Check for review comments in 24-48 hours',
        'Add clarifying examples while waiting for feedback',
        'Prepare implementation timeline estimates'
      ]
    };
  }

  private async handleContextGathering(): Promise<any> {
    const searchResults = [
      {
        file: 'src/middleware/auth.ts',
        line: 15,
        matchedLine: 'export async function validateJWT(token: string): Promise<User>',
        context: {
          before: ['// JWT token validation', 'import jwt from \'jsonwebtoken\';'],
          after: ['  try {', '    const decoded = jwt.verify(token, process.env.JWT_SECRET);']
        }
      },
      {
        file: 'src/middleware/cors.ts',
        line: 8,
        matchedLine: 'app.use(cors({ origin: allowedOrigins }));',
        context: {
          before: ['// CORS configuration'],
          after: ['const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(\',\');']
        }
      }
    ];

    const response = `I've searched the codebase for authentication and middleware patterns. Here's what I found:

${ResponseFormatter.formatSearchResults(searchResults)}

**Key Insights:**
- Existing JWT authentication middleware can serve as template
- CORS middleware shows how to integrate cross-cutting concerns
- Current auth flow uses standard Express middleware pattern
- JWT validation is centralized and well-structured

This context suggests the rate limiting middleware should:
1. Follow the same middleware pattern as authentication
2. Integrate cleanly with existing JWT validation
3. Use similar environment variable configuration approach
4. Maintain the current request/response flow`;

    return {
      message: response,
      actions: ['Used searchCodebase'],
      suggestions: [
        'Analyze the performance impact of adding rate limiting',
        'Create a middleware integration diagram',
        'Define configuration schema for rate limits'
      ]
    };
  }

  private async handleStatusRequest(): Promise<any> {
    const response = `## 📊 RFC Status Dashboard

**Current RFC:** API Rate Limiting Implementation
**Status:** Draft | **Version:** 1 | **ID:** \`${this.currentRFC?.id || 'demo-rfc-123'}\`
**Created:** ${new Date().toISOString().split('T')[0]}

**Progress:**
✅ Problem analysis completed
✅ Solution design finished  
✅ Implementation plan outlined
✅ Context gathered from codebase
🔄 Review process initiated
⏳ Reviewer feedback pending
⏳ Final revisions needed
⏳ Implementation ready

**Review Status:**
- Backend team: Review requested, pending response
- Infrastructure team: Review requested, pending response  
- Security team: Review requested, pending response

**Next Actions:**
1. Wait for reviewer feedback (24-48 hours)
2. Address any concerns raised
3. Finalize implementation details
4. Create implementation tickets`;

    return {
      message: response,
      actions: ['Used getRFCStatus'],
      suggestions: [
        'Check for new review comments',
        'Add implementation timeline estimates',
        'Create architecture diagrams'
      ]
    };
  }

  private async handleImpactAnalysis(): Promise<any> {
    const impactAnalysis = {
      impacts: [
        {
          area: 'performance',
          severity: 'medium',
          description: 'Rate limiting adds ~2-5ms latency per request',
          files: ['src/middleware/rate-limit.ts'],
          details: 'Redis lookup and token bucket calculations add minimal overhead',
          metaJoke: '⚡ Making requests slower to make the service faster. The irony!'
        },
        {
          area: 'reliability',
          severity: 'high',
          description: 'Significant improvement in service stability',
          files: ['src/api/**/*.ts'],
          details: 'Rate limiting prevents cascading failures and resource exhaustion'
        },
        {
          area: 'user-experience',
          severity: 'low',
          description: 'Minor UX impact for legitimate heavy users',
          files: ['src/client/api-client.ts'],
          details: 'Need proper error messages and retry logic for rate limited requests'
        }
      ],
      summary: { high: 1, medium: 1, low: 1 },
      metaMessage: '🎪 Analysis complete! Rate limiting will make everything more stable (and slightly more complex).'
    };

    const response = `I've analyzed the impact of implementing API rate limiting across our system:

${ResponseFormatter.formatImpactAnalysis(impactAnalysis)}

**Overall Assessment:**
- **High positive impact** on system reliability and abuse prevention
- **Medium performance impact** that's acceptable for the benefits gained
- **Low user experience impact** that can be mitigated with good UX

**Risk Mitigation Recommendations:**
1. Start with generous rate limits and tighten based on data
2. Implement clear error messages for rate-limited requests
3. Add monitoring dashboards for false positives
4. Create bypass mechanism for internal services`;

    return {
      message: response,
      actions: ['Used analyzeImpact'],
      suggestions: [
        'Define specific rate limit values based on current traffic patterns',
        'Create monitoring and alerting for rate limit violations',
        'Plan gradual rollout strategy'
      ]
    };
  }

  private async handleGeneralResponse(userMessage: string): Promise<any> {
    const response = `I understand you'd like to "${userMessage}". Let me help you with that!

Based on our current RFC for API rate limiting, I can:
- **Gather more context** from the codebase about related systems
- **Refine specific sections** of the RFC based on your needs
- **Request targeted reviews** from specific teams
- **Analyze implementation details** in more depth

What would be most helpful for moving the RFC forward?`;

    return {
      message: response,
      actions: [],
      suggestions: [
        'Search for specific implementation patterns',
        'Request review from a particular team',
        'Add more detail to a specific RFC section',
        'Analyze a particular aspect in more depth'
      ]
    };
  }
}

/**
 * Run the demo conversation
 */
async function runDemo(): Promise<void> {
  printSeparator('🤖 Lead Agent RFC Generation Demo');

  console.log('🎬 Welcome to the Lead Agent demo!');
  console.log('This showcases an AI-powered technical lead that can:');
  console.log('- Create comprehensive RFCs by analyzing your codebase');
  console.log('- Coordinate review processes with expert agents');
  console.log('- Process feedback and iteratively improve documents');
  console.log('- Maintain conversation context across interactions\n');

  // Initialize domain model and agent
  const storage = new InMemoryStorage();
  const domainModel = new RFCDomainModel(storage);
  
  // Use mock agent for demo (replace with real agent for actual use)
  const agent = new MockLeadAgent(domainModel);

  // Demo scenario 1: RFC Creation
  printSeparator('Scenario 1: RFC Creation with Context Gathering');
  
  for (const message of CONVERSATION_SCENARIOS[0].userMessages) {
    printUserMessage(message);
    
    if (DEMO_CONFIG.showProgressIndicators) {
      console.log('🔄 Processing... (analyzing codebase, creating RFC)\n');
      await simulateDelay();
    }

    const response = await agent.processMessage(message);
    printAgentResponse(response.message);
    
    if (response.suggestions.length > 0) {
      console.log('💡 **Suggestions:**');
      response.suggestions.forEach((suggestion: string, index: number) => {
        console.log(`   ${index + 1}. ${suggestion}`);
      });
      console.log();
    }
  }

  // Demo scenario 2: Review Processing
  printSeparator('Scenario 2: Review Coordination & Feedback');
  
  for (const message of CONVERSATION_SCENARIOS[1].userMessages) {
    printUserMessage(message);
    
    if (DEMO_CONFIG.showProgressIndicators) {
      console.log('🔄 Processing... (coordinating reviews, checking feedback)\n');
      await simulateDelay();
    }

    const response = await agent.processMessage(message);
    printAgentResponse(response.message);
  }

  // Demo scenario 3: Context & Analysis
  printSeparator('Scenario 3: Deep Context Analysis');
  
  for (const message of CONVERSATION_SCENARIOS[2].userMessages) {
    printUserMessage(message);
    
    if (DEMO_CONFIG.showProgressIndicators) {
      console.log('🔄 Processing... (searching codebase, analyzing impact)\n');
      await simulateDelay();
    }

    const response = await agent.processMessage(message);
    printAgentResponse(response.message);
  }

  // Show help menu
  printSeparator('Available Commands & Usage');
  console.log(InteractiveFormatter.createHelpMenu());

  // Demo summary
  printSeparator('Demo Summary');
  console.log('✨ **What you just saw:**');
  console.log('1. 🔍 **Intelligent Context Gathering** - Agent searched actual codebase');
  console.log('2. 📝 **Comprehensive RFC Creation** - Structured, detailed technical proposals');
  console.log('3. 👥 **Review Coordination** - Automated expert reviewer assignment');
  console.log('4. 🔄 **Iterative Refinement** - Continuous improvement based on feedback');
  console.log('5. 💬 **Natural Conversation** - Easy-to-use natural language interface');
  console.log();
  console.log('🚀 **Ready for Integration:**');
  console.log('- Plug in your preferred LLM (GPT-4, Claude, etc.)');
  console.log('- Connect to your actual codebase');
  console.log('- Configure reviewer agents for your team structure');
  console.log('- Customize RFC templates for your organization');
  console.log();
  console.log('🎯 **Perfect for:** Technical leads, engineering teams, and anyone who writes RFCs!');
}

// Run the demo
runDemo().catch(console.error);
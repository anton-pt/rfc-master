import { generateText, streamText } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { RFCDomainModel, AgentType } from '../domain';
import { leadAgentTools, initializeTools } from '../tools/lead-agent-tools';

async function demonstrateLeadAgentTools() {
  console.log('🤖 Lead Agent Tools Integration Example\n');

  // Initialize the domain model and create lead agent
  const domainModel = new RFCDomainModel();
  const leadAgent = await domainModel.createAgent(
    AgentType.LEAD,
    'Lead Architecture Agent',
    { canEdit: true, canComment: true, canApprove: true }
  );

  // Initialize tools with the domain model and lead agent
  initializeTools(domainModel, leadAgent.id);

  console.log('1️⃣ Simulating user request: "Create an RFC for migrating our auth system to OAuth"\n');

  // Simulate the lead agent using tools to handle user request
  try {
    const response = await generateText({
      model: anthropic('claude-3-haiku-20240307'),
      tools: leadAgentTools,
      toolChoice: 'auto',
      messages: [
        {
          role: 'system',
          content: `You are a lead software architect agent. Your role is to:
1. Create and manage RFC documents
2. Coordinate reviews with specialized agents
3. Gather technical context from codebases
4. Address feedback and resolve comments

You have access to tools for RFC management. Use them to handle user requests effectively.`
        },
        {
          role: 'user',
          content: 'Create an RFC for migrating our authentication system from custom tokens to OAuth 2.0. Include problem statement, solution, and implementation sections. Then request reviews from backend and security teams.'
        }
      ],
      maxTokens: 2000
    });

    console.log('🤖 Lead Agent Response:');
    console.log(response.text);
    
    if (response.toolCalls && response.toolCalls.length > 0) {
      console.log('\n🔧 Tools Called:');
      response.toolCalls.forEach((call, index) => {
        console.log(`   ${index + 1}. ${call.toolName}`);
        console.log(`      Parameters:`, JSON.stringify(call.args, null, 2));
        console.log(`      Result:`, JSON.stringify(call.result, null, 2));
      });
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }

  console.log('\n2️⃣ Manual tool demonstration (without LLM):\n');

  // Demonstrate tools manually
  console.log('📝 Creating RFC document...');
  const createResult = await leadAgentTools.createRFCDocument.execute({
    title: 'Migrate Authentication to OAuth 2.0',
    description: 'Replace our custom token-based authentication with industry-standard OAuth 2.0',
    sections: ['problem', 'solution', 'implementation', 'risks']
  });
  
  if ('error' in createResult) {
    console.log('❌ Error creating RFC:', createResult.error);
    return;
  }

  console.log('✅ RFC created successfully!');
  console.log(`   - RFC ID: ${createResult.rfcId}`);
  console.log(`   - Version: ${createResult.version}`);
  console.log(`   - Status: ${createResult.status}`);
  
  const rfcId = createResult.rfcId;

  console.log('\n🔍 Searching codebase for authentication context...');
  const searchResult = await leadAgentTools.searchCodebase.execute({
    query: 'authentication login session',
    fileTypes: ['.ts', '.js'],
    limit: 5
  });

  if ('error' in searchResult) {
    console.log('❌ Search error:', searchResult.error);
  } else {
    console.log(`✅ Found ${searchResult.results.length} relevant code snippets:`);
    searchResult.results.forEach((result, index) => {
      console.log(`   ${index + 1}. ${result.file}:${result.line}`);
      console.log(`      ${result.content}`);
    });
  }

  console.log('\n📊 Analyzing impact of the proposed changes...');
  const impactResult = await leadAgentTools.analyzeImpact.execute({
    rfcId,
    scope: ['api', 'database', 'dependencies', 'tests']
  });

  if ('error' in impactResult) {
    console.log('❌ Impact analysis error:', impactResult.error);
  } else {
    console.log(`✅ Impact analysis complete:`);
    console.log(`   - High impact: ${impactResult.summary.high} areas`);
    console.log(`   - Medium impact: ${impactResult.summary.medium} areas`);
    console.log(`   - Low impact: ${impactResult.summary.low} areas`);
    console.log(`   - Total files affected: ${impactResult.totalFiles}`);
  }

  console.log('\n✏️ Adding implementation details based on research...');
  const updateResult = await leadAgentTools.updateRFCContent.execute({
    rfcId,
    oldText: '<!-- Technical details of how the solution will be implemented -->',
    newText: `We will implement OAuth 2.0 using the following approach:

1. **Library Selection**: Use passport-oauth2 for Node.js integration
2. **Database Changes**: Add oauth_tokens and refresh_tokens tables
3. **API Modifications**: Update /login and /refresh endpoints
4. **Client Integration**: Provide OAuth 2.0 client libraries

**Security Considerations**:
- Use PKCE (Proof Key for Code Exchange) for public clients
- Implement proper token rotation for refresh tokens
- Store tokens with appropriate encryption`
  });

  if (updateResult.success) {
    console.log('✅ RFC content updated successfully');
    console.log(`   - Replacements made: ${updateResult.replacementCount}`);
    console.log(`   - New version: ${updateResult.version}`);
  } else {
    console.log('❌ Update failed:', updateResult.error);
  }

  console.log('\n👥 Requesting reviews from specialized agents...');
  const reviewResult = await leadAgentTools.requestReview.execute({
    rfcId,
    reviewerTypes: ['backend', 'security', 'frontend'],
    specificConcerns: 'Focus on security implications, API breaking changes, and client-side integration complexity'
  });

  if ('error' in reviewResult) {
    console.log('❌ Review request error:', reviewResult.error);
  } else {
    console.log('✅ Review requested successfully');
    console.log(`   - Review ID: ${reviewResult.reviewRequestId}`);
    console.log(`   - Reviewers assigned: ${reviewResult.reviewersAssigned.length}`);
    reviewResult.reviewersAssigned.forEach(reviewer => {
      console.log(`     • ${reviewer.name} (${reviewer.agentType})`);
    });
  }

  console.log('\n💭 Adding lead agent context comment...');
  const commentResult = await leadAgentTools.addLeadComment.execute({
    rfcId,
    type: 'document-level',
    content: 'This RFC is high priority due to security vulnerabilities in our current custom auth system. Target completion: Q2.',
    category: 'context'
  });

  if ('error' in commentResult) {
    console.log('❌ Comment error:', commentResult.error);
  } else {
    console.log('✅ Context comment added');
    console.log(`   - Comment ID: ${commentResult.commentId}`);
    console.log(`   - Category: ${commentResult.category}`);
  }

  // Simulate reviewer comments (normally these would come from other agents)
  console.log('\n🔄 Simulating reviewer feedback...');
  
  // Create some reviewer agents and add their comments
  const backendAgent = await domainModel.createAgent(AgentType.BACKEND, 'Backend Specialist');
  const securityAgent = await domainModel.createAgent(AgentType.SECURITY, 'Security Expert');
  
  await domainModel.addComment({
    rfcId,
    agentId: backendAgent.id,
    agentType: AgentType.BACKEND,
    commentType: 'inline',
    content: 'Consider using Redis for token storage instead of database tables for better performance',
    quotedText: 'Add oauth_tokens and refresh_tokens tables'
  });

  await domainModel.addComment({
    rfcId,
    agentId: securityAgent.id,
    agentType: AgentType.SECURITY,
    commentType: 'document-level',
    content: 'CRITICAL: Must implement rate limiting on OAuth endpoints to prevent abuse. Also need proper token revocation mechanism.'
  });

  console.log('\n📋 Retrieving review comments...');
  const commentsResult = await leadAgentTools.getReviewComments.execute({
    rfcId
  });

  if ('error' in commentsResult) {
    console.log('❌ Comments retrieval error:', commentsResult.error);
  } else {
    console.log(`✅ Retrieved ${commentsResult.totalCount} comments:`);
    console.log(`   - Open: ${commentsResult.openCount}`);
    console.log(`   - Resolved: ${commentsResult.resolvedCount}`);
    
    commentsResult.comments.forEach((comment, index) => {
      console.log(`\n   ${index + 1}. ${comment.agentName} (${comment.agentType}):`);
      console.log(`      "${comment.content}"`);
      console.log(`      Status: ${comment.status}`);
      if (comment.quotedText) {
        console.log(`      Referenced: "${comment.quotedText}"`);
      }
    });
  }

  console.log('\n✅ Addressing critical security feedback...');
  
  // Update RFC to address security concerns
  await leadAgentTools.addSection.execute({
    rfcId,
    sectionTitle: 'Rate Limiting and Security',
    content: `### Rate Limiting
- Implement rate limiting on OAuth endpoints (10 requests/minute per IP)
- Use exponential backoff for failed authentication attempts

### Token Security
- Implement token revocation endpoint (/oauth/revoke)
- Use short-lived access tokens (15 minutes)
- Implement proper token rotation for refresh tokens
- Add audit logging for all OAuth operations`,
    afterSection: 'Implementation Details'
  });

  // Resolve the security comment
  const securityComment = commentsResult.comments.find(c => c.agentType === 'security');
  if (securityComment) {
    await leadAgentTools.resolveComment.execute({
      commentId: securityComment.commentId,
      resolution: 'Added comprehensive rate limiting and token security section addressing all security concerns',
      rfcUpdated: true
    });
  }

  console.log('\n📊 Final RFC status...');
  const statusResult = await leadAgentTools.getRFCStatus.execute({ rfcId });
  
  if ('error' in statusResult) {
    console.log('❌ Status error:', statusResult.error);
  } else {
    console.log('✅ RFC Status Summary:');
    console.log(`   - Title: ${statusResult.title}`);
    console.log(`   - Status: ${statusResult.status}`);
    console.log(`   - Version: ${statusResult.currentVersion}`);
    console.log(`   - Open Comments: ${statusResult.openComments}`);
    console.log(`   - Total Comments: ${statusResult.totalComments}`);
    console.log('   - Review Status:');
    Object.entries(statusResult.reviewStatus).forEach(([type, status]) => {
      console.log(`     • ${type}: ${status}`);
    });
  }

  console.log('\n🎉 Lead agent workflow completed successfully!');
  console.log('\nThis example demonstrated:');
  console.log('✓ Creating structured RFC documents');
  console.log('✓ Searching codebase for context');
  console.log('✓ Analyzing impact of proposed changes');
  console.log('✓ Updating RFC content based on research');
  console.log('✓ Requesting reviews from specialized agents');
  console.log('✓ Managing comments and resolutions');
  console.log('✓ Adding sections and improving content');
  console.log('✓ Tracking RFC status and progress');
}

// Run the example
demonstrateLeadAgentTools().catch(console.error);
import { RFCDomainModel, AgentType, CommentType, RFCStatus, CommentStatus } from '../domain';

async function demonstrateRFCDomainModel() {
  console.log('🚀 RFC Domain Model Usage Example\n');

  const model = new RFCDomainModel();

  console.log('1️⃣ Creating agents...');
  const leadAgent = await model.createAgent(AgentType.LEAD, 'Sarah - Lead Architect');
  const frontendAgent = await model.createAgent(AgentType.FRONTEND, 'John - Frontend Expert');
  const backendAgent = await model.createAgent(AgentType.BACKEND, 'Mike - Backend Expert');
  const securityAgent = await model.createAgent(AgentType.SECURITY, 'Lisa - Security Expert');
  console.log(`   ✅ Created ${(await model.listAgents()).length} agents\n`);

  console.log('2️⃣ Creating RFC document...');
  const rfc = await model.createRFC(
    'API Gateway Architecture',
    `# API Gateway Architecture RFC

## Overview
This RFC proposes a new API gateway architecture for our microservices.

## Goals
- Unified entry point for all services
- Authentication and authorization
- Rate limiting and throttling
- Request/response transformation

## Technical Details
The gateway will use Node.js with Express framework.
We'll implement JWT-based authentication.
Rate limiting will use Redis for distributed state.

## Security Considerations
All traffic must be encrypted using TLS 1.3.
API keys will be stored in a secure vault.`,
    leadAgent.id,
    'user-session-123'
  );
  console.log(`   ✅ Created RFC: "${rfc.title}" (ID: ${rfc.id})\n`);

  console.log('3️⃣ Requesting review from domain experts...');
  const reviewRequest = await model.requestReview({
    rfcId: rfc.id,
    requestedBy: leadAgent.id,
    reviewerAgentIds: [frontendAgent.id, backendAgent.id, securityAgent.id],
    deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  });
  console.log(`   ✅ Review requested from ${reviewRequest.reviewerAgentIds.length} agents\n`);

  console.log('4️⃣ Frontend agent adding inline comment...');
  const frontendComment = await model.addComment({
    rfcId: rfc.id,
    agentId: frontendAgent.id,
    agentType: AgentType.FRONTEND,
    commentType: CommentType.INLINE,
    content: 'Consider adding GraphQL support for more flexible client queries',
    quotedText: 'Express framework',
    lineReference: 15
  });
  console.log(`   ✅ Comment added: "${frontendComment.content}"\n`);

  console.log('5️⃣ Security agent adding document-level comment...');
  const securityComment = await model.addComment({
    rfcId: rfc.id,
    agentId: securityAgent.id,
    agentType: AgentType.SECURITY,
    commentType: CommentType.DOCUMENT_LEVEL,
    content: 'We should also implement OAuth 2.0 alongside JWT for third-party integrations'
  });
  console.log(`   ✅ Comment added: "${securityComment.content}"\n`);

  console.log('6️⃣ Lead replying to security comment...');
  const leadReply = await model.replyToComment({
    parentCommentId: securityComment.id,
    agentId: leadAgent.id,
    agentType: AgentType.LEAD,
    content: 'Good point! I will add OAuth 2.0 to the authentication section.'
  });
  console.log(`   ✅ Reply added: "${leadReply.content}"\n`);

  console.log('7️⃣ Updating RFC content based on feedback...');
  const updatedContent = rfc.content.replace(
    "We'll implement JWT-based authentication.",
    "We'll implement JWT-based authentication and OAuth 2.0 for third-party integrations."
  );
  const updatedRFC = await model.updateRFCContent(rfc.id, updatedContent);
  console.log(`   ✅ RFC updated to version ${updatedRFC.version}\n`);

  console.log('8️⃣ Using string replacement for GraphQL addition...');
  const withGraphQL = await model.replaceString({
    rfcId: rfc.id,
    oldText: 'Express framework',
    newText: 'Express framework with GraphQL support',
    replaceAll: true
  });
  console.log(`   ✅ RFC updated to version ${withGraphQL.version}\n`);

  console.log('9️⃣ Agents submitting their reviews...');
  await model.submitReview({
    reviewRequestId: reviewRequest.id,
    agentId: frontendAgent.id,
    comments: []
  });
  console.log('   ✅ Frontend review submitted');

  await model.submitReview({
    reviewRequestId: reviewRequest.id,
    agentId: backendAgent.id,
    comments: []
  });
  console.log('   ✅ Backend review submitted');

  await model.submitReview({
    reviewRequestId: reviewRequest.id,
    agentId: securityAgent.id,
    comments: []
  });
  console.log('   ✅ Security review submitted\n');

  const isComplete = await model.isReviewComplete(reviewRequest.id);
  console.log(`   📊 Review complete: ${isComplete}\n`);

  console.log('🔟 Resolving comments and updating status...');
  await model.resolveComment(frontendComment.id, leadAgent.id);
  await model.resolveComment(securityComment.id, leadAgent.id);
  console.log('   ✅ All comments resolved');

  const approvedRFC = await model.updateRFCStatus(rfc.id, RFCStatus.IN_REVIEW);
  const finalRFC = await model.updateRFCStatus(rfc.id, RFCStatus.APPROVED);
  console.log(`   ✅ RFC status updated to: ${finalRFC.status}\n`);

  console.log('📋 Final RFC Summary:');
  console.log(`   - Title: ${finalRFC.title}`);
  console.log(`   - Version: ${finalRFC.version}`);
  console.log(`   - Status: ${finalRFC.status}`);
  console.log(`   - Total Comments: ${(await model.getCommentsForRFC(rfc.id)).length}`);
  console.log(`   - Open Comments: ${(await model.getCommentsForRFC(rfc.id, CommentStatus.OPEN)).length}`);
  console.log(`   - Resolved Comments: ${(await model.getCommentsForRFC(rfc.id, CommentStatus.RESOLVED)).length}`);

  console.log('\n✨ Example completed successfully!');
}

demonstrateRFCDomainModel().catch(console.error);
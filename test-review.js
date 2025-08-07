#!/usr/bin/env node

/**
 * Simple test to verify that the requestReview tool now generates actual comments
 */

const { RFCDomainModel } = require('./dist/domain');
const { InMemoryStorage } = require('./dist/domain/storage/in-memory');
const { createLeadAgent } = require('./dist/agents/lead-agent');
const { createAgentContext } = require('./dist/agents/agent-context');

async function testReviewGeneration() {
  console.log('🧪 Testing review comment generation...\n');
  
  try {
    // Initialize domain model
    const storage = new InMemoryStorage();
    const domainModel = new RFCDomainModel(storage);
    
    // Load context
    const TODO_FILE_PATH = './demo/todo.ts';
    const codebaseContext = createAgentContext(TODO_FILE_PATH);
    
    // Create lead agent
    const agent = await createLeadAgent(domainModel, codebaseContext);
    
    // Create an RFC first
    console.log('📝 Creating RFC...');
    const createResponse = await agent.processMessage('Create an RFC to add undo functionality to the todo CLI');
    console.log('✅ RFC created\n');
    
    // Request a review (this should now generate actual comments)
    console.log('👥 Requesting frontend review with comment generation...');
    const reviewResponse = await agent.processMessage('Request a frontend review focusing on user experience');
    
    console.log('Review Response Actions:', reviewResponse.actions);
    console.log('Review Response Message:', reviewResponse.message?.substring(0, 200) + '...');
    
    // Check for comments
    console.log('\n💬 Checking for generated comments...');
    const commentsResponse = await agent.processMessage('Show me all review comments');
    
    console.log('Comments Response:', commentsResponse.message?.substring(0, 300) + '...');
    
    console.log('\n✅ Test completed! Check the output above to see if comments were generated.');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testReviewGeneration();
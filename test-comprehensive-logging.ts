#!/usr/bin/env tsx

/**
 * Test Comprehensive Logging System
 * 
 * This script tests the new comprehensive logging system that provides
 * detailed visibility into tool invocations, agent processing, and RFC workflows.
 */

import { RFCDomainModel } from './src/domain';
import { InMemoryStorage } from './src/domain/storage/in-memory';
import { createLeadAgent } from './src/agents/lead-agent';
import { createAgentContext } from './src/agents/agent-context';
import { configureLogging, LogLevel, log } from './src/utils/logging';

async function testComprehensiveLogging() {
  console.log('🧪 Testing Comprehensive Logging System\n');

  // Configure logging for maximum visibility
  configureLogging({
    level: LogLevel.DEBUG, // Show all log levels
    enableColors: true,
    enableTimestamps: true,
    enablePerformance: true,
    maxParameterLength: 300
  });

  console.log('⚙️  Logging configured for maximum visibility (DEBUG level)');
  console.log('🎨 Colors enabled, timestamps enabled, performance tracking enabled\n');

  try {
    // Performance measurement for initialization
    log.perf.startMeasurement('initialization');

    // Initialize domain model
    console.log('📦 Initializing domain model...');
    const storage = new InMemoryStorage();
    const domainModel = new RFCDomainModel(storage);
    
    // Load codebase context
    const TODO_FILE_PATH = './demo/todo.ts';
    console.log(`📁 Loading codebase context from ${TODO_FILE_PATH}...`);
    
    const codebaseContext = createAgentContext(TODO_FILE_PATH);
    console.log('✅ Context loaded successfully!');

    // Create agent with context
    console.log('🤖 Creating Lead Agent with comprehensive logging...');
    const agent = createLeadAgent(domainModel, codebaseContext);
    
    const initTime = log.perf.endMeasurement('initialization', 'Agent and context setup');
    console.log(`⚡ Initialization completed in ${initTime}ms\n`);

    // Test 1: Simple RFC Creation Request
    console.log('🎯 TEST 1: RFC Creation with Full Logging');
    console.log('============================================================');
    
    const testRequest = "Add user authentication to the todo application";
    log.cli.logRFCCreation(testRequest);
    
    log.perf.startMeasurement('rfc-creation');
    
    // This will trigger the full logging chain:
    // 1. Agent session logging
    // 2. Iteration logging
    // 3. Tool execution logging for each tool called
    // 4. Response formatting logging
    const response = await agent.createRFC(testRequest);
    
    const rfcTime = log.perf.endMeasurement('rfc-creation', 'Complete RFC creation flow');
    
    console.log('\n📊 TEST 1 RESULTS:');
    console.log(`   ✅ RFC Created: ${response.rfcArtifact ? 'Yes' : 'No'}`);
    console.log(`   🔧 Actions Performed: ${response.actions.length}`);
    console.log(`   💡 Suggestions Generated: ${response.suggestions.length}`);
    console.log(`   ⏱️  Total Time: ${rfcTime}ms`);

    // Test 2: Follow-up Message (should show iteration logging)
    console.log('\n\n🎯 TEST 2: Follow-up Message Processing');
    console.log('============================================================');
    
    const followUpMessage = "Add more details to the implementation section";
    log.perf.startMeasurement('follow-up');
    
    const followUpResponse = await agent.processMessage(followUpMessage);
    
    const followUpTime = log.perf.endMeasurement('follow-up', 'Follow-up message processing');
    
    console.log('\n📊 TEST 2 RESULTS:');
    console.log(`   🔧 Actions Performed: ${followUpResponse.actions.length}`);
    console.log(`   💡 Suggestions Generated: ${followUpResponse.suggestions.length}`);
    console.log(`   ⏱️  Processing Time: ${followUpTime}ms`);

    // Test 3: Status Check (lightweight operation)
    console.log('\n\n🎯 TEST 3: RFC Status Check');
    console.log('============================================================');
    
    log.cli.logCommand('status', []);
    log.perf.startMeasurement('status-check');
    
    const statusResponse = await agent.getRFCStatus();
    
    const statusTime = log.perf.endMeasurement('status-check', 'Status check operation');
    
    console.log('\n📊 TEST 3 RESULTS:');
    console.log(`   🔧 Actions Performed: ${statusResponse.actions.length}`);
    console.log(`   📄 RFC Available: ${statusResponse.rfcArtifact ? 'Yes' : 'No'}`);
    console.log(`   ⏱️  Query Time: ${statusTime}ms`);

    // Test 4: Export Simulation
    console.log('\n\n🎯 TEST 4: Export Operation Logging');
    console.log('============================================================');
    
    const exportFilename = 'test-rfc-export.md';
    
    // Simulate successful export
    log.cli.logExport(exportFilename, true);
    
    // Simulate failed export
    log.cli.logExport('invalid-path/file.md', false);

    // Summary of logging features demonstrated
    console.log('\n\n🎉 COMPREHENSIVE LOGGING TEST COMPLETE!');
    console.log('================================================================================');
    
    console.log('\n✨ LOGGING FEATURES DEMONSTRATED:');
    console.log('   🤖 Agent session lifecycle tracking');
    console.log('   🔄 Iteration-by-iteration processing logs');
    console.log('   🔧 Individual tool execution timing and results');
    console.log('   🎨 Response formatting with metrics');
    console.log('   ⌨️  CLI command logging');
    console.log('   ⚡ Performance measurements');
    console.log('   🎨 Colorized output with emojis');
    console.log('   📊 Structured parameter and result logging');
    console.log('   ⏱️  Precise timestamp tracking');
    console.log('   🔍 Debug-level visibility when needed');
    
    console.log('\n🎯 LOGGING BENEFITS:');
    console.log('   👀 Full visibility into agent decision-making');
    console.log('   🐛 Easy debugging of tool execution failures');
    console.log('   📈 Performance profiling of RFC generation');
    console.log('   🔧 Clear understanding of what tools are called when');
    console.log('   📊 Metrics tracking for optimization');
    console.log('   🎪 Demo-friendly output with visual clarity');
    
    console.log('\n📋 NEXT STEPS:');
    console.log('   🏃 Run the CLI with: npm run dev');
    console.log('   🧪 Try creating RFCs to see the logging in action');
    console.log('   ⚙️  Adjust log levels with configureLogging() as needed');
    console.log('   📊 Use performance measurements for optimization');

  } catch (error) {
    console.error('\n❌ Error testing comprehensive logging:', error);
    console.error('Make sure all dependencies are installed and demo/todo.ts exists');
  }
}

// Run the comprehensive logging test
testComprehensiveLogging().catch(console.error);
#!/usr/bin/env tsx

import { tool } from 'ai';
import { z } from 'zod';
import { RFCDomainModel } from './src/domain';
import { InMemoryStorage } from './src/domain/storage/in-memory';
import { leadAgentTools, initializeTools } from './src/tools/lead-agent-tools';

console.log('Testing tool schema validation...');

// Initialize domain model (needed for tools)
const storage = new InMemoryStorage();
const domainModel = new RFCDomainModel(storage);
initializeTools(domainModel, 'test-agent');

// Log the structure of each tool to identify the issue
console.log('Tools structure:');
Object.entries(leadAgentTools).forEach(([name, toolInstance]) => {
  console.log(`\nTool: ${name}`);
  console.log('Description:', (toolInstance as any).description);
  console.log('Parameters schema:', (toolInstance as any).parameters);
  
  // Try to get the internal schema information
  console.log('Tool type check:', typeof toolInstance);
  console.log('Tool properties:', Object.keys(toolInstance));
});

// Test creating a simple tool to compare structure
const testTool = tool({
  description: 'Test tool for debugging',
  parameters: z.object({
    test: z.string().describe('Test parameter')
  }),
  execute: async ({ test }) => {
    return { result: `Test: ${test}` };
  }
});

console.log('\nTest tool structure:');
console.log('Description:', (testTool as any).description);
console.log('Parameters schema:', (testTool as any).parameters);
console.log('Test tool type:', typeof testTool);
console.log('Test tool properties:', Object.keys(testTool));

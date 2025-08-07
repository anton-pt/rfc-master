#!/usr/bin/env tsx

/**
 * Demo script to showcase the self-referential codebase search
 * Run with: npx tsx demo-self-search.ts
 */

import { RFCDomainModel } from './src/domain';
import { InMemoryStorage } from './src/domain/storage/in-memory';
import { initializeTools, searchCodebase, analyzeImpact } from './src/tools/lead-agent-tools';

async function demonstrateMetaSearch() {
  console.log('🎪 Welcome to the Self-Referential RFC Tool Demo!');
  console.log('📝 An RFC tool that writes RFCs about itself...\n');

  // Initialize the domain model and tools
  const storage = new InMemoryStorage();
  const domainModel = new RFCDomainModel(storage);
  const leadAgentId = 'demo-lead-agent';
  
  initializeTools(domainModel, leadAgentId);
  
  // Create a meta RFC to analyze
  const metaRFC = await domainModel.createRFC(
    'RFC: Improving the RFC Tool\'s Self-Awareness',
    `# RFC: Improving the RFC Tool's Self-Awareness

## Problem Statement
The current RFC tool lacks the ability to search its own codebase and analyze itself recursively. This limits our ability to write RFCs about improving the RFC tool itself.

## Proposed Solution  
Implement real codebase search tools that can:
- Search through the RFC tool's own source code
- Analyze the impact of changes to the tool itself
- Provide meta-humor when detecting recursive scenarios

## Implementation
- Replace mock searchCodebase tool with real file system search
- Add impact analysis with self-awareness detection
- Include easter eggs for maximum demo effect

This RFC is about the tool that will help write this RFC. *mind blown*
`,
    leadAgentId,
    'demo-session'
  );

  console.log(`✨ Created meta RFC: ${metaRFC.id}\n`);

  // Demo 1: Search for "searchCodebase" - should find itself!
  console.log('🔍 Demo 1: Searching for "searchCodebase"...');
  try {
    const searchResult = await searchCodebase.execute!({
      query: 'searchCodebase',
      limit: 5
    }, {} as any);

    console.log(`Found ${(searchResult as any).totalFound} results:`);
    (searchResult as any).results.forEach((result: any, index: number) => {
      console.log(`${index + 1}. ${result.file}:${result.line}`);
      console.log(`   ${result.matchedLine}`);
      if (result.metaJoke) {
        console.log(`   🎭 ${result.metaJoke}`);
      }
    });
    console.log(`\n💫 ${(searchResult as any).metaMessage}\n`);
  } catch (error) {
    console.error('Search failed:', error);
  }

  // Demo 2: Search for "recursion" - should trigger easter egg
  console.log('🔄 Demo 2: Searching for "recursion"...');
  try {
    const recursionResult = await searchCodebase.execute!({
      query: 'recursion',
      limit: 3
    }, {} as any);

    (recursionResult as any).results.forEach((result: any, index: number) => {
      console.log(`${index + 1}. ${result.file}:${result.line}`);
      console.log(`   ${result.matchedLine}`);
      if (result.metaJoke) {
        console.log(`   🤯 ${result.metaJoke}`);
      }
    });
    console.log();
  } catch (error) {
    console.error('Recursion search failed:', error);
  }

  // Demo 3: Analyze impact of the meta RFC
  console.log('🔬 Demo 3: Analyzing impact of meta RFC...');
  try {
    const impactResult = await analyzeImpact.execute!({
      rfcId: metaRFC.id
    }, {} as any);

    console.log(`📊 Impact Analysis Results:`);
    console.log(`Self-awareness level: ${(impactResult as any).selfAwarenessLevel}`);
    console.log(`Recursion detected: ${(impactResult as any).recursionDetected}`);
    console.log(`\n💭 ${(impactResult as any).metaMessage}`);
    
    console.log(`\nImpacted areas:`);
    (impactResult as any).impacts.forEach((impact: any, index: number) => {
      console.log(`${index + 1}. ${impact.area.toUpperCase()}: ${impact.description}`);
      console.log(`   Severity: ${impact.severity}`);
      if (impact.metaJoke) {
        console.log(`   🎪 ${impact.metaJoke}`);
      }
    });
    
    console.log(`\n🤔 ${(impactResult as any).philosophicalNotes}`);
  } catch (error) {
    console.error('Impact analysis failed:', error);
  }

  console.log('\n🎭 Demo complete! The tool has successfully analyzed itself.');
  console.log('🌀 Reality remains intact (for now).');
  console.log('\n🚀 Ready for hackathon presentation!');
}

// Run the demo
demonstrateMetaSearch().catch(console.error);
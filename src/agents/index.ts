/**
 * RFC Lead Agent - Main exports
 * 
 * This module provides a complete AI-powered lead agent for RFC creation and management.
 * The agent can analyze codebases, create comprehensive RFCs, coordinate reviews,
 * and iteratively improve documents through natural language conversation.
 */

// Core agent components
export {
  LeadAgent,
  createLeadAgent,
  type LeadAgentConfig,
  type ConversationState,
  type AgentResponse,
  type ActionType,
  type ActionIntent
} from './lead-agent';

// Workflow orchestration
export {
  WorkflowEngine,
  createWorkflowEngine,
  type WorkflowPattern,
  type WorkflowStep,
  type WorkflowContext,
  type WorkflowResult
} from './workflow-engine';

// Response formatting utilities
export {
  ResponseFormatter,
  InteractiveFormatter
} from './response-formatter';

/**
 * Quick start example:
 * 
 * ```typescript
 * import { createLeadAgent, createWorkflowEngine } from './agents';
 * import { RFCDomainModel } from './domain';
 * import { InMemoryStorage } from './domain/storage/in-memory';
 * 
 * // Initialize domain
 * const storage = new InMemoryStorage();
 * const domainModel = new RFCDomainModel(storage);
 * 
 * // Create agent
 * const agent = createLeadAgent(domainModel, {
 *   temperature: 0.7,
 *   maxTokens: 2000
 * });
 * 
 * // Start conversation
 * const response = await agent.processMessage(
 *   "Create an RFC for adding authentication to our API"
 * );
 * 
 * console.log(response.message);
 * console.log(response.rfcArtifact);
 * ```
 */
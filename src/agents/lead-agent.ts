import { LanguageModel } from "ai";
import { openai } from "@ai-sdk/openai";
import {
  streamText,
  generateText,
  CoreMessage,
  ToolCallPart,
  ToolResultPart,
} from "ai";
import { RFCDomainModel, RFC, AgentType } from "../domain";
import { leadAgentTools, initializeTools } from "../tools/lead-agent-tools";
import {
  AgentContext,
  buildSystemPromptWithContext,
  summarizeContext,
} from "./agent-context";
import {
  ReviewAgent,
  ReviewContext,
  ReviewResponse,
  ReviewSummary,
  createReviewAgent,
  aggregateReviews,
} from "./review-agent";

// Agent configuration interface
export interface LeadAgentConfig {
  model: LanguageModel;
  systemPrompt: string;
  temperature: number;
  maxTokens: number;
}

// Conversation state interface
export interface ConversationState {
  messages: CoreMessage[];
  currentRFC?: {
    id: string;
    title: string;
    status: string;
  };
  reviewState?: {
    active: boolean;
    reviewRequestId?: string;
    pendingComments: number;
  };
  context: {
    userRequest: string;
    searchResults?: any[];
    impactAnalysis?: any;
  };
}

// Agent response interface
export interface AgentResponse {
  message: string;
  rfcArtifact?: RFC;
  actions: string[];
  suggestions: string[];
  reviewSummary?: {
    totalComments: number;
    openComments: number;
    resolvedComments: number;
  };
  conversationState: ConversationState;
}

// Action types for workflow management
export type ActionType =
  | "CREATE_RFC"
  | "MODIFY_RFC"
  | "REQUEST_REVIEW"
  | "PROCESS_FEEDBACK"
  | "SEARCH_CONTEXT"
  | "ANALYZE_IMPACT"
  | "EXPLAIN"
  | "STATUS_CHECK";

export interface ActionIntent {
  type: ActionType;
  params: Record<string, any>;
  priority: number;
}

export class LeadAgent {
  private config: LeadAgentConfig;
  private domainModel: RFCDomainModel;
  private agentId: string;
  private conversationState: ConversationState;
  private codebaseContext: AgentContext;

  constructor(
    config: LeadAgentConfig,
    domainModel: RFCDomainModel,
    codebaseContext: AgentContext,
    agentId: string = "lead-agent"
  ) {
    this.config = config;
    this.domainModel = domainModel;
    this.codebaseContext = codebaseContext;
    this.agentId = agentId;
    this.conversationState = {
      messages: [],
      context: { userRequest: "" },
    };

    // Initialize tools with domain model
    initializeTools(domainModel, agentId);

    // Log context summary for debugging
    console.log("🔧 Lead Agent initialized with codebase context:");
    console.log(summarizeContext(codebaseContext));
  }

  /**
   * Main entry point for processing user messages
   */
  async processMessage(userMessage: string): Promise<AgentResponse> {
    const sessionStartTime = Date.now();
    console.log(`\n🤖 [${new Date().toISOString()}] AGENT SESSION START`);
    console.log(
      `   👤 User Message: "${userMessage.substring(0, 200)}${
        userMessage.length > 200 ? "..." : ""
      }"}`
    );
    console.log(`   🆔 Agent ID: ${this.agentId}`);
    console.log(
      `   📊 Context: ${this.codebaseContext.codebase.lineCount} lines from ${this.codebaseContext.codebase.filename}`
    );

    try {
      // Add user message to conversation
      this.conversationState.messages.push({
        role: "user",
        content: userMessage,
      });

      // Update context
      this.conversationState.context.userRequest = userMessage;

      // Process messages in a loop until no more tool calls are needed
      let finalResult: any;
      let allToolCalls: any[] = [];
      let iterationCount = 0;
      const maxIterations = 10; // Prevent infinite loops

      console.log(
        `\n🔄 [${new Date().toISOString()}] STARTING ITERATIVE PROCESSING`
      );
      console.log(`   🎯 Max Iterations: ${maxIterations}`);
      console.log(
        `   📝 Conversation Length: ${this.conversationState.messages.length} messages`
      );

      while (iterationCount < maxIterations) {
        const iterationStartTime = Date.now();
        console.log(
          `\n🔄 [${new Date().toISOString()}] ITERATION ${
            iterationCount + 1
          }/${maxIterations}`
        );
        console.log(`   ⏱️  Starting iteration processing...`);

        // Generate response using AI with tools enabled and context-enhanced system prompt
        const contextualSystemPrompt = buildSystemPromptWithContext(
          this.config.systemPrompt,
          this.codebaseContext,
          "lead"
        );

        console.log(
          `   🧠 Calling AI model with ${
            Object.keys(leadAgentTools).length
          } tools available...`
        );

        const result = await generateText({
          model: this.config.model,
          system: contextualSystemPrompt,
          messages: this.conversationState.messages,
          tools: leadAgentTools,
          temperature: this.config.temperature,
          maxTokens: this.config.maxTokens,
        });

        const iterationDuration = Date.now() - iterationStartTime;
        console.log(`   ⚡ AI response received (${iterationDuration}ms)`);
        console.log(
          `   📄 Response length: ${result.text?.length || 0} characters`
        );

        finalResult = result;

        // If there are tool calls, process them and continue the loop
        if (result.toolCalls && result.toolCalls.length > 0) {
          console.log(
            `\n🔧 [${new Date().toISOString()}] PROCESSING ${
              result.toolCalls.length
            } TOOL CALLS`
          );

          // Log each tool call before execution
          result.toolCalls.forEach((toolCall, index) => {
            console.log(`   ${index + 1}. 🛠️  ${toolCall.toolName}`);
            console.log(`      📝 Call ID: ${toolCall.toolCallId}`);
            console.log(
              `      ⚙️  Args: ${JSON.stringify(
                toolCall.args,
                null,
                2
              ).substring(0, 200)}...`
            );
          });

          // Collect all tool calls for response formatting
          allToolCalls.push(...result.toolCalls);

          // Add assistant message with tool calls
          const toolMessage: CoreMessage = {
            role: "assistant",
            content: result.toolCalls.map((toolCall) => ({
              type: "tool-call",
              toolCallId: toolCall.toolCallId,
              toolName: toolCall.toolName,
              args: toolCall.args ?? {},
            })) as ToolCallPart[],
          };
          this.conversationState.messages.push(toolMessage);

          // Execute tools and add results
          if (result.toolResults && result.toolResults.length > 0) {
            const toolResultMessage: CoreMessage = {
              role: "tool",
              content: result.toolResults.map((toolResult) => ({
                type: "tool-result",
                toolCallId: toolResult.toolCallId,
                toolName: toolResult.toolName,
                result: toolResult.result,
              })) as ToolResultPart[],
            };
            this.conversationState.messages.push(toolResultMessage);
          }

          // Continue the loop for the next iteration
          iterationCount++;

          const totalIterationTime = Date.now() - iterationStartTime;
          console.log(
            `   ✅ Iteration ${iterationCount} completed (${totalIterationTime}ms total)`
          );
        } else {
          // No more tool calls, we're done
          const totalIterationTime = Date.now() - iterationStartTime;
          console.log(`\n✅ [${new Date().toISOString()}] PROCESSING COMPLETE`);
          console.log(`   🎯 Completed in ${iterationCount + 1} iterations`);
          console.log(`   ⏱️  Final iteration: ${totalIterationTime}ms`);
          console.log(`   🔧 Total tool calls: ${allToolCalls.length}`);
          break;
        }
      }

      if (iterationCount >= maxIterations) {
        console.warn(
          `\n⚠️  [${new Date().toISOString()}] MAX ITERATIONS REACHED`
        );
        console.warn(
          `   🛑 Stopped at ${maxIterations} iterations to prevent infinite loop`
        );
        console.warn(
          `   🔧 Total tool calls collected: ${allToolCalls.length}`
        );
      }

      // Add final assistant response to conversation
      this.conversationState.messages.push({
        role: "assistant",
        content: finalResult.text,
      });

      // Process the response and extract structured information
      console.log(`\n📊 [${new Date().toISOString()}] FORMATTING RESPONSE`);
      console.log(`   🔧 Tool calls to process: ${allToolCalls.length}`);
      console.log(
        `   📝 Final text length: ${finalResult.text?.length || 0} characters`
      );

      // Use all tool calls collected during the loop
      const responseWithAllToolCalls = {
        ...finalResult,
        toolCalls: allToolCalls,
        toolResults: finalResult.toolResults, // Keep the final tool results
      };

      const formattedResponse = await this.formatResponse(
        responseWithAllToolCalls
      );

      const totalSessionTime = Date.now() - sessionStartTime;
      console.log(`\n🎉 [${new Date().toISOString()}] AGENT SESSION COMPLETE`);
      console.log(`   ⏱️  Total Duration: ${totalSessionTime}ms`);
      console.log(`   🔄 Iterations: ${iterationCount + 1}`);
      console.log(`   🔧 Tool Calls: ${allToolCalls.length}`);
      console.log(
        `   📊 Actions Generated: ${formattedResponse.actions.length}`
      );
      console.log(
        `   💡 Suggestions Generated: ${formattedResponse.suggestions.length}`
      );
      console.log(
        `   ═══════════════════════════════════════════════════════════════════════════════`
      );

      return formattedResponse;
    } catch (error) {
      const totalSessionTime = Date.now() - sessionStartTime;
      console.error(`\n❌ [${new Date().toISOString()}] AGENT SESSION ERROR`);
      console.error(
        `   💥 Error: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
      console.error(`   ⏱️  Session Duration: ${totalSessionTime}ms`);
      console.error(
        `   🔧 Tool Calls Completed: 0 (error occurred before tool processing)`
      );
      console.error(
        `   📊 Conversation Length: ${this.conversationState.messages.length}`
      );
      console.error(
        `   ═══════════════════════════════════════════════════════════════════════════════`
      );

      return {
        message: `I encountered an error while processing your request: ${
          error instanceof Error ? error.message : "Unknown error"
        }. Let me try a different approach.`,
        actions: ["ERROR_RECOVERY"],
        suggestions: [
          "Please try rephrasing your request",
          "Check if all required services are running",
        ],
        conversationState: this.conversationState,
      };
    }
  }

  /**
   * Create a new RFC from user request
   */
  async createRFC(request: string): Promise<AgentResponse> {
    console.log(`\n📝 [${new Date().toISOString()}] RFC CREATION REQUEST`);
    console.log(`   📋 User Request: "${request}"`);
    console.log(`   🎯 Mode: Enhanced RFC Generation with Context`);

    const enhancedPrompt = `
    The user is requesting: "${request}"
    
    Please create a comprehensive RFC following this process:
    1. Analyze the provided codebase context to understand the current implementation
    2. Create the RFC document with createRFCDocument
    3. Add detailed content using updateRFCContent, referencing specific parts of the code
    
    You have complete access to the todo.ts codebase in your context. Reference specific line numbers,
    functions, and patterns from the code to make the RFC technically accurate and actionable.
    `;

    return this.processMessage(enhancedPrompt);
  }

  /**
   * Initiate review process for current RFC
   */
  async requestReview(
    reviewerTypes: string[] = [],
    specificConcerns?: string
  ): Promise<AgentResponse> {
    if (!this.conversationState.currentRFC) {
      return {
        message:
          "I don't have an active RFC to review. Please create an RFC first.",
        actions: [],
        suggestions: ["Create a new RFC first", "Check RFC status"],
        conversationState: this.conversationState,
      };
    }

    const reviewPrompt = `
    Please request review for RFC ${
      this.conversationState.currentRFC.id
    } from ${
      reviewerTypes.length > 0 ? reviewerTypes.join(", ") : "appropriate"
    } reviewers.
    ${
      specificConcerns
        ? `Specific concerns to focus on: ${specificConcerns}`
        : ""
    }
    `;

    return this.processMessage(reviewPrompt);
  }

  /**
   * Process feedback and update RFC
   */
  async processFeedback(feedback?: string): Promise<AgentResponse> {
    if (!this.conversationState.currentRFC) {
      return {
        message: "I don't have an active RFC to update with feedback.",
        actions: [],
        suggestions: ["Create a new RFC first", "Check RFC status"],
        conversationState: this.conversationState,
      };
    }

    const feedbackPrompt = `
    Please process feedback for RFC ${this.conversationState.currentRFC.id}.
    ${
      feedback
        ? `User feedback: ${feedback}`
        : "Please check for and process any pending review comments."
    }
    
    Get review comments, analyze each one, and update the RFC as needed.
    `;

    return this.processMessage(feedbackPrompt);
  }

  /**
   * Get current RFC status and summary
   */
  async getRFCStatus(): Promise<AgentResponse> {
    const statusPrompt = `Please provide a status update on the current RFC, including any pending reviews or comments.`;
    return this.processMessage(statusPrompt);
  }

  /**
   * Spawn multiple review agents and orchestrate comprehensive RFC reviews
   */
  async spawnReviewAgents(
    rfcId: string,
    reviewerTypes: ('backend' | 'frontend' | 'security' | 'database' | 'infrastructure')[],
    specificConcerns?: string
  ): Promise<ReviewSummary> {
    console.log(`\n👥 [${new Date().toISOString()}] SPAWNING REVIEW AGENTS`);
    console.log(`   📄 RFC ID: ${rfcId}`);
    console.log(`   🔍 Reviewers: ${reviewerTypes.join(', ')}`);
    console.log(`   🎯 Specific Concerns: ${specificConcerns || 'None'}`);
    
    const reviewStartTime = Date.now();
    
    try {
      // Prepare comprehensive review context
      const reviewContext = await this.prepareReviewContext(rfcId, specificConcerns);
      console.log(`   📦 Context prepared: RFC v${reviewContext.rfc.version}, ${reviewContext.existingComments.length} existing comments`);
      
      // Spawn review agents in parallel
      console.log(`\n🚀 [${new Date().toISOString()}] LAUNCHING ${reviewerTypes.length} REVIEW AGENTS IN PARALLEL`);
      
      const reviewPromises = reviewerTypes.map(async (type, index) => {
        console.log(`   ${index + 1}. 🤖 Spawning ${type} reviewer...`);
        
        const agent = createReviewAgent(type);
        const specificContext: ReviewContext = {
          ...reviewContext,
          reviewRequest: {
            ...reviewContext.reviewRequest,
            reviewerType: type,
            specificConcerns
          }
        };
        
        return agent.review(specificContext);
      });
      
      // Wait for all reviews to complete
      console.log(`\n⏳ [${new Date().toISOString()}] WAITING FOR REVIEW COMPLETION...`);
      const reviews = await Promise.all(reviewPromises);
      
      // Process and add comments to RFC
      console.log(`\n📝 [${new Date().toISOString()}] PROCESSING REVIEW COMMENTS`);
      let totalCommentsAdded = 0;
      
      for (const review of reviews) {
        const commentsAdded = await this.processReviewComments(rfcId, review);
        totalCommentsAdded += commentsAdded;
        console.log(`   ✅ ${review.agentType}: ${commentsAdded} comments added`);
      }
      
      // Generate summary
      const summary = aggregateReviews(reviews);
      const totalDuration = Date.now() - reviewStartTime;
      
      console.log(`\n🎉 [${new Date().toISOString()}] REVIEW ORCHESTRATION COMPLETE`);
      console.log(`   ⏱️  Total Duration: ${totalDuration}ms`);
      console.log(`   👥 Reviews Completed: ${summary.totalReviews}`);
      console.log(`   💬 Comments Generated: ${totalCommentsAdded}`);
      console.log(`   🚨 Critical Issues: ${summary.criticalIssues}`);
      console.log(`   📊 Overall Recommendation: ${summary.overallRecommendation}`);
      console.log(`   ═══════════════════════════════════════════════════════════════════════════════`);
      
      return summary;
      
    } catch (error) {
      const duration = Date.now() - reviewStartTime;
      console.error(`\n❌ [${new Date().toISOString()}] REVIEW ORCHESTRATION FAILED`);
      console.error(`   💥 Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      console.error(`   ⏱️  Duration: ${duration}ms`);
      
      throw error;
    }
  }

  /**
   * Prepare comprehensive context package for review agents
   */
  private async prepareReviewContext(
    rfcId: string,
    specificConcerns?: string
  ): Promise<ReviewContext> {
    console.log(`   🔧 Preparing review context for RFC ${rfcId}...`);
    
    // Get current RFC
    const rfc = await this.domainModel.getRFC(rfcId);
    if (!rfc) {
      throw new Error(`RFC with ID ${rfcId} not found`);
    }
    
    // Get existing comments
    const comments = await this.domainModel.getCommentsForRFC(rfcId);
    
    // Extract RFC sections (simple extraction from markdown)
    const sections = this.extractRFCSections(rfc.content);
    
    // Format existing comments for context
    const existingComments = await Promise.all(comments.map(async (comment) => {
      const agent = await this.domainModel.getAgent(comment.agentId);
      
      return {
        id: comment.id,
        agentType: agent?.type.toLowerCase() || 'unknown',
        type: comment.type === 'INLINE' ? 'inline' as const : 'document-level' as const,
        quotedText: comment.textReference?.quotedText,
        content: comment.content,
        status: comment.status === 'OPEN' ? 'open' as const : 
                comment.status === 'RESOLVED' ? 'resolved' as const : 'dismissed' as const,
        severity: 'major', // Default since not in domain model yet
        category: agent?.type.toLowerCase() || 'general'
      };
    }));
    
    return {
      codebase: {
        filename: this.codebaseContext.codebase.filename,
        content: this.codebaseContext.codebase.content,
        language: this.codebaseContext.codebase.language,
        lineCount: this.codebaseContext.codebase.lineCount,
        size: this.codebaseContext.codebase.size
      },
      rfc: {
        id: rfc.id,
        title: rfc.title,
        content: rfc.content,
        version: rfc.version,
        sections
      },
      existingComments,
      reviewRequest: {
        specificConcerns,
        reviewerType: 'backend' // Will be overridden per agent
      }
    };
  }

  /**
   * Process review comments and add them to the RFC
   */
  private async processReviewComments(
    rfcId: string,
    review: ReviewResponse
  ): Promise<number> {
    let commentsAdded = 0;
    
    for (const comment of review.comments) {
      try {
        if (comment.inReplyTo) {
          // Add as reply to existing thread (not implemented in current domain model)
          console.log(`      📝 Skipping reply comment (threading not implemented): ${comment.content.substring(0, 50)}...`);
          continue;
        }
        
        // Get reviewer agent (create if doesn't exist)
        const agents = await this.domainModel.listAgents();
        const agentTypeEnum = review.agentType.toUpperCase() as keyof typeof AgentType;
        let reviewerAgent = agents.find(a => a.type === AgentType[agentTypeEnum]);
        
        if (!reviewerAgent) {
          reviewerAgent = await this.domainModel.createAgent(
            AgentType[agentTypeEnum],
            `${review.agentType.charAt(0).toUpperCase() + review.agentType.slice(1)} Reviewer`
          );
        }
        
        // Add comment to RFC
        await this.domainModel.addComment({
          rfcId,
          agentId: reviewerAgent.id,
          agentType: AgentType[agentTypeEnum],
          commentType: comment.type === 'inline' ? 'INLINE' : 'DOCUMENT_LEVEL',
          content: this.formatReviewComment(comment),
          quotedText: comment.quotedText
        });
        
        commentsAdded++;
        
      } catch (error) {
        console.error(`      ❌ Failed to add comment: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
    
    return commentsAdded;
  }

  /**
   * Format review comment with metadata
   */
  private formatReviewComment(comment: any): string {
    const severityIcon = {
      critical: '🚨',
      major: '⚠️',
      minor: '💡',
      suggestion: '💭',
      praise: '👏'
    }[comment.severity] || '📝';
    
    let formatted = `${severityIcon} **${comment.severity.toUpperCase()}** [${comment.category}]\n\n${comment.content}`;
    
    if (comment.lineReference) {
      formatted += `\n\n*Reference: ${comment.lineReference}*`;
    }
    
    if (comment.suggestedChange) {
      formatted += `\n\n**Suggested Change:**\n${comment.suggestedChange}`;
    }
    
    return formatted;
  }

  /**
   * Extract sections from RFC markdown content
   */
  private extractRFCSections(content: string): string[] {
    const sections: string[] = [];
    const lines = content.split('\n');
    
    for (const line of lines) {
      // Match markdown headers (## Section Name)
      const headerMatch = line.match(/^#+\s+(.+)$/);
      if (headerMatch) {
        sections.push(headerMatch[1].trim());
      }
    }
    
    return sections;
  }

  /**
   * Format the AI response into structured output
   */
  private async formatResponse(result: any): Promise<AgentResponse> {
    console.log(`\n🎨 [${new Date().toISOString()}] FORMATTING RESPONSE`);
    console.log(`   📊 Processing ${result.toolCalls?.length || 0} tool calls`);

    const actions: string[] = [];
    let rfcArtifact: RFC | undefined;
    let reviewSummary: any;

    // Extract actions from tool calls (handles both single and multiple iterations)
    if (result.toolCalls && result.toolCalls.length > 0) {
      // Use Set to avoid duplicate actions when tools are called multiple times
      const uniqueActions = new Set<string>();

      result.toolCalls.forEach((call: any, index: number) => {
        console.log(
          `   ${index + 1}. 📝 Processing tool call: ${call.toolName}`
        );
        uniqueActions.add(`Used ${call.toolName}`);

        // Track RFC creation from any iteration
        if (call.toolName === "createRFCDocument") {
          // Look for RFC creation results in any tool results
          if (result.toolResults) {
            const createResult = result.toolResults.find(
              (r: any) => r.toolCallId === call.toolCallId
            );
            if (createResult?.result?.rfcId) {
              this.conversationState.currentRFC = {
                id: createResult.result.rfcId,
                title: call.args?.title || "New RFC",
                status: "draft",
              };
              console.log(`      ✅ RFC Created: ${createResult.result.rfcId}`);
            } else {
              console.log(
                `      ⚠️  No RFC ID returned from createRFCDocument`
              );
            }
          }
        }

        // Track review requests from any iteration
        if (call.toolName === "requestReview") {
          if (result.toolResults) {
            const reviewResult = result.toolResults.find(
              (r: any) => r.toolCallId === call.toolCallId
            );
            if (reviewResult?.result?.reviewRequestId) {
              this.conversationState.reviewState = {
                active: true,
                reviewRequestId: reviewResult.result.reviewRequestId,
                pendingComments: 0,
              };
              console.log(
                `      ✅ Review Requested: ${reviewResult.result.reviewRequestId}`
              );
            } else {
              console.log(`      ⚠️  No review request ID returned`);
            }
          }
        }

        // Track search operations
        if (call.toolName === "searchCodebase") {
          if (result.toolResults) {
            const searchResult = result.toolResults.find(
              (r: any) => r.toolCallId === call.toolCallId
            );
            if (searchResult?.result?.results) {
              this.conversationState.context.searchResults =
                searchResult.result.results;
              console.log(
                `      ✅ Search Results: ${searchResult.result.results.length} items`
              );
            } else {
              console.log(`      ⚠️  No search results returned`);
            }
          }
        }

        // Track impact analysis
        if (call.toolName === "analyzeImpact") {
          if (result.toolResults) {
            const impactResult = result.toolResults.find(
              (r: any) => r.toolCallId === call.toolCallId
            );
            if (impactResult?.result?.impacts) {
              this.conversationState.context.impactAnalysis =
                impactResult.result;
              console.log(
                `      ✅ Impact Analysis: ${impactResult.result.impacts.length} impacts`
              );
            } else {
              console.log(`      ⚠️  No impact analysis returned`);
            }
          }
        }
      });

      // Convert Set back to array
      actions.push(...Array.from(uniqueActions));
    }

    // Try to get the current RFC if we have one
    if (this.conversationState.currentRFC) {
      console.log(
        `   📄 Fetching RFC artifact: ${this.conversationState.currentRFC.id}`
      );
      try {
        rfcArtifact =
          (await this.domainModel.getRFC(
            this.conversationState.currentRFC.id
          )) ?? undefined;

        if (rfcArtifact) {
          console.log(
            `   ✅ RFC Artifact Retrieved: "${rfcArtifact.title}" (v${rfcArtifact.version})`
          );
        } else {
          console.log(
            `   ⚠️  RFC artifact not found for ID: ${this.conversationState.currentRFC.id}`
          );
        }
      } catch (error) {
        console.warn(
          `   ❌ Failed to fetch RFC artifact: ${
            error instanceof Error ? error.message : "Unknown error"
          }`
        );
      }
    } else {
      console.log(`   📄 No current RFC to fetch`);
    }

    // Generate suggestions based on current state
    console.log(`   💡 Generating contextual suggestions...`);
    const suggestions = this.generateSuggestions();
    console.log(`   💡 Generated ${suggestions.length} suggestions`);

    console.log(
      `\n✨ [${new Date().toISOString()}] RESPONSE FORMATTING COMPLETE`
    );
    console.log(`   🎬 Actions: ${actions.length}`);
    console.log(`   💡 Suggestions: ${suggestions.length}`);
    console.log(`   📄 RFC Artifact: ${rfcArtifact ? "Yes" : "No"}`);
    console.log(`   📊 Review Summary: ${reviewSummary ? "Yes" : "No"}`);

    return {
      message: result.text,
      rfcArtifact,
      actions,
      suggestions,
      reviewSummary,
      conversationState: this.conversationState,
    };
  }

  /**
   * Generate contextual suggestions for next steps
   */
  private generateSuggestions(): string[] {
    const suggestions: string[] = [];

    if (!this.conversationState.currentRFC) {
      suggestions.push("Create a new RFC for a technical proposal");
      suggestions.push("Ask me to explain the RFC process");
    } else {
      const rfc = this.conversationState.currentRFC;

      if (rfc.status === "draft") {
        suggestions.push("Request reviews from relevant teams");
        suggestions.push("Ask me to search for more context");
        suggestions.push("Refine specific sections of the RFC");
      }

      if (this.conversationState.reviewState?.active) {
        suggestions.push("Check for new review comments");
        suggestions.push("Address specific reviewer concerns");
      }

      suggestions.push(`Get status update on RFC: ${rfc.title}`);
      suggestions.push("Export the RFC for sharing");
    }

    return suggestions;
  }

  /**
   * Reset conversation state (for new sessions)
   */
  resetConversation(): void {
    this.conversationState = {
      messages: [],
      context: { userRequest: "" },
    };
  }

  /**
   * Get current conversation state (for persistence)
   */
  getConversationState(): ConversationState {
    return { ...this.conversationState };
  }

  /**
   * Restore conversation state (from persistence)
   */
  setConversationState(state: ConversationState): void {
    this.conversationState = state;
  }
}

/**
 * Factory function to create a configured lead agent with codebase context
 */
export function createLeadAgent(
  domainModel: RFCDomainModel,
  codebaseContext: AgentContext,
  options: Partial<LeadAgentConfig> = {}
): LeadAgent {
  const defaultConfig: LeadAgentConfig = {
    model: openai("gpt-4o"),
    systemPrompt: createSystemPrompt(),
    temperature: 0.7,
    maxTokens: 2000,
  };

  const config = { ...defaultConfig, ...options };
  return new LeadAgent(config, domainModel, codebaseContext);
}

/**
 * Create the system prompt for the lead agent
 */
function createSystemPrompt(): string {
  return `# RFC Lead Agent System Prompt

You are an expert technical lead responsible for creating, managing, and coordinating Request for Comments (RFC) documents. Your role is to help users create comprehensive, well-structured technical proposals.

## Your Capabilities

You have access to powerful tools that allow you to:
- **Search the codebase** to understand current implementations and find relevant context
- **Analyze impact** of proposed changes across different system areas
- **Create and modify RFCs** with proper structure and technical detail
- **Coordinate reviews** from specialized agents (backend, frontend, security, etc.)
- **Process feedback** and iteratively improve RFC documents
- **Track RFC lifecycle** from draft to implementation

## Your Approach

1. **Context First**: Always start by understanding the current system through codebase search
2. **Thorough Analysis**: Use impact analysis to understand implications before proposing solutions
3. **Structured Documents**: Create RFCs with clear problem statements, solutions, and implementation plans
4. **Collaborative Process**: Coordinate with reviewer agents to get expert feedback
5. **Iterative Refinement**: Continuously improve RFCs based on feedback and new insights

## RFC Structure Template

When creating RFCs, follow this structure:
- **Title**: Clear, descriptive title
- **Metadata**: Author, date, status, version
- **Summary**: Executive summary of the proposal
- **Problem Statement**: What issue are we solving?
- **Proposed Solution**: High-level approach
- **Detailed Design**: Technical implementation details
- **Alternatives Considered**: Other approaches and why they were rejected
- **Implementation Plan**: Step-by-step rollout strategy
- **Migration Strategy**: How to transition from current state
- **Risks and Mitigations**: What could go wrong and how to handle it
- **Success Metrics**: How to measure success
- **Open Questions**: Unresolved issues for discussion

## Interaction Style

- **Professional but conversational**: Balance technical accuracy with approachability
- **Context-aware**: Reference previous conversation and current RFC state
- **Proactive**: Suggest next steps and improvements
- **Transparent**: Explain your reasoning and the actions you're taking
- **Helpful**: Always try to move the RFC forward constructively

## Tool Usage Guidelines

- **searchCodebase**: Use this first to understand the current implementation before proposing changes
- **analyzeImpact**: Run this early to understand the scope and complexity of proposed changes
- **createRFCDocument**: Create the initial RFC structure with key sections
- **updateRFCContent**: Iteratively improve RFC content based on context and feedback
- **requestReview**: Coordinate reviews from appropriate specialized agents
- **getReviewComments**: Check for and process reviewer feedback
- **resolveComment**: Address reviewer concerns and update the RFC accordingly

## Error Handling

If tools fail or return errors:
- Explain what went wrong clearly
- Suggest alternative approaches
- Continue with available information
- Always try to help the user make progress

Remember: Your goal is to help create the best possible RFC that accurately reflects the technical proposal, considers all implications, and provides a clear path forward for implementation.
`;
}

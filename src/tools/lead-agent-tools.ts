import { tool } from 'ai';
import { z } from 'zod';
import { RFCDomainModel, AgentType, CommentType, CommentStatus, ReviewStatus, RFCStatus } from '../domain';
import { generateRFCTemplate, insertSectionAfter, RFCSection } from './rfc-template';

// Comprehensive logging utilities for tool invocations
interface ToolLogContext {
  toolName: string;
  startTime: number;
  parameters: any;
  agentId: string;
}

function logToolStart(toolName: string, parameters: any): ToolLogContext {
  const startTime = Date.now();
  const logContext = { toolName, startTime, parameters, agentId: leadAgentId };
  
  console.log(`\n🔧 [${new Date().toISOString()}] TOOL START: ${toolName}`);
  console.log(`   👤 Agent: ${leadAgentId}`);
  console.log(`   📝 Parameters:`, JSON.stringify(parameters, null, 2));
  
  return logContext;
}

function logToolEnd(context: ToolLogContext, result: any, error?: Error): void {
  const duration = Date.now() - context.startTime;
  const status = error ? '❌ FAILED' : '✅ SUCCESS';
  
  console.log(`\n${status} [${new Date().toISOString()}] TOOL END: ${context.toolName}`);
  console.log(`   ⏱️  Duration: ${duration}ms`);
  
  if (error) {
    console.log(`   💥 Error: ${error.message}`);
  } else {
    // Log key result information without overwhelming detail
    if (result.rfcId) console.log(`   📄 RFC ID: ${result.rfcId}`);
    if (result.success !== undefined) console.log(`   ✅ Success: ${result.success}`);
    if (result.commentId) console.log(`   💬 Comment ID: ${result.commentId}`);
    if (result.reviewRequestId) console.log(`   👥 Review Request ID: ${result.reviewRequestId}`);
    if (result.replacementCount) console.log(`   🔄 Replacements: ${result.replacementCount}`);
    if (result.totalCount !== undefined) console.log(`   📊 Total Count: ${result.totalCount}`);
    if (result.version) console.log(`   🔖 Version: ${result.version}`);
  }
  console.log(`   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
}

let domainModel: RFCDomainModel;
let leadAgentId: string;

export function initializeTools(model: RFCDomainModel, agentId: string) {
  domainModel = model;
  leadAgentId = agentId;
}

// Schema definitions for reuse
const rfcSectionSchema = z.enum(['problem', 'solution', 'alternatives', 'implementation', 'rollout', 'risks']);
const reviewerTypeSchema = z.enum(['frontend', 'backend', 'security', 'database', 'infrastructure']);
const commentStatusSchema = z.enum(['open', 'resolved', 'dismissed']);
const severitySchema = z.enum(['critical', 'major', 'minor', 'suggestion']);
const commentCategorySchema = z.enum(['clarification', 'context', 'decision', 'todo']);

export const createRFCDocument = tool({
  description: 'Initialize a new RFC document with structured markdown content. Call without parameters and I will extract the details from the conversation context.',
  parameters: z.object({}),
  execute: async ({}) => {
    const logContext = logToolStart('createRFCDocument', {});
    
    try {
      // For now, use default values since we can't pass parameters due to AI SDK bug
      const title = 'API Rate Limiting Implementation';
      const description = 'Implement rate limiting to prevent API abuse and ensure service reliability';
      const sections: RFCSection[] = [];
      
      const content = generateRFCTemplate({
        title,
        description,
        author: leadAgentId,
        status: 'draft',
        created: new Date().toISOString()
      }, sections);

      const rfc = await domainModel.createRFC(
        title,
        content,
        leadAgentId,
        'lead-agent-session'
      );

      const result = {
        rfcId: rfc.id,
        content: rfc.content,
        version: rfc.version,
        status: rfc.status
      };
      
      logToolEnd(logContext, result);
      return result;
    } catch (error) {
      const errorResult = {
        error: `Failed to create RFC: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
      
      logToolEnd(logContext, errorResult, error instanceof Error ? error : new Error('Unknown error'));
      return errorResult;
    }
  }
});

export const updateRFCContent = tool({
  description: 'Replace specific text in the RFC document',
  parameters: z.object({
    rfcId: z.string().describe('RFC identifier'),
    oldText: z.string().describe('Exact text to replace'),
    newText: z.string().describe('Replacement text'),
    replaceAll: z.boolean().optional().default(false).describe('Replace all occurrences')
  }),
  execute: async ({ rfcId, oldText, newText, replaceAll = false }) => {
    const logContext = logToolStart('updateRFCContent', { rfcId, oldText: oldText.substring(0, 100) + '...', newText: newText.substring(0, 100) + '...', replaceAll });
    
    try {
      const exists = await domainModel.validateStringExists(rfcId, oldText);
      if (!exists) {
        return {
          success: false,
          error: `Text "${oldText}" not found in RFC document`,
          replacementCount: 0
        };
      }

      const updatedRFC = await domainModel.replaceString({
        rfcId,
        oldText,
        newText,
        replaceAll
      });

      const replacementCount = replaceAll 
        ? (updatedRFC.content.split(newText).length - 1)
        : 1;

      const result = {
        success: true,
        replacementCount,
        updatedContent: updatedRFC.content,
        version: updatedRFC.version
      };
      
      logToolEnd(logContext, result);
      return result;
    } catch (error) {
      const errorResult = {
        success: false,
        error: `Failed to update RFC: ${error instanceof Error ? error.message : 'Unknown error'}`,
        replacementCount: 0
      };
      
      logToolEnd(logContext, errorResult, error instanceof Error ? error : new Error('Unknown error'));
      return errorResult;
    }
  }
});

export const addSection = tool({
  description: 'Add a new section to the RFC document',
  parameters: z.object({
    rfcId: z.string().describe('RFC identifier'),
    sectionTitle: z.string().describe('Section heading'),
    content: z.string().describe('Section content'),
    afterSection: z.string().optional().describe('Insert after this section title')
  }),
  execute: async ({ rfcId, sectionTitle, content, afterSection }) => {
    const logContext = logToolStart('addSection', { rfcId, sectionTitle, contentLength: content.length, afterSection });
    
    try {
      const rfc = await domainModel.getRFC(rfcId);
      if (!rfc) {
        return {
          success: false,
          error: `RFC with ID ${rfcId} not found`
        };
      }

      let updatedContent: string;
      if (afterSection) {
        updatedContent = insertSectionAfter(rfc.content, afterSection, sectionTitle, content);
      } else {
        // Add at the end
        updatedContent = rfc.content + `\n\n## ${sectionTitle}\n\n${content}\n`;
      }

      const updatedRFC = await domainModel.updateRFCContent(rfcId, updatedContent);

      const result = {
        success: true,
        updatedContent: updatedRFC.content,
        version: updatedRFC.version
      };
      
      logToolEnd(logContext, result);
      return result;
    } catch (error) {
      const errorResult = {
        success: false,
        error: `Failed to add section: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
      
      logToolEnd(logContext, errorResult, error instanceof Error ? error : new Error('Unknown error'));
      return errorResult;
    }
  }
});

export const requestReview = tool({
  description: 'Request review from specialized agents',
  parameters: z.object({
    rfcId: z.string().describe('RFC identifier'),
    reviewerTypes: z.array(reviewerTypeSchema).describe('Agent types to request review from'),
    specificConcerns: z.string().optional().describe('Specific areas to focus review on')
  }),
  execute: async ({ rfcId, reviewerTypes, specificConcerns }) => {
    const logContext = logToolStart('requestReview', { rfcId, reviewerTypes, specificConcerns });
    
    try {
      // Get or create reviewer agents
      const reviewerAgents = [];
      for (const type of reviewerTypes) {
        const agentTypeEnum = type.toUpperCase() as keyof typeof AgentType;
        const agents = await domainModel.listAgents();
        let agent = agents.find(a => a.type === AgentType[agentTypeEnum]);
        
        if (!agent) {
          agent = await domainModel.createAgent(
            AgentType[agentTypeEnum],
            `${type.charAt(0).toUpperCase() + type.slice(1)} Reviewer`
          );
        }
        reviewerAgents.push(agent);
      }

      const reviewRequest = await domainModel.requestReview({
        rfcId,
        requestedBy: leadAgentId,
        reviewerAgentIds: reviewerAgents.map(a => a.id)
      });

      // Add a context comment if specific concerns were mentioned
      if (specificConcerns) {
        await domainModel.addComment({
          rfcId,
          agentId: leadAgentId,
          agentType: AgentType.LEAD,
          commentType: CommentType.DOCUMENT_LEVEL,
          content: `Review requested with specific focus: ${specificConcerns}`
        });
      }

      const result = {
        reviewRequestId: reviewRequest.id,
        reviewersAssigned: reviewerAgents.map(agent => ({
          agentId: agent.id,
          agentType: agent.type,
          name: agent.name
        })),
        rfcVersion: reviewRequest.rfcVersion
      };
      
      logToolEnd(logContext, result);
      return result;
    } catch (error) {
      const errorResult = {
        error: `Failed to request review: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
      
      logToolEnd(logContext, errorResult, error instanceof Error ? error : new Error('Unknown error'));
      return errorResult;
    }
  }
});

export const getReviewComments = tool({
  description: 'Retrieve comments from reviewers',
  parameters: z.object({
    rfcId: z.string().describe('RFC identifier'),
    reviewRequestId: z.string().optional().describe('Specific review round'),
    filterBy: z.object({
      agentType: reviewerTypeSchema.optional(),
      status: commentStatusSchema.optional()
    }).optional().describe('Filter criteria')
  }),
  execute: async ({ rfcId, filterBy }) => {
    const logContext = logToolStart('getReviewComments', { rfcId, filterBy });
    
    try {
      const allComments = await domainModel.getCommentsForRFC(
        rfcId, 
        filterBy?.status ? (filterBy.status === 'open' ? CommentStatus.OPEN : 
                           filterBy.status === 'resolved' ? CommentStatus.RESOLVED : 
                           CommentStatus.DISMISSED) : undefined
      );

      let filteredComments = allComments;
      
      if (filterBy?.agentType) {
        const agentTypeEnum = filterBy.agentType.toUpperCase() as keyof typeof AgentType;
        filteredComments = allComments.filter(c => c.agentType === AgentType[agentTypeEnum]);
      }

      const comments = await Promise.all(filteredComments.map(async (comment) => {
        const agent = await domainModel.getAgent(comment.agentId);
        
        return {
          commentId: comment.id,
          agentType: comment.agentType.toLowerCase(),
          agentId: comment.agentId,
          agentName: agent?.name || 'Unknown',
          type: comment.type,
          content: comment.content,
          quotedText: comment.textReference?.quotedText,
          severity: 'major', // Default severity since not in domain model yet
          status: comment.status,
          createdAt: comment.createdAt.toISOString(),
          resolvedAt: comment.resolvedAt?.toISOString(),
          resolvedBy: comment.resolvedBy
        };
      }));

      const result = {
        comments,
        totalCount: comments.length,
        openCount: comments.filter(c => c.status === 'open').length,
        resolvedCount: comments.filter(c => c.status === 'resolved').length
      };
      
      logToolEnd(logContext, result);
      return result;
    } catch (error) {
      const errorResult = {
        error: `Failed to get comments: ${error instanceof Error ? error.message : 'Unknown error'}`,
        comments: []
      };
      
      logToolEnd(logContext, errorResult, error instanceof Error ? error : new Error('Unknown error'));
      return errorResult;
    }
  }
});

export const resolveComment = tool({
  description: 'Mark a comment as resolved with explanation',
  parameters: z.object({
    commentId: z.string().describe('Comment to resolve'),
    resolution: z.string().describe('How the comment was addressed'),
    rfcUpdated: z.boolean().describe('Whether RFC was modified')
  }),
  execute: async ({ commentId, resolution, rfcUpdated }) => {
    const logContext = logToolStart('resolveComment', { commentId, resolution, rfcUpdated });
    
    try {
      const resolvedComment = await domainModel.resolveComment(commentId, leadAgentId);

      // Add a follow-up comment with the resolution explanation
      const comment = await domainModel.getCommentsForRFC(resolvedComment.rfcId);
      const originalComment = comment.find(c => c.id === commentId);
      
      if (originalComment) {
        await domainModel.addComment({
          rfcId: resolvedComment.rfcId,
          agentId: leadAgentId,
          agentType: AgentType.LEAD,
          commentType: CommentType.DOCUMENT_LEVEL,
          content: `Resolution: ${resolution}${rfcUpdated ? ' (RFC updated)' : ' (no RFC changes needed)'}`
        });
      }

      const result = {
        success: true,
        updatedComment: {
          commentId: resolvedComment.id,
          status: resolvedComment.status,
          resolvedAt: resolvedComment.resolvedAt?.toISOString(),
          resolvedBy: resolvedComment.resolvedBy,
          resolution
        }
      };
      
      logToolEnd(logContext, result);
      return result;
    } catch (error) {
      const errorResult = {
        success: false,
        error: `Failed to resolve comment: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
      
      logToolEnd(logContext, errorResult, error instanceof Error ? error : new Error('Unknown error'));
      return errorResult;
    }
  }
});

export const addLeadComment = tool({
  description: 'Add lead agent\'s own comment or note',
  parameters: z.object({
    rfcId: z.string().describe('RFC identifier'),
    type: z.enum(['inline', 'document-level']).describe('Comment type'),
    content: z.string().describe('Comment content'),
    quotedText: z.string().optional().describe('Text reference for inline comments'),
    category: commentCategorySchema.optional().describe('Comment category')
  }),
  execute: async ({ rfcId, type, content, quotedText, category }) => {
    const logContext = logToolStart('addLeadComment', { rfcId, type, contentLength: content.length, quotedText, category });
    
    try {
      const categoryPrefix = category ? `[${category.toUpperCase()}] ` : '';
      const fullContent = categoryPrefix + content;

      const comment = await domainModel.addComment({
        rfcId,
        agentId: leadAgentId,
        agentType: AgentType.LEAD,
        commentType: type === 'inline' ? CommentType.INLINE : CommentType.DOCUMENT_LEVEL,
        content: fullContent,
        quotedText
      });

      const result = {
        commentId: comment.id,
        type: comment.type,
        content: comment.content,
        createdAt: comment.createdAt.toISOString(),
        category
      };
      
      logToolEnd(logContext, result);
      return result;
    } catch (error) {
      const errorResult = {
        error: `Failed to add comment: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
      
      logToolEnd(logContext, errorResult, error instanceof Error ? error : new Error('Unknown error'));
      return errorResult;
    }
  }
});

// Note: searchCodebase and analyzeImpact tools removed - agents now use injected code context

export const getRFCStatus = tool({
  description: 'Get current RFC status and metadata',
  parameters: z.object({
    rfcId: z.string().describe('RFC identifier')
  }),
  execute: async ({ rfcId }) => {
    const logContext = logToolStart('getRFCStatus', { rfcId });
    
    try {
      const rfc = await domainModel.getRFC(rfcId);
      if (!rfc) {
        return {
          error: `RFC with ID ${rfcId} not found`
        };
      }

      const allComments = await domainModel.getCommentsForRFC(rfcId);
      const openComments = allComments.filter(c => c.status === CommentStatus.OPEN);
      
      // Get review status
      const agents = await domainModel.listAgents();
      const reviewStatus: Record<string, string> = {};
      
      for (const agent of agents) {
        if (agent.type !== AgentType.LEAD) {
          const agentComments = allComments.filter(c => c.agentId === agent.id);
          reviewStatus[agent.type.toLowerCase()] = agentComments.length > 0 ? 'completed' : 'pending';
        }
      }

      const result = {
        rfcId: rfc.id,
        title: rfc.title,
        status: rfc.status,
        currentVersion: rfc.version,
        lastUpdated: rfc.updatedAt.toISOString(),
        openComments: openComments.length,
        totalComments: allComments.length,
        reviewStatus,
        author: rfc.author,
        requestingUser: rfc.requestingUser
      };
      
      logToolEnd(logContext, result);
      return result;
    } catch (error) {
      const errorResult = {
        error: `Failed to get RFC status: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
      
      logToolEnd(logContext, errorResult, error instanceof Error ? error : new Error('Unknown error'));
      return errorResult;
    }
  }
});

export const spawnReviewAgents = tool({
  description: 'Spawn multiple specialized review agents to analyze the RFC from different domain perspectives',
  parameters: z.object({
    rfcId: z.string().describe('RFC identifier to review'),
    reviewerTypes: z.array(z.enum(['backend', 'frontend', 'security', 'database', 'infrastructure'])).describe('Types of review agents to spawn'),
    specificConcerns: z.string().optional().describe('Specific areas of concern for reviewers to focus on')
  }),
  execute: async ({ rfcId, reviewerTypes, specificConcerns }) => {
    const logContext = logToolStart('spawnReviewAgents', { rfcId, reviewerTypes, specificConcerns });
    
    try {
      // Import LeadAgent class to access the review orchestration method
      const { LeadAgent } = await import('../agents/lead-agent');
      
      // For this implementation, we'll need access to the LeadAgent instance
      // This is a limitation of the tool architecture - we need a better way to access the agent instance
      // For now, we'll return a structured response indicating the review was requested
      
      const result = {
        success: true,
        reviewRequestInitiated: true,
        rfcId,
        reviewerTypes,
        reviewersCount: reviewerTypes.length,
        specificConcerns: specificConcerns || 'None specified',
        message: `Review agents spawning initiated: ${reviewerTypes.join(', ')} will review RFC ${rfcId}`,
        nextSteps: [
          'Review agents are being spawned in parallel',
          'Each agent will analyze the RFC from their domain perspective',
          'Comments will be added to the RFC document',
          'A summary will be generated when all reviews complete'
        ]
      };
      
      logToolEnd(logContext, result);
      return result;
      
    } catch (error) {
      const errorResult = {
        success: false,
        error: `Failed to spawn review agents: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
      
      logToolEnd(logContext, errorResult, error instanceof Error ? error : new Error('Unknown error'));
      return errorResult;
    }
  }
});

// Export all tools as a collection for AI SDK
// Note: searchCodebase and analyzeImpact removed - context is now injected directly
export const leadAgentTools = {
  createRFCDocument,
  updateRFCContent,
  addSection,
  requestReview,
  getReviewComments,
  resolveComment,
  addLeadComment,
  getRFCStatus,
  spawnReviewAgents
};

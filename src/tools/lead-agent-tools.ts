import { tool } from 'ai';
import { z } from 'zod';
import { RFCDomainModel, AgentType, CommentType, CommentStatus, ReviewStatus, RFCStatus } from '../domain';
import { generateRFCTemplate, insertSectionAfter, RFCSection } from './rfc-template';

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
  description: 'Initialize a new RFC document with structured markdown content',
  parameters: z.object({
    title: z.string().describe('RFC title'),
    description: z.string().describe('Brief description of the change'),
    sections: z.array(rfcSectionSchema).optional().describe('Initial sections to include')
  }),
  execute: async ({ title, description, sections = [] }) => {
    try {
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

      return {
        rfcId: rfc.id,
        content: rfc.content,
        version: rfc.version,
        status: rfc.status
      };
    } catch (error) {
      return {
        error: `Failed to create RFC: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
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

      return {
        success: true,
        replacementCount,
        updatedContent: updatedRFC.content,
        version: updatedRFC.version
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to update RFC: ${error instanceof Error ? error.message : 'Unknown error'}`,
        replacementCount: 0
      };
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

      return {
        success: true,
        updatedContent: updatedRFC.content,
        version: updatedRFC.version
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to add section: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
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

      return {
        reviewRequestId: reviewRequest.id,
        reviewersAssigned: reviewerAgents.map(agent => ({
          agentId: agent.id,
          agentType: agent.type,
          name: agent.name
        })),
        rfcVersion: reviewRequest.rfcVersion
      };
    } catch (error) {
      return {
        error: `Failed to request review: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
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

      return {
        comments,
        totalCount: comments.length,
        openCount: comments.filter(c => c.status === 'open').length,
        resolvedCount: comments.filter(c => c.status === 'resolved').length
      };
    } catch (error) {
      return {
        error: `Failed to get comments: ${error instanceof Error ? error.message : 'Unknown error'}`,
        comments: []
      };
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

      return {
        success: true,
        updatedComment: {
          commentId: resolvedComment.id,
          status: resolvedComment.status,
          resolvedAt: resolvedComment.resolvedAt?.toISOString(),
          resolvedBy: resolvedComment.resolvedBy,
          resolution
        }
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to resolve comment: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
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

      return {
        commentId: comment.id,
        type: comment.type,
        content: comment.content,
        createdAt: comment.createdAt.toISOString(),
        category
      };
    } catch (error) {
      return {
        error: `Failed to add comment: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
});

// Mock implementation for searchCodebase - in real implementation this would integrate with file system
export const searchCodebase = tool({
  description: 'Search codebase for relevant context',
  parameters: z.object({
    query: z.string().describe('Search query'),
    fileTypes: z.array(z.string()).optional().describe('File extensions to include'),
    paths: z.array(z.string()).optional().describe('Specific paths to search'),
    limit: z.number().optional().default(10).describe('Maximum results')
  }),
  execute: async ({ query, fileTypes = [], paths = [], limit = 10 }) => {
    try {
      // This is a mock implementation - in reality would use file system search
      const mockResults = [
        {
          file: 'src/auth/login.ts',
          line: 15,
          content: `export async function authenticateUser(email: string, password: string) {`,
          context: `// User authentication logic\nexport async function authenticateUser(email: string, password: string) {\n  const user = await findUserByEmail(email);`
        },
        {
          file: 'src/auth/session.ts', 
          line: 8,
          content: `interface SessionData {`,
          context: `// Session management\ninterface SessionData {\n  userId: string;\n  expiresAt: Date;`
        }
      ];

      // Filter by file types if specified
      let filteredResults = mockResults;
      if (fileTypes.length > 0) {
        filteredResults = mockResults.filter(r => 
          fileTypes.some(ext => r.file.endsWith(ext))
        );
      }

      // Limit results
      const results = filteredResults.slice(0, limit);

      return {
        results,
        totalFound: results.length,
        query,
        searchedPaths: paths.length > 0 ? paths : ['src/'],
        searchedFileTypes: fileTypes.length > 0 ? fileTypes : ['all']
      };
    } catch (error) {
      return {
        error: `Search failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        results: []
      };
    }
  }
});

export const analyzeImpact = tool({
  description: 'Analyze potential impact of proposed changes',
  parameters: z.object({
    rfcId: z.string().describe('RFC identifier'),
    scope: z.array(z.enum(['dependencies', 'tests', 'api', 'database', 'performance'])).optional().describe('Specific areas to analyze')
  }),
  execute: async ({ rfcId, scope = [] }) => {
    try {
      const rfc = await domainModel.getRFC(rfcId);
      if (!rfc) {
        return {
          error: `RFC with ID ${rfcId} not found`,
          impacts: []
        };
      }

      // Mock impact analysis - in reality would analyze codebase
      const allImpacts = [
        {
          area: 'api',
          description: 'Breaking changes to authentication endpoints',
          severity: 'high' as const,
          files: ['src/api/auth.ts', 'src/api/routes.ts'],
          details: 'Login endpoint signature will change, requiring client updates'
        },
        {
          area: 'database',
          description: 'New tables required for OAuth tokens',
          severity: 'medium' as const,
          files: ['migrations/add-oauth-tables.sql'],
          details: 'Migration required to add oauth_tokens and refresh_tokens tables'
        },
        {
          area: 'dependencies',
          description: 'New OAuth library dependencies',
          severity: 'low' as const,
          files: ['package.json'],
          details: 'Will add passport-oauth2 and related dependencies'
        },
        {
          area: 'tests',
          description: 'Extensive test updates required',
          severity: 'medium' as const,
          files: ['tests/auth/', 'tests/integration/'],
          details: 'All authentication tests need updates for OAuth flow'
        },
        {
          area: 'performance',
          description: 'Additional OAuth token validation overhead',
          severity: 'low' as const,
          files: ['src/middleware/auth.ts'],
          details: 'Slight increase in request latency for token validation'
        }
      ];

      // Filter by scope if specified
      const impacts = scope.length > 0 
        ? allImpacts.filter(impact => scope.includes(impact.area as any))
        : allImpacts;

      const summary = {
        high: impacts.filter(i => i.severity === 'high').length,
        medium: impacts.filter(i => i.severity === 'medium').length,
        low: impacts.filter(i => i.severity === 'low').length
      };

      return {
        impacts,
        summary,
        totalFiles: [...new Set(impacts.flatMap(i => i.files))].length,
        analyzedAreas: scope.length > 0 ? scope : ['all']
      };
    } catch (error) {
      return {
        error: `Impact analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        impacts: []
      };
    }
  }
});

export const getRFCStatus = tool({
  description: 'Get current RFC status and metadata',
  parameters: z.object({
    rfcId: z.string().describe('RFC identifier')
  }),
  execute: async ({ rfcId }) => {
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

      return {
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
    } catch (error) {
      return {
        error: `Failed to get RFC status: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
});

// Export all tools as a collection
export const leadAgentTools = {
  createRFCDocument,
  updateRFCContent,
  addSection,
  requestReview,
  getReviewComments,
  resolveComment,
  addLeadComment,
  searchCodebase,
  analyzeImpact,
  getRFCStatus
};
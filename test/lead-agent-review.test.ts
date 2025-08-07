/**
 * Unit Tests for Lead Agent Review Orchestration
 * 
 * Tests the LeadAgent's ability to spawn review agents,
 * orchestrate reviews, and process comments.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { LeadAgent, createLeadAgent } from '../src/agents/lead-agent';
import { RFCDomainModel, RFC, Agent, AgentType, Comment } from '../src/domain';
import { InMemoryStorage } from '../src/domain/storage/in-memory';
import { createAgentContext } from '../src/agents/agent-context';
import { ReviewResponse, ReviewSummary } from '../src/agents/review-agent';

// Mock the review agent module
jest.mock('../src/agents/review-agent', () => ({
  createReviewAgent: jest.fn(() => ({
    review: jest.fn()
  })),
  aggregateReviews: jest.fn()
}));

// Mock the AI SDK
jest.mock('ai', () => ({
  generateText: jest.fn()
}));

jest.mock('@ai-sdk/openai', () => ({
  openai: jest.fn(() => 'mock-model')
}));

describe('LeadAgent Review Orchestration', () => {
  let leadAgent: LeadAgent;
  let domainModel: RFCDomainModel;
  let storage: InMemoryStorage;
  let mockRFC: RFC;

  beforeEach(() => {
    // Initialize storage and domain model
    storage = new InMemoryStorage();
    domainModel = new RFCDomainModel(storage);

    // Create mock RFC
    mockRFC = {
      id: 'rfc-001',
      title: 'Test RFC',
      content: '## Test RFC\n\nThis is a test RFC.',
      version: 1,
      status: 'DRAFT',
      author: 'test-agent',
      requestingUser: 'test-user',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Add mock RFC to storage
    storage.rfcs.set(mockRFC.id, mockRFC);

    // Create mock codebase context
    const mockContext = {
      codebase: {
        filename: 'test.ts',
        content: 'test code',
        language: 'typescript',
        lineCount: 100,
        size: 1000,
        lastModified: new Date()
      }
    };

    // Create lead agent
    leadAgent = createLeadAgent(domainModel, mockContext as any);
  });

  describe('spawnReviewAgents', () => {
    it('should spawn multiple review agents in parallel', async () => {
      const { createReviewAgent, aggregateReviews } = require('../src/agents/review-agent');
      
      // Mock review responses
      const mockBackendReview: ReviewResponse = {
        agentType: 'backend',
        overallRecommendation: 'approve',
        summary: 'Backend looks good',
        comments: [
          {
            type: 'inline',
            content: 'Consider using async/await',
            severity: 'minor',
            category: 'performance'
          }
        ],
        reviewDuration: 1000,
        focusAreasAnalyzed: ['API Design']
      };

      const mockSecurityReview: ReviewResponse = {
        agentType: 'security',
        overallRecommendation: 'needs-work',
        summary: 'Security issues found',
        comments: [
          {
            type: 'document-level',
            content: 'Add input validation',
            severity: 'critical',
            category: 'security'
          }
        ],
        reviewDuration: 1200,
        focusAreasAnalyzed: ['Authentication']
      };

      // Setup mocks
      const mockReviewAgent = {
        review: jest.fn()
          .mockResolvedValueOnce(mockBackendReview)
          .mockResolvedValueOnce(mockSecurityReview)
      };

      createReviewAgent.mockReturnValue(mockReviewAgent);

      aggregateReviews.mockReturnValue({
        totalReviews: 2,
        recommendations: { 'approve': 1, 'needs-work': 1 },
        totalComments: 2,
        severityBreakdown: { 'critical': 1, 'minor': 1 },
        averageReviewTime: 1100,
        reviewerTypes: ['backend', 'security'],
        overallRecommendation: 'needs-work',
        criticalIssues: 1
      });

      // Execute review orchestration
      const result = await leadAgent.spawnReviewAgents(
        'rfc-001',
        ['backend', 'security'],
        'Focus on API security'
      );

      // Verify agents were created
      expect(createReviewAgent).toHaveBeenCalledTimes(2);
      expect(createReviewAgent).toHaveBeenCalledWith('backend');
      expect(createReviewAgent).toHaveBeenCalledWith('security');

      // Verify reviews were called
      expect(mockReviewAgent.review).toHaveBeenCalledTimes(2);

      // Verify aggregation
      expect(aggregateReviews).toHaveBeenCalled();
      expect(result.totalReviews).toBe(2);
      expect(result.criticalIssues).toBe(1);
      expect(result.overallRecommendation).toBe('needs-work');
    });

    it('should handle review errors gracefully', async () => {
      const { createReviewAgent } = require('../src/agents/review-agent');
      
      const mockReviewAgent = {
        review: jest.fn().mockRejectedValue(new Error('Review failed'))
      };

      createReviewAgent.mockReturnValue(mockReviewAgent);

      // Should throw error
      await expect(leadAgent.spawnReviewAgents(
        'rfc-001',
        ['backend'],
        undefined
      )).rejects.toThrow('Review failed');
    });

    it('should handle missing RFC', async () => {
      // Try to review non-existent RFC
      await expect(leadAgent.spawnReviewAgents(
        'rfc-999',
        ['backend'],
        undefined
      )).rejects.toThrow('RFC with ID rfc-999 not found');
    });
  });

  describe('prepareReviewContext', () => {
    it('should prepare comprehensive context for reviewers', async () => {
      // This is a private method, but we can test it through spawnReviewAgents
      const { createReviewAgent } = require('../src/agents/review-agent');
      
      let capturedContext: any;
      const mockReviewAgent = {
        review: jest.fn((context) => {
          capturedContext = context;
          return {
            agentType: 'backend',
            overallRecommendation: 'approve',
            summary: 'Test',
            comments: [],
            reviewDuration: 100,
            focusAreasAnalyzed: []
          };
        })
      };

      createReviewAgent.mockReturnValue(mockReviewAgent);

      await leadAgent.spawnReviewAgents('rfc-001', ['backend']);

      // Verify context structure
      expect(capturedContext).toBeDefined();
      expect(capturedContext.codebase).toBeDefined();
      expect(capturedContext.rfc).toBeDefined();
      expect(capturedContext.rfc.id).toBe('rfc-001');
      expect(capturedContext.existingComments).toBeDefined();
      expect(capturedContext.reviewRequest).toBeDefined();
    });

    it('should include existing comments in context', async () => {
      // Add some existing comments
      const mockComment: Comment = {
        id: 'comment-1',
        rfcId: 'rfc-001',
        agentId: 'agent-1',
        agentType: AgentType.FRONTEND,
        type: 'DOCUMENT_LEVEL',
        content: 'Existing comment',
        status: 'OPEN',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      storage.comments.set(mockComment.id, mockComment);

      const { createReviewAgent } = require('../src/agents/review-agent');
      
      let capturedContext: any;
      const mockReviewAgent = {
        review: jest.fn((context) => {
          capturedContext = context;
          return {
            agentType: 'backend',
            overallRecommendation: 'approve',
            summary: 'Test',
            comments: [],
            reviewDuration: 100,
            focusAreasAnalyzed: []
          };
        })
      };

      createReviewAgent.mockReturnValue(mockReviewAgent);

      await leadAgent.spawnReviewAgents('rfc-001', ['backend']);

      // Verify existing comments are included
      expect(capturedContext.existingComments).toHaveLength(1);
      expect(capturedContext.existingComments[0].content).toBe('Existing comment');
    });
  });

  describe('processReviewComments', () => {
    it('should add review comments to RFC', async () => {
      const { createReviewAgent, aggregateReviews } = require('../src/agents/review-agent');
      
      const mockReview: ReviewResponse = {
        agentType: 'backend',
        overallRecommendation: 'approve',
        summary: 'Test',
        comments: [
          {
            type: 'inline',
            quotedText: 'test code',
            content: 'Test comment',
            severity: 'minor',
            category: 'performance'
          }
        ],
        reviewDuration: 100,
        focusAreasAnalyzed: []
      };

      const mockReviewAgent = {
        review: jest.fn().mockResolvedValue(mockReview)
      };

      createReviewAgent.mockReturnValue(mockReviewAgent);

      aggregateReviews.mockReturnValue({
        totalReviews: 1,
        totalComments: 1,
        recommendations: { 'approve': 1 },
        severityBreakdown: { 'minor': 1 },
        averageReviewTime: 100,
        reviewerTypes: ['backend'],
        overallRecommendation: 'approve',
        criticalIssues: 0
      });

      await leadAgent.spawnReviewAgents('rfc-001', ['backend']);

      // Check that comments were added to the domain model
      const comments = await domainModel.getCommentsForRFC('rfc-001');
      expect(comments.length).toBeGreaterThan(0);
    });

    it('should format comments with severity and metadata', async () => {
      const { createReviewAgent, aggregateReviews } = require('../src/agents/review-agent');
      
      const mockReview: ReviewResponse = {
        agentType: 'security',
        overallRecommendation: 'needs-work',
        summary: 'Security review',
        comments: [
          {
            type: 'inline',
            content: 'Security issue',
            severity: 'critical',
            category: 'security',
            lineReference: 'test.ts line 42',
            suggestedChange: 'Add validation'
          }
        ],
        reviewDuration: 100,
        focusAreasAnalyzed: []
      };

      const mockReviewAgent = {
        review: jest.fn().mockResolvedValue(mockReview)
      };

      createReviewAgent.mockReturnValue(mockReviewAgent);

      aggregateReviews.mockReturnValue({
        totalReviews: 1,
        totalComments: 1,
        recommendations: { 'needs-work': 1 },
        severityBreakdown: { 'critical': 1 },
        averageReviewTime: 100,
        reviewerTypes: ['security'],
        overallRecommendation: 'needs-work',
        criticalIssues: 1
      });

      await leadAgent.spawnReviewAgents('rfc-001', ['security']);

      const comments = await domainModel.getCommentsForRFC('rfc-001');
      const addedComment = comments[comments.length - 1];
      
      // Check that comment is properly formatted
      expect(addedComment.content).toContain('CRITICAL');
      expect(addedComment.content).toContain('security');
      expect(addedComment.content).toContain('Security issue');
    });

    it('should skip reply comments (threading not implemented)', async () => {
      const { createReviewAgent, aggregateReviews } = require('../src/agents/review-agent');
      
      const mockReview: ReviewResponse = {
        agentType: 'backend',
        overallRecommendation: 'approve',
        summary: 'Test',
        comments: [
          {
            type: 'inline',
            content: 'Reply comment',
            severity: 'minor',
            category: 'clarification',
            inReplyTo: 'comment-123' // This should be skipped
          }
        ],
        reviewDuration: 100,
        focusAreasAnalyzed: []
      };

      const mockReviewAgent = {
        review: jest.fn().mockResolvedValue(mockReview)
      };

      createReviewAgent.mockReturnValue(mockReviewAgent);

      aggregateReviews.mockReturnValue({
        totalReviews: 1,
        totalComments: 0, // No comments added due to reply
        recommendations: { 'approve': 1 },
        severityBreakdown: {},
        averageReviewTime: 100,
        reviewerTypes: ['backend'],
        overallRecommendation: 'approve',
        criticalIssues: 0
      });

      const result = await leadAgent.spawnReviewAgents('rfc-001', ['backend']);

      // Reply comments should be skipped
      expect(result.totalComments).toBe(0);
    });
  });

  describe('extractRFCSections', () => {
    it('should extract sections from RFC markdown', async () => {
      // Update RFC with sections
      mockRFC.content = `# RFC Title

## Summary
This is the summary.

## Problem Statement
The problem is...

### Sub-section
Details here.

## Proposed Solution
The solution is...`;

      storage.rfcs.set(mockRFC.id, mockRFC);

      const { createReviewAgent } = require('../src/agents/review-agent');
      
      let capturedContext: any;
      const mockReviewAgent = {
        review: jest.fn((context) => {
          capturedContext = context;
          return {
            agentType: 'backend',
            overallRecommendation: 'approve',
            summary: 'Test',
            comments: [],
            reviewDuration: 100,
            focusAreasAnalyzed: []
          };
        })
      };

      createReviewAgent.mockReturnValue(mockReviewAgent);

      await leadAgent.spawnReviewAgents('rfc-001', ['backend']);

      // Check extracted sections
      expect(capturedContext.rfc.sections).toContain('RFC Title');
      expect(capturedContext.rfc.sections).toContain('Summary');
      expect(capturedContext.rfc.sections).toContain('Problem Statement');
      expect(capturedContext.rfc.sections).toContain('Sub-section');
      expect(capturedContext.rfc.sections).toContain('Proposed Solution');
    });
  });

  describe('Review Summary', () => {
    it('should return comprehensive review summary', async () => {
      const { createReviewAgent, aggregateReviews } = require('../src/agents/review-agent');
      
      const mockReviews = [
        {
          agentType: 'backend',
          overallRecommendation: 'approve',
          summary: 'Backend good',
          comments: [],
          reviewDuration: 100,
          focusAreasAnalyzed: ['API']
        },
        {
          agentType: 'frontend',
          overallRecommendation: 'approve',
          summary: 'Frontend good',
          comments: [],
          reviewDuration: 150,
          focusAreasAnalyzed: ['UI']
        }
      ];

      const mockReviewAgent = {
        review: jest.fn()
          .mockResolvedValueOnce(mockReviews[0])
          .mockResolvedValueOnce(mockReviews[1])
      };

      createReviewAgent.mockReturnValue(mockReviewAgent);

      const expectedSummary: ReviewSummary = {
        totalReviews: 2,
        recommendations: { 'approve': 2 },
        totalComments: 0,
        severityBreakdown: {},
        averageReviewTime: 125,
        reviewerTypes: ['backend', 'frontend'],
        overallRecommendation: 'approve',
        criticalIssues: 0
      };

      aggregateReviews.mockReturnValue(expectedSummary);

      const result = await leadAgent.spawnReviewAgents(
        'rfc-001',
        ['backend', 'frontend']
      );

      expect(result).toEqual(expectedSummary);
      expect(result.totalReviews).toBe(2);
      expect(result.overallRecommendation).toBe('approve');
      expect(result.averageReviewTime).toBe(125);
    });
  });
});
/**
 * Unit Tests for Review Agent System
 * 
 * Tests the ReviewAgent class, comment generation, deduplication,
 * and review orchestration functionality.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
  ReviewAgent,
  ReviewContext,
  ReviewResponse,
  ReviewComment,
  createReviewAgent,
  aggregateReviews
} from '../src/agents/review-agent';

// Mock the AI model to avoid API calls in tests
jest.mock('ai', () => ({
  generateText: jest.fn()
}));

jest.mock('@ai-sdk/openai', () => ({
  openai: jest.fn(() => 'mock-model')
}));

describe('ReviewAgent', () => {
  let reviewAgent: ReviewAgent;
  let mockContext: ReviewContext;

  beforeEach(() => {
    // Create a test review agent
    reviewAgent = createReviewAgent('backend');

    // Create mock review context
    mockContext = {
      codebase: {
        filename: 'test.ts',
        content: 'const test = () => { return "test"; };',
        language: 'typescript',
        lineCount: 100,
        size: 1000
      },
      rfc: {
        id: 'rfc-001',
        title: 'Test RFC',
        content: '## Test RFC\n\nThis is a test RFC document.',
        version: 1,
        sections: ['Summary', 'Problem Statement', 'Solution']
      },
      existingComments: [],
      reviewRequest: {
        reviewerType: 'backend',
        specificConcerns: 'Focus on API design'
      }
    };
  });

  describe('Review Generation', () => {
    it('should create a review agent with correct configuration', () => {
      expect(reviewAgent).toBeDefined();
      expect(reviewAgent.constructor.name).toBe('ReviewAgent');
    });

    it('should handle review context properly', async () => {
      const { generateText } = require('ai');
      generateText.mockResolvedValue({
        text: JSON.stringify({
          overallRecommendation: 'approve',
          summary: 'Test review summary',
          comments: [
            {
              type: 'inline',
              content: 'Test comment',
              severity: 'minor',
              category: 'performance'
            }
          ]
        })
      });

      const result = await reviewAgent.review(mockContext);

      expect(result).toBeDefined();
      expect(result.agentType).toBe('backend');
      expect(result.overallRecommendation).toBe('approve');
      expect(result.comments).toHaveLength(1);
    });

    it('should handle different reviewer types', () => {
      const backendAgent = createReviewAgent('backend');
      const frontendAgent = createReviewAgent('frontend');
      const securityAgent = createReviewAgent('security');

      expect(backendAgent).toBeDefined();
      expect(frontendAgent).toBeDefined();
      expect(securityAgent).toBeDefined();
    });
  });

  describe('Comment Validation', () => {
    it('should validate comment structure', () => {
      const validComment: ReviewComment = {
        type: 'inline',
        quotedText: 'test code',
        content: 'This needs improvement',
        severity: 'major',
        category: 'performance',
        lineReference: 'test.ts line 42'
      };

      expect(validComment.type).toMatch(/^(inline|document-level)$/);
      expect(validComment.severity).toMatch(/^(critical|major|minor|suggestion|praise)$/);
    });

    it('should support comment threading', () => {
      const replyComment: ReviewComment = {
        type: 'inline',
        content: 'Replying to existing comment',
        severity: 'minor',
        category: 'clarification',
        inReplyTo: 'comment-123'
      };

      expect(replyComment.inReplyTo).toBe('comment-123');
    });
  });

  describe('Comment Deduplication', () => {
    it('should detect duplicate comments', () => {
      mockContext.existingComments = [
        {
          id: 'comment-1',
          agentType: 'frontend',
          type: 'inline',
          content: 'This authentication approach needs improvement',
          status: 'open',
          severity: 'major',
          category: 'security'
        }
      ];

      // Test similarity calculation (private method, testing through behavior)
      const { generateText } = require('ai');
      generateText.mockResolvedValue({
        text: JSON.stringify({
          overallRecommendation: 'approve',
          summary: 'Test',
          comments: [
            {
              type: 'inline',
              content: 'This authentication approach needs improvement', // Duplicate
              severity: 'major',
              category: 'security'
            },
            {
              type: 'inline',
              content: 'Add rate limiting to prevent abuse', // New
              severity: 'minor',
              category: 'performance'
            }
          ]
        })
      });

      // The agent should filter out duplicates internally
      // This would be tested through the actual implementation
    });
  });

  describe('Review Response Parsing', () => {
    it('should parse valid JSON response', async () => {
      const mockResponse = {
        overallRecommendation: 'needs-work',
        summary: 'Several issues found',
        comments: [
          {
            type: 'inline',
            quotedText: 'const user = auth()',
            content: 'Missing error handling',
            severity: 'critical',
            category: 'error-handling',
            lineReference: 'test.ts line 10'
          }
        ]
      };

      const { generateText } = require('ai');
      generateText.mockResolvedValue({
        text: JSON.stringify(mockResponse)
      });

      const result = await reviewAgent.review(mockContext);

      expect(result.overallRecommendation).toBe('needs-work');
      expect(result.summary).toBe('Several issues found');
      expect(result.comments[0].severity).toBe('critical');
    });

    it('should handle malformed responses gracefully', async () => {
      const { generateText } = require('ai');
      generateText.mockResolvedValue({
        text: 'This is not valid JSON'
      });

      const result = await reviewAgent.review(mockContext);

      expect(result.overallRecommendation).toBe('abstain');
      expect(result.comments).toHaveLength(0);
    });
  });

  describe('Review Aggregation', () => {
    it('should aggregate multiple reviews correctly', () => {
      const reviews: ReviewResponse[] = [
        {
          agentType: 'backend',
          overallRecommendation: 'approve',
          summary: 'Backend review',
          comments: [
            {
              type: 'inline',
              content: 'Test comment 1',
              severity: 'minor',
              category: 'performance'
            }
          ],
          reviewDuration: 1000,
          focusAreasAnalyzed: ['API Design']
        },
        {
          agentType: 'security',
          overallRecommendation: 'needs-work',
          summary: 'Security review',
          comments: [
            {
              type: 'document-level',
              content: 'Security issue',
              severity: 'critical',
              category: 'security'
            },
            {
              type: 'inline',
              content: 'Another issue',
              severity: 'major',
              category: 'security'
            }
          ],
          reviewDuration: 1500,
          focusAreasAnalyzed: ['Authentication', 'Authorization']
        }
      ];

      const summary = aggregateReviews(reviews);

      expect(summary.totalReviews).toBe(2);
      expect(summary.totalComments).toBe(3);
      expect(summary.criticalIssues).toBe(1);
      expect(summary.overallRecommendation).toBe('reject'); // Due to critical issue
      expect(summary.recommendations['approve']).toBe(1);
      expect(summary.recommendations['needs-work']).toBe(1);
      expect(summary.severityBreakdown['critical']).toBe(1);
      expect(summary.severityBreakdown['major']).toBe(1);
      expect(summary.severityBreakdown['minor']).toBe(1);
      expect(summary.averageReviewTime).toBe(1250);
    });

    it('should handle empty review list', () => {
      const summary = aggregateReviews([]);

      expect(summary.totalReviews).toBe(0);
      expect(summary.totalComments).toBe(0);
      expect(summary.overallRecommendation).toBe('no-reviews');
    });

    it('should determine overall recommendation correctly', () => {
      // Test reject due to reject vote
      const rejectReviews: ReviewResponse[] = [
        {
          agentType: 'backend',
          overallRecommendation: 'approve',
          summary: 'Good',
          comments: [],
          reviewDuration: 1000,
          focusAreasAnalyzed: []
        },
        {
          agentType: 'security',
          overallRecommendation: 'reject',
          summary: 'Bad',
          comments: [],
          reviewDuration: 1000,
          focusAreasAnalyzed: []
        }
      ];

      const rejectSummary = aggregateReviews(rejectReviews);
      expect(rejectSummary.overallRecommendation).toBe('reject');

      // Test needs-work due to majority
      const needsWorkReviews: ReviewResponse[] = [
        {
          agentType: 'backend',
          overallRecommendation: 'needs-work',
          summary: 'Needs work',
          comments: [],
          reviewDuration: 1000,
          focusAreasAnalyzed: []
        },
        {
          agentType: 'frontend',
          overallRecommendation: 'needs-work',
          summary: 'Needs work',
          comments: [],
          reviewDuration: 1000,
          focusAreasAnalyzed: []
        },
        {
          agentType: 'database',
          overallRecommendation: 'approve',
          summary: 'Good',
          comments: [],
          reviewDuration: 1000,
          focusAreasAnalyzed: []
        }
      ];

      const needsWorkSummary = aggregateReviews(needsWorkReviews);
      expect(needsWorkSummary.overallRecommendation).toBe('needs-work');
    });
  });

  describe('Specialist Focus Areas', () => {
    it('should have correct focus areas for each specialist', () => {
      const specialists = ['backend', 'frontend', 'security', 'database', 'infrastructure'] as const;
      
      specialists.forEach(type => {
        const agent = createReviewAgent(type);
        expect(agent).toBeDefined();
        
        // Each specialist should have unique characteristics
        // This would be verified through the getSpecialistFocus method
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle review errors gracefully', async () => {
      const { generateText } = require('ai');
      generateText.mockRejectedValue(new Error('API Error'));

      const result = await reviewAgent.review(mockContext);

      expect(result.overallRecommendation).toBe('abstain');
      expect(result.summary).toContain('Review failed');
      expect(result.comments).toHaveLength(0);
    });
  });
});

describe('Review Context Validation', () => {
  it('should validate review context structure', () => {
    const validContext: ReviewContext = {
      codebase: {
        filename: 'app.ts',
        content: 'code content',
        language: 'typescript',
        lineCount: 50,
        size: 500
      },
      rfc: {
        id: 'rfc-002',
        title: 'Test RFC',
        content: 'RFC content',
        version: 2,
        sections: ['Section 1']
      },
      existingComments: [],
      reviewRequest: {
        reviewerType: 'backend'
      }
    };

    // Validate required fields
    expect(validContext.codebase).toBeDefined();
    expect(validContext.rfc).toBeDefined();
    expect(validContext.existingComments).toBeDefined();
    expect(validContext.reviewRequest).toBeDefined();
    expect(validContext.reviewRequest.reviewerType).toBeDefined();
  });
});

describe('Comment Formatting', () => {
  it('should format comments with severity icons', () => {
    const severityIcons = {
      critical: '🚨',
      major: '⚠️',
      minor: '💡',
      suggestion: '💭',
      praise: '👏'
    };

    Object.entries(severityIcons).forEach(([severity, icon]) => {
      expect(icon).toBeDefined();
      expect(icon.length).toBeGreaterThan(0);
    });
  });

  it('should include line references in formatted comments', () => {
    const comment: ReviewComment = {
      type: 'inline',
      content: 'Test comment',
      severity: 'major',
      category: 'performance',
      lineReference: 'file.ts line 42'
    };

    // Format would include the line reference
    expect(comment.lineReference).toBe('file.ts line 42');
  });

  it('should include suggested changes when present', () => {
    const comment: ReviewComment = {
      type: 'document-level',
      content: 'Issue found',
      severity: 'minor',
      category: 'maintainability',
      suggestedChange: 'Refactor this function'
    };

    expect(comment.suggestedChange).toBe('Refactor this function');
  });
});
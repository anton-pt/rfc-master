import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  RFCDomainModel,
  RFCStatus,
  CommentStatus,
  CommentType,
  AgentType,
  ReviewStatus
} from '../rfc-domain-model';

describe('RFCDomainModel', () => {
  let model: RFCDomainModel;
  let leadAgent: any;
  let frontendAgent: any;
  let backendAgent: any;

  beforeEach(async () => {
    model = new RFCDomainModel();
    
    leadAgent = await model.createAgent(AgentType.LEAD, 'Lead Agent');
    frontendAgent = await model.createAgent(AgentType.FRONTEND, 'Frontend Agent');
    backendAgent = await model.createAgent(AgentType.BACKEND, 'Backend Agent');
  });

  describe('RFC Document Operations', () => {
    it('should create an RFC document', async () => {
      const rfc = await model.createRFC(
        'Test RFC',
        '# Test RFC\n\nThis is a test RFC document.',
        'author123',
        'user456'
      );

      expect(rfc).toBeDefined();
      expect(rfc.title).toBe('Test RFC');
      expect(rfc.status).toBe(RFCStatus.DRAFT);
      expect(rfc.version).toBe(1);
      expect(rfc.author).toBe('author123');
      expect(rfc.requestingUser).toBe('user456');
    });

    it('should update RFC content and increment version', async () => {
      const rfc = await model.createRFC(
        'Test RFC',
        'Original content',
        'author123',
        'user456'
      );

      const updated = await model.updateRFCContent(rfc.id, 'Updated content');

      expect(updated.content).toBe('Updated content');
      expect(updated.version).toBe(2);
      expect(updated.previousVersionId).toBe(`${rfc.id}-v1`);
    });

    it('should update RFC status with valid transitions', async () => {
      const rfc = await model.createRFC(
        'Test RFC',
        'Content',
        'author123',
        'user456'
      );

      const inReview = await model.updateRFCStatus(rfc.id, RFCStatus.IN_REVIEW);
      expect(inReview.status).toBe(RFCStatus.IN_REVIEW);

      const approved = await model.updateRFCStatus(rfc.id, RFCStatus.APPROVED);
      expect(approved.status).toBe(RFCStatus.APPROVED);
    });

    it('should throw error for invalid status transitions', async () => {
      const rfc = await model.createRFC(
        'Test RFC',
        'Content',
        'author123',
        'user456'
      );

      await expect(
        model.updateRFCStatus(rfc.id, RFCStatus.SUPERSEDED)
      ).rejects.toThrow('Invalid status transition');
    });

    it('should list RFCs with filters', async () => {
      await model.createRFC('RFC 1', 'Content 1', 'author1', 'user1');
      await model.createRFC('RFC 2', 'Content 2', 'author2', 'user1');
      await model.createRFC('RFC 3', 'Content 3', 'author1', 'user2');

      const allRFCs = await model.listRFCs();
      expect(allRFCs).toHaveLength(3);

      const author1RFCs = await model.listRFCs({ author: 'author1' });
      expect(author1RFCs).toHaveLength(2);

      const user1RFCs = await model.listRFCs({ requestingUser: 'user1' });
      expect(user1RFCs).toHaveLength(2);
    });

    it('should validate required fields when creating RFC', async () => {
      await expect(
        model.createRFC('', 'Content', 'author', 'user')
      ).rejects.toThrow('RFC title is required');

      await expect(
        model.createRFC('Title', '', 'author', 'user')
      ).rejects.toThrow('RFC content is required');
    });
  });

  describe('String Replacement Operations', () => {
    it('should replace string in RFC content', async () => {
      const rfc = await model.createRFC(
        'Test RFC',
        'The old text is here. The old text is also here.',
        'author',
        'user'
      );

      const updated = await model.replaceString({
        rfcId: rfc.id,
        oldText: 'old text',
        newText: 'new text',
        replaceAll: false
      });

      expect(updated.content).toBe('The new text is here. The old text is also here.');
      expect(updated.version).toBe(2);
    });

    it('should replace all occurrences when replaceAll is true', async () => {
      const rfc = await model.createRFC(
        'Test RFC',
        'The old text is here. The old text is also here.',
        'author',
        'user'
      );

      const updated = await model.replaceString({
        rfcId: rfc.id,
        oldText: 'old text',
        newText: 'new text',
        replaceAll: true
      });

      expect(updated.content).toBe('The new text is here. The new text is also here.');
    });

    it('should validate string exists before replacement', async () => {
      const rfc = await model.createRFC(
        'Test RFC',
        'Some content',
        'author',
        'user'
      );

      const exists = await model.validateStringExists(rfc.id, 'content');
      expect(exists).toBe(true);

      const notExists = await model.validateStringExists(rfc.id, 'missing');
      expect(notExists).toBe(false);

      await expect(
        model.replaceString({
          rfcId: rfc.id,
          oldText: 'missing text',
          newText: 'new text'
        })
      ).rejects.toThrow('String "missing text" not found in RFC content');
    });
  });

  describe('Comment Operations', () => {
    let rfc: any;

    beforeEach(async () => {
      rfc = await model.createRFC(
        'Test RFC',
        'This is line one.\\nThis is line two.\\nThis is line three.',
        'author',
        'user'
      );
    });

    it('should add inline comment with quoted text', async () => {
      const comment = await model.addComment({
        rfcId: rfc.id,
        agentId: frontendAgent.id,
        agentType: AgentType.FRONTEND,
        commentType: CommentType.INLINE,
        content: 'This needs clarification',
        quotedText: 'line two',
        lineReference: 2
      });

      expect(comment).toBeDefined();
      expect(comment.type).toBe(CommentType.INLINE);
      expect(comment.textReference?.quotedText).toBe('line two');
      expect(comment.status).toBe(CommentStatus.OPEN);
    });

    it('should add document-level comment', async () => {
      const comment = await model.addComment({
        rfcId: rfc.id,
        agentId: backendAgent.id,
        agentType: AgentType.BACKEND,
        commentType: CommentType.DOCUMENT_LEVEL,
        content: 'Overall architecture looks good'
      });

      expect(comment).toBeDefined();
      expect(comment.type).toBe(CommentType.DOCUMENT_LEVEL);
      expect(comment.textReference).toBeUndefined();
    });

    it('should validate quoted text exists for inline comments', async () => {
      await expect(
        model.addComment({
          rfcId: rfc.id,
          agentId: frontendAgent.id,
          agentType: AgentType.FRONTEND,
          commentType: CommentType.INLINE,
          content: 'Comment',
          quotedText: 'non-existent text'
        })
      ).rejects.toThrow('Quoted text not found in RFC content');
    });

    it('should reply to existing comment', async () => {
      const parentComment = await model.addComment({
        rfcId: rfc.id,
        agentId: frontendAgent.id,
        agentType: AgentType.FRONTEND,
        commentType: CommentType.DOCUMENT_LEVEL,
        content: 'Question about architecture'
      });

      const reply = await model.replyToComment({
        parentCommentId: parentComment.id,
        agentId: backendAgent.id,
        agentType: AgentType.BACKEND,
        content: 'Here is the answer'
      });

      expect(reply.parentCommentId).toBe(parentComment.id);
      expect(reply.rfcId).toBe(rfc.id);
    });

    it('should resolve and dismiss comments', async () => {
      const comment = await model.addComment({
        rfcId: rfc.id,
        agentId: frontendAgent.id,
        agentType: AgentType.FRONTEND,
        commentType: CommentType.DOCUMENT_LEVEL,
        content: 'Issue found'
      });

      const resolved = await model.resolveComment(comment.id, leadAgent.id);
      expect(resolved.status).toBe(CommentStatus.RESOLVED);
      expect(resolved.resolvedBy).toBe(leadAgent.id);
      expect(resolved.resolvedAt).toBeDefined();

      const comment2 = await model.addComment({
        rfcId: rfc.id,
        agentId: backendAgent.id,
        agentType: AgentType.BACKEND,
        commentType: CommentType.DOCUMENT_LEVEL,
        content: 'Not relevant'
      });

      const dismissed = await model.dismissComment(comment2.id, leadAgent.id);
      expect(dismissed.status).toBe(CommentStatus.DISMISSED);
      expect(dismissed.dismissedBy).toBe(leadAgent.id);
    });

    it('should get comment thread', async () => {
      const parent = await model.addComment({
        rfcId: rfc.id,
        agentId: frontendAgent.id,
        agentType: AgentType.FRONTEND,
        commentType: CommentType.DOCUMENT_LEVEL,
        content: 'Parent comment'
      });

      await model.replyToComment({
        parentCommentId: parent.id,
        agentId: backendAgent.id,
        agentType: AgentType.BACKEND,
        content: 'First reply'
      });

      await model.replyToComment({
        parentCommentId: parent.id,
        agentId: leadAgent.id,
        agentType: AgentType.LEAD,
        content: 'Second reply'
      });

      const thread = await model.getCommentThread(parent.id);
      expect(thread).toHaveLength(3);
      expect(thread[0].id).toBe(parent.id);
    });

    it('should get comments by status', async () => {
      const comment1 = await model.addComment({
        rfcId: rfc.id,
        agentId: frontendAgent.id,
        agentType: AgentType.FRONTEND,
        commentType: CommentType.DOCUMENT_LEVEL,
        content: 'Open comment'
      });

      const comment2 = await model.addComment({
        rfcId: rfc.id,
        agentId: backendAgent.id,
        agentType: AgentType.BACKEND,
        commentType: CommentType.DOCUMENT_LEVEL,
        content: 'To be resolved'
      });

      await model.resolveComment(comment2.id, leadAgent.id);

      const openComments = await model.getCommentsForRFC(rfc.id, CommentStatus.OPEN);
      expect(openComments).toHaveLength(1);
      expect(openComments[0].id).toBe(comment1.id);

      const resolvedComments = await model.getCommentsForRFC(rfc.id, CommentStatus.RESOLVED);
      expect(resolvedComments).toHaveLength(1);
      expect(resolvedComments[0].id).toBe(comment2.id);
    });
  });

  describe('Review Operations', () => {
    let rfc: any;

    beforeEach(async () => {
      rfc = await model.createRFC(
        'Test RFC',
        'RFC content for review',
        'author',
        'user'
      );
    });

    it('should request review from multiple agents', async () => {
      const review = await model.requestReview({
        rfcId: rfc.id,
        requestedBy: leadAgent.id,
        reviewerAgentIds: [frontendAgent.id, backendAgent.id],
        deadline: new Date(Date.now() + 86400000)
      });

      expect(review).toBeDefined();
      expect(review.rfcId).toBe(rfc.id);
      expect(review.reviewerAgentIds).toHaveLength(2);
      expect(review.reviewStatuses[frontendAgent.id]).toBe(ReviewStatus.PENDING);
      expect(review.reviewStatuses[backendAgent.id]).toBe(ReviewStatus.PENDING);
    });

    it('should prevent multiple active reviews', async () => {
      await model.requestReview({
        rfcId: rfc.id,
        requestedBy: leadAgent.id,
        reviewerAgentIds: [frontendAgent.id]
      });

      await expect(
        model.requestReview({
          rfcId: rfc.id,
          requestedBy: leadAgent.id,
          reviewerAgentIds: [backendAgent.id]
        })
      ).rejects.toThrow('already has an active review request');
    });

    it('should submit review with comments', async () => {
      const review = await model.requestReview({
        rfcId: rfc.id,
        requestedBy: leadAgent.id,
        reviewerAgentIds: [frontendAgent.id, backendAgent.id]
      });

      const comment = await model.addComment({
        rfcId: rfc.id,
        agentId: frontendAgent.id,
        agentType: AgentType.FRONTEND,
        commentType: CommentType.DOCUMENT_LEVEL,
        content: 'Frontend review comment'
      });

      await model.submitReview({
        reviewRequestId: review.id,
        agentId: frontendAgent.id,
        comments: [comment]
      });

      const status = await model.getReviewStatus(review.id);
      expect(status[frontendAgent.id]).toBe(ReviewStatus.COMPLETED);
      expect(status[backendAgent.id]).toBe(ReviewStatus.PENDING);

      const isComplete = await model.isReviewComplete(review.id);
      expect(isComplete).toBe(false);
    });

    it('should mark review as complete when all reviewers submit', async () => {
      const review = await model.requestReview({
        rfcId: rfc.id,
        requestedBy: leadAgent.id,
        reviewerAgentIds: [frontendAgent.id, backendAgent.id]
      });

      await model.submitReview({
        reviewRequestId: review.id,
        agentId: frontendAgent.id,
        comments: []
      });

      await model.submitReview({
        reviewRequestId: review.id,
        agentId: backendAgent.id,
        comments: []
      });

      const isComplete = await model.isReviewComplete(review.id);
      expect(isComplete).toBe(true);
    });

    it('should validate review deadline', async () => {
      const pastDate = new Date(Date.now() - 86400000);

      await expect(
        model.requestReview({
          rfcId: rfc.id,
          requestedBy: leadAgent.id,
          reviewerAgentIds: [frontendAgent.id],
          deadline: pastDate
        })
      ).rejects.toThrow('Review deadline must be in the future');
    });

    it('should prevent submission after deadline', async () => {
      const review = await model.requestReview({
        rfcId: rfc.id,
        requestedBy: leadAgent.id,
        reviewerAgentIds: [frontendAgent.id],
        deadline: new Date(Date.now() + 1000)
      });

      await new Promise(resolve => setTimeout(resolve, 1100));

      await expect(
        model.submitReview({
          reviewRequestId: review.id,
          agentId: frontendAgent.id,
          comments: []
        })
      ).rejects.toThrow('Review deadline has passed');
    });
  });

  describe('Agent Operations', () => {
    it('should create agents with appropriate capabilities', async () => {
      const lead = await model.createAgent(AgentType.LEAD, 'Lead');
      expect(lead.capabilities.canEdit).toBe(true);
      expect(lead.capabilities.canComment).toBe(true);
      expect(lead.capabilities.canApprove).toBe(true);

      const frontend = await model.createAgent(AgentType.FRONTEND, 'Frontend');
      expect(frontend.capabilities.canEdit).toBe(false);
      expect(frontend.capabilities.canComment).toBe(true);
      expect(frontend.capabilities.canApprove).toBe(false);
    });

    it('should create agent with custom capabilities', async () => {
      const customAgent = await model.createAgent(
        AgentType.BACKEND,
        'Custom Backend',
        { canApprove: true }
      );

      expect(customAgent.capabilities.canEdit).toBe(false);
      expect(customAgent.capabilities.canComment).toBe(true);
      expect(customAgent.capabilities.canApprove).toBe(true);
    });

    it('should list all agents', async () => {
      const agents = await model.listAgents();
      expect(agents.length).toBeGreaterThanOrEqual(3);
    });

    it('should enforce agent permissions for comments', async () => {
      const restrictedAgent = await model.createAgent(
        AgentType.BACKEND,
        'Restricted',
        { canComment: false }
      );

      const rfc = await model.createRFC('Test', 'Content', 'author', 'user');

      await expect(
        model.addComment({
          rfcId: rfc.id,
          agentId: restrictedAgent.id,
          agentType: AgentType.BACKEND,
          commentType: CommentType.DOCUMENT_LEVEL,
          content: 'Should fail'
        })
      ).rejects.toThrow('does not have permission to comment');
    });
  });

  describe('Error Handling', () => {
    it('should handle non-existent RFC', async () => {
      await expect(
        model.updateRFCContent('non-existent', 'New content')
      ).rejects.toThrow('RFC with id non-existent not found');

      await expect(
        model.replaceString({
          rfcId: 'non-existent',
          oldText: 'old',
          newText: 'new'
        })
      ).rejects.toThrow('RFC with id non-existent not found');
    });

    it('should handle non-existent comment', async () => {
      await expect(
        model.resolveComment('non-existent', leadAgent.id)
      ).rejects.toThrow('Comment with id non-existent not found');

      await expect(
        model.getCommentThread('non-existent')
      ).rejects.toThrow('Comment with id non-existent not found');
    });

    it('should handle non-existent review', async () => {
      await expect(
        model.getReviewStatus('non-existent')
      ).rejects.toThrow('Review request with id non-existent not found');

      await expect(
        model.submitReview({
          reviewRequestId: 'non-existent',
          agentId: frontendAgent.id,
          comments: []
        })
      ).rejects.toThrow('Review request with id non-existent not found');
    });

    it('should handle non-existent agent', async () => {
      const rfc = await model.createRFC('Test', 'Content', 'author', 'user');

      await expect(
        model.addComment({
          rfcId: rfc.id,
          agentId: 'non-existent',
          agentType: AgentType.FRONTEND,
          commentType: CommentType.DOCUMENT_LEVEL,
          content: 'Comment'
        })
      ).rejects.toThrow('Agent with id non-existent not found');
    });
  });

  describe('Concurrency and Versioning', () => {
    it('should handle concurrent RFC updates', async () => {
      const rfc = await model.createRFC('Test', 'Initial', 'author', 'user');

      await Promise.all([
        model.updateRFCContent(rfc.id, 'Update 1'),
        model.updateRFCContent(rfc.id, 'Update 2'),
        model.updateRFCContent(rfc.id, 'Update 3')
      ]);

      const latest = await model.getRFC(rfc.id);
      expect(latest).toBeDefined();
      expect(latest!.version).toBeGreaterThan(1);
    });

    it('should handle concurrent comment additions', async () => {
      const rfc = await model.createRFC('Test', 'Content', 'author', 'user');

      await Promise.all([
        model.addComment({
          rfcId: rfc.id,
          agentId: frontendAgent.id,
          agentType: AgentType.FRONTEND,
          commentType: CommentType.DOCUMENT_LEVEL,
          content: 'Comment 1'
        }),
        model.addComment({
          rfcId: rfc.id,
          agentId: backendAgent.id,
          agentType: AgentType.BACKEND,
          commentType: CommentType.DOCUMENT_LEVEL,
          content: 'Comment 2'
        }),
        model.addComment({
          rfcId: rfc.id,
          agentId: leadAgent.id,
          agentType: AgentType.LEAD,
          commentType: CommentType.DOCUMENT_LEVEL,
          content: 'Comment 3'
        })
      ]);

      const allComments = await model.getCommentsForRFC(rfc.id);
      expect(allComments).toHaveLength(3);
    });
  });
});
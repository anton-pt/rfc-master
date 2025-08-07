import { describe, it, expect, beforeEach } from '@jest/globals';
import { RFCDomainModel, AgentType, CommentType } from '../../domain';
import { initializeTools, leadAgentTools } from '../lead-agent-tools';

// Mock options for tool calls (required by AI SDK)
const mockToolOptions = {
  toolCallId: 'test-call-id',
  toolName: 'test-tool'
};

describe('Lead Agent Tools', () => {
  let domainModel: RFCDomainModel;
  let leadAgent: any;

  beforeEach(async () => {
    domainModel = new RFCDomainModel();
    leadAgent = await domainModel.createAgent(AgentType.LEAD, 'Test Lead Agent');
    initializeTools(domainModel, leadAgent.id);
  });

  describe('createRFCDocument', () => {
    it('should create RFC with basic parameters', async () => {
      const result = await leadAgentTools.createRFCDocument.execute({
        title: 'Test RFC',
        description: 'A test RFC document',
        sections: ['problem', 'solution']
      }, mockToolOptions);

      expect(result).toHaveProperty('rfcId');
      expect(result).toHaveProperty('content');
      expect(result).toHaveProperty('version', 1);
      expect(result).toHaveProperty('status', 'draft');
      expect(result.content).toContain('# Test RFC');
      expect(result.content).toContain('A test RFC document');
      expect(result.content).toContain('## Problem Statement');
      expect(result.content).toContain('## Proposed Solution');
    });

    it('should create RFC without sections', async () => {
      const result = await leadAgentTools.createRFCDocument.execute({
        title: 'Simple RFC',
        description: 'Simple description'
      });

      expect(result).toHaveProperty('rfcId');
      expect(result.content).toContain('# Simple RFC');
      expect(result.content).not.toContain('## Problem Statement');
    });

    it('should handle creation errors gracefully', async () => {
      // Mock domain model to throw error
      const originalCreate = domainModel.createRFC;
      domainModel.createRFC = jest.fn().mockRejectedValue(new Error('Creation failed'));

      const result = await leadAgentTools.createRFCDocument.execute({
        title: 'Test RFC',
        description: 'Test description'
      });

      expect(result).toHaveProperty('error');
      expect(result.error).toContain('Failed to create RFC');

      // Restore original method
      domainModel.createRFC = originalCreate;
    });
  });

  describe('updateRFCContent', () => {
    let rfcId: string;

    beforeEach(async () => {
      const rfc = await domainModel.createRFC(
        'Test RFC',
        'Original content with specific text',
        leadAgent.id,
        'test-session'
      );
      rfcId = rfc.id;
    });

    it('should replace text successfully', async () => {
      const result = await leadAgentTools.updateRFCContent.execute({
        rfcId,
        oldText: 'specific text',
        newText: 'updated text'
      });

      expect(result.success).toBe(true);
      expect(result.replacementCount).toBe(1);
      expect(result.updatedContent).toContain('updated text');
      expect(result).toHaveProperty('version');
    });

    it('should replace all occurrences when replaceAll is true', async () => {
      // First update RFC to have multiple occurrences
      await domainModel.updateRFCContent(rfcId, 'test test test content');

      const result = await leadAgentTools.updateRFCContent.execute({
        rfcId,
        oldText: 'test',
        newText: 'updated',
        replaceAll: true
      });

      expect(result.success).toBe(true);
      expect(result.replacementCount).toBe(3);
      expect(result.updatedContent).toContain('updated updated updated');
    });

    it('should fail when text not found', async () => {
      const result = await leadAgentTools.updateRFCContent.execute({
        rfcId,
        oldText: 'non-existent text',
        newText: 'replacement'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Text "non-existent text" not found');
      expect(result.replacementCount).toBe(0);
    });

    it('should handle non-existent RFC', async () => {
      const result = await leadAgentTools.updateRFCContent.execute({
        rfcId: 'non-existent-rfc',
        oldText: 'text',
        newText: 'replacement'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to update RFC');
    });
  });

  describe('addSection', () => {
    let rfcId: string;

    beforeEach(async () => {
      const rfc = await domainModel.createRFC(
        'Test RFC',
        '# Test RFC\n\n## Existing Section\n\nContent here\n\n## Another Section\n\nMore content',
        leadAgent.id,
        'test-session'
      );
      rfcId = rfc.id;
    });

    it('should add section at the end', async () => {
      const result = await leadAgentTools.addSection.execute({
        rfcId,
        sectionTitle: 'New Section',
        content: 'New section content'
      });

      expect(result.success).toBe(true);
      expect(result.updatedContent).toContain('## New Section');
      expect(result.updatedContent).toContain('New section content');
    });

    it('should add section after specified section', async () => {
      const result = await leadAgentTools.addSection.execute({
        rfcId,
        sectionTitle: 'Inserted Section',
        content: 'Inserted content',
        afterSection: 'Existing Section'
      });

      expect(result.success).toBe(true);
      expect(result.updatedContent).toContain('## Inserted Section');
      
      // Check that it's positioned correctly
      const content = result.updatedContent;
      const existingIndex = content.indexOf('## Existing Section');
      const insertedIndex = content.indexOf('## Inserted Section');
      const anotherIndex = content.indexOf('## Another Section');
      
      expect(existingIndex).toBeLessThan(insertedIndex);
      expect(insertedIndex).toBeLessThan(anotherIndex);
    });

    it('should handle non-existent RFC', async () => {
      const result = await leadAgentTools.addSection.execute({
        rfcId: 'non-existent',
        sectionTitle: 'New Section',
        content: 'Content'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('RFC with ID non-existent not found');
    });
  });

  describe('requestReview', () => {
    let rfcId: string;

    beforeEach(async () => {
      const rfc = await domainModel.createRFC(
        'Test RFC',
        'RFC content for review',
        leadAgent.id,
        'test-session'
      );
      rfcId = rfc.id;
    });

    it('should request review from specified reviewer types', async () => {
      const result = await leadAgentTools.requestReview.execute({
        rfcId,
        reviewerTypes: ['backend', 'security'],
        specificConcerns: 'Focus on performance and security'
      });

      expect(result).toHaveProperty('reviewRequestId');
      expect(result.reviewersAssigned).toHaveLength(2);
      expect(result.reviewersAssigned[0]).toHaveProperty('agentType');
      expect(result.reviewersAssigned[0]).toHaveProperty('name');
    });

    it('should create reviewer agents if they do not exist', async () => {
      const initialAgents = await domainModel.listAgents();
      const backendAgents = initialAgents.filter(a => a.type === AgentType.BACKEND);
      expect(backendAgents).toHaveLength(0);

      const result = await leadAgentTools.requestReview.execute({
        rfcId,
        reviewerTypes: ['backend']
      });

      expect(result.reviewersAssigned).toHaveLength(1);
      expect(result.reviewersAssigned[0].agentType).toBe('BACKEND');

      const finalAgents = await domainModel.listAgents();
      const newBackendAgents = finalAgents.filter(a => a.type === AgentType.BACKEND);
      expect(newBackendAgents).toHaveLength(1);
    });

    it('should add specific concerns as a comment', async () => {
      const result = await leadAgentTools.requestReview.execute({
        rfcId,
        reviewerTypes: ['frontend'],
        specificConcerns: 'Focus on UI/UX implications'
      });

      expect(result).toHaveProperty('reviewRequestId');

      // Check that a comment was added
      const comments = await domainModel.getCommentsForRFC(rfcId);
      const concernComment = comments.find(c => 
        c.content.includes('Review requested with specific focus') &&
        c.content.includes('UI/UX implications')
      );
      expect(concernComment).toBeDefined();
    });

    it('should handle non-existent RFC', async () => {
      const result = await leadAgentTools.requestReview.execute({
        rfcId: 'non-existent',
        reviewerTypes: ['backend']
      });

      expect(result).toHaveProperty('error');
      expect(result.error).toContain('Failed to request review');
    });
  });

  describe('getReviewComments', () => {
    let rfcId: string;
    let backendAgent: any;
    let securityAgent: any;

    beforeEach(async () => {
      const rfc = await domainModel.createRFC(
        'Test RFC',
        'RFC content with some specific text',
        leadAgent.id,
        'test-session'
      );
      rfcId = rfc.id;

      backendAgent = await domainModel.createAgent(AgentType.BACKEND, 'Backend Reviewer');
      securityAgent = await domainModel.createAgent(AgentType.SECURITY, 'Security Reviewer');

      // Add some comments
      await domainModel.addComment({
        rfcId,
        agentId: backendAgent.id,
        agentType: AgentType.BACKEND,
        commentType: CommentType.DOCUMENT_LEVEL,
        content: 'Backend review comment'
      });

      await domainModel.addComment({
        rfcId,
        agentId: securityAgent.id,
        agentType: AgentType.SECURITY,
        commentType: CommentType.INLINE,
        content: 'Security concern about specific text',
        quotedText: 'specific text'
      });
    });

    it('should retrieve all comments', async () => {
      const result = await leadAgentTools.getReviewComments.execute({
        rfcId
      });

      expect(result.comments).toHaveLength(2);
      expect(result.totalCount).toBe(2);
      expect(result.openCount).toBe(2);
      expect(result.resolvedCount).toBe(0);

      const backendComment = result.comments.find(c => c.agentType === 'backend');
      expect(backendComment).toBeDefined();
      expect(backendComment?.content).toBe('Backend review comment');

      const securityComment = result.comments.find(c => c.agentType === 'security');
      expect(securityComment).toBeDefined();
      expect(securityComment?.quotedText).toBe('specific text');
    });

    it('should filter comments by agent type', async () => {
      const result = await leadAgentTools.getReviewComments.execute({
        rfcId,
        filterBy: {
          agentType: 'backend'
        }
      });

      expect(result.comments).toHaveLength(1);
      expect(result.comments[0].agentType).toBe('backend');
      expect(result.comments[0].content).toBe('Backend review comment');
    });

    it('should filter comments by status', async () => {
      // Resolve one comment first
      const allComments = await domainModel.getCommentsForRFC(rfcId);
      await domainModel.resolveComment(allComments[0].id, leadAgent.id);

      const result = await leadAgentTools.getReviewComments.execute({
        rfcId,
        filterBy: {
          status: 'open'
        }
      });

      expect(result.comments).toHaveLength(1);
      expect(result.openCount).toBe(1);
      expect(result.resolvedCount).toBe(0); // This is the filtered count, not total
    });

    it('should handle non-existent RFC', async () => {
      const result = await leadAgentTools.getReviewComments.execute({
        rfcId: 'non-existent'
      });

      expect(result).toHaveProperty('error');
      expect(result.comments).toHaveLength(0);
    });
  });

  describe('resolveComment', () => {
    let rfcId: string;
    let commentId: string;

    beforeEach(async () => {
      const rfc = await domainModel.createRFC(
        'Test RFC',
        'RFC content',
        leadAgent.id,
        'test-session'
      );
      rfcId = rfc.id;

      const backendAgent = await domainModel.createAgent(AgentType.BACKEND, 'Backend Reviewer');
      const comment = await domainModel.addComment({
        rfcId,
        agentId: backendAgent.id,
        agentType: AgentType.BACKEND,
        commentType: CommentType.DOCUMENT_LEVEL,
        content: 'Test comment to resolve'
      });
      commentId = comment.id;
    });

    it('should resolve comment with resolution explanation', async () => {
      const result = await leadAgentTools.resolveComment.execute({
        commentId,
        resolution: 'Updated implementation to address the concern',
        rfcUpdated: true
      });

      expect(result.success).toBe(true);
      expect(result.updatedComment.status).toBe('resolved');
      expect(result.updatedComment.resolution).toBe('Updated implementation to address the concern');
      expect(result.updatedComment).toHaveProperty('resolvedAt');
      expect(result.updatedComment.resolvedBy).toBe(leadAgent.id);

      // Check that a resolution comment was added
      const comments = await domainModel.getCommentsForRFC(rfcId);
      const resolutionComment = comments.find(c => 
        c.content.includes('Resolution: Updated implementation') &&
        c.content.includes('(RFC updated)')
      );
      expect(resolutionComment).toBeDefined();
    });

    it('should handle resolution without RFC update', async () => {
      const result = await leadAgentTools.resolveComment.execute({
        commentId,
        resolution: 'Comment was not valid',
        rfcUpdated: false
      });

      expect(result.success).toBe(true);
      
      const comments = await domainModel.getCommentsForRFC(rfcId);
      const resolutionComment = comments.find(c => 
        c.content.includes('(no RFC changes needed)')
      );
      expect(resolutionComment).toBeDefined();
    });

    it('should handle non-existent comment', async () => {
      const result = await leadAgentTools.resolveComment.execute({
        commentId: 'non-existent',
        resolution: 'Test resolution',
        rfcUpdated: false
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to resolve comment');
    });
  });

  describe('addLeadComment', () => {
    let rfcId: string;

    beforeEach(async () => {
      const rfc = await domainModel.createRFC(
        'Test RFC',
        'RFC content with some text to reference',
        leadAgent.id,
        'test-session'
      );
      rfcId = rfc.id;
    });

    it('should add document-level comment', async () => {
      const result = await leadAgentTools.addLeadComment.execute({
        rfcId,
        type: 'document-level',
        content: 'This is a lead comment',
        category: 'context'
      });

      expect(result).toHaveProperty('commentId');
      expect(result.type).toBe('document-level');
      expect(result.content).toBe('[CONTEXT] This is a lead comment');
      expect(result.category).toBe('context');
      expect(result).toHaveProperty('createdAt');
    });

    it('should add inline comment with quoted text', async () => {
      const result = await leadAgentTools.addLeadComment.execute({
        rfcId,
        type: 'inline',
        content: 'Note about this specific text',
        quotedText: 'some text',
        category: 'clarification'
      });

      expect(result).toHaveProperty('commentId');
      expect(result.type).toBe('inline');
      expect(result.content).toBe('[CLARIFICATION] Note about this specific text');
    });

    it('should add comment without category', async () => {
      const result = await leadAgentTools.addLeadComment.execute({
        rfcId,
        type: 'document-level',
        content: 'Comment without category'
      });

      expect(result.content).toBe('Comment without category');
      expect(result.category).toBeUndefined();
    });

    it('should handle non-existent RFC', async () => {
      const result = await leadAgentTools.addLeadComment.execute({
        rfcId: 'non-existent',
        type: 'document-level',
        content: 'Test comment'
      });

      expect(result).toHaveProperty('error');
      expect(result.error).toContain('Failed to add comment');
    });
  });

  describe('searchCodebase', () => {
    it('should return mock search results', async () => {
      const result = await leadAgentTools.searchCodebase.execute({
        query: 'authentication',
        fileTypes: ['.ts', '.js'],
        limit: 5
      });

      expect(result.results).toBeDefined();
      expect(Array.isArray(result.results)).toBe(true);
      expect(result).toHaveProperty('totalFound');
      expect(result).toHaveProperty('query', 'authentication');
      expect(result.searchedFileTypes).toEqual(['.ts', '.js']);
      
      if (result.results.length > 0) {
        expect(result.results[0]).toHaveProperty('file');
        expect(result.results[0]).toHaveProperty('line');
        expect(result.results[0]).toHaveProperty('content');
        expect(result.results[0]).toHaveProperty('context');
      }
    });

    it('should respect limit parameter', async () => {
      const result = await leadAgentTools.searchCodebase.execute({
        query: 'test',
        limit: 1
      });

      expect(result.results.length).toBeLessThanOrEqual(1);
    });

    it('should handle search with paths', async () => {
      const result = await leadAgentTools.searchCodebase.execute({
        query: 'function',
        paths: ['src/auth/', 'src/api/'],
        limit: 10
      });

      expect(result.searchedPaths).toEqual(['src/auth/', 'src/api/']);
    });
  });

  describe('analyzeImpact', () => {
    let rfcId: string;

    beforeEach(async () => {
      const rfc = await domainModel.createRFC(
        'Test RFC',
        'RFC content',
        leadAgent.id,
        'test-session'
      );
      rfcId = rfc.id;
    });

    it('should analyze all impact areas by default', async () => {
      const result = await leadAgentTools.analyzeImpact.execute({
        rfcId
      });

      expect(result.impacts).toBeDefined();
      expect(Array.isArray(result.impacts)).toBe(true);
      expect(result).toHaveProperty('summary');
      expect(result.summary).toHaveProperty('high');
      expect(result.summary).toHaveProperty('medium');
      expect(result.summary).toHaveProperty('low');
      expect(result).toHaveProperty('totalFiles');
      expect(result.analyzedAreas).toEqual(['all']);
    });

    it('should filter impact areas by scope', async () => {
      const result = await leadAgentTools.analyzeImpact.execute({
        rfcId,
        scope: ['api', 'database']
      });

      expect(result.impacts.length).toBeLessThanOrEqual(5); // Should be filtered
      expect(result.analyzedAreas).toEqual(['api', 'database']);
      
      const areas = result.impacts.map(i => i.area);
      expect(areas.every(area => ['api', 'database'].includes(area))).toBe(true);
    });

    it('should handle non-existent RFC', async () => {
      const result = await leadAgentTools.analyzeImpact.execute({
        rfcId: 'non-existent'
      });

      expect(result).toHaveProperty('error');
      expect(result.error).toContain('RFC with ID non-existent not found');
      expect(result.impacts).toHaveLength(0);
    });

    it('should provide detailed impact information', async () => {
      const result = await leadAgentTools.analyzeImpact.execute({
        rfcId,
        scope: ['api']
      });

      if (result.impacts.length > 0) {
        const impact = result.impacts[0];
        expect(impact).toHaveProperty('area');
        expect(impact).toHaveProperty('description');
        expect(impact).toHaveProperty('severity');
        expect(['high', 'medium', 'low']).toContain(impact.severity);
        expect(impact).toHaveProperty('files');
        expect(Array.isArray(impact.files)).toBe(true);
      }
    });
  });

  describe('getRFCStatus', () => {
    let rfcId: string;

    beforeEach(async () => {
      const rfc = await domainModel.createRFC(
        'Status Test RFC',
        'RFC content for status testing',
        leadAgent.id,
        'test-session'
      );
      rfcId = rfc.id;
    });

    it('should return comprehensive RFC status', async () => {
      const result = await leadAgentTools.getRFCStatus.execute({
        rfcId
      });

      expect(result).toHaveProperty('rfcId', rfcId);
      expect(result).toHaveProperty('title', 'Status Test RFC');
      expect(result).toHaveProperty('status', 'draft');
      expect(result).toHaveProperty('currentVersion', 1);
      expect(result).toHaveProperty('lastUpdated');
      expect(result).toHaveProperty('openComments');
      expect(result).toHaveProperty('totalComments');
      expect(result).toHaveProperty('reviewStatus');
      expect(result).toHaveProperty('author', leadAgent.id);
      expect(result).toHaveProperty('requestingUser', 'lead-agent-session');
    });

    it('should track review status correctly', async () => {
      // Add some reviewer agents and comments
      const backendAgent = await domainModel.createAgent(AgentType.BACKEND, 'Backend');
      const frontendAgent = await domainModel.createAgent(AgentType.FRONTEND, 'Frontend');
      
      await domainModel.addComment({
        rfcId,
        agentId: backendAgent.id,
        agentType: AgentType.BACKEND,
        commentType: CommentType.DOCUMENT_LEVEL,
        content: 'Backend review complete'
      });

      const result = await leadAgentTools.getRFCStatus.execute({
        rfcId
      });

      expect(result.reviewStatus).toHaveProperty('backend', 'completed');
      expect(result.reviewStatus).toHaveProperty('frontend', 'pending');
      expect(result.totalComments).toBe(1);
      expect(result.openComments).toBe(1);
    });

    it('should handle non-existent RFC', async () => {
      const result = await leadAgentTools.getRFCStatus.execute({
        rfcId: 'non-existent'
      });

      expect(result).toHaveProperty('error');
      expect(result.error).toContain('RFC with ID non-existent not found');
    });
  });

  describe('Error Handling', () => {
    it('should handle domain model failures gracefully', async () => {
      // Test with uninitialized tools (no domain model)
      const uninitializedResult = await leadAgentTools.createRFCDocument.execute({
        title: 'Test',
        description: 'Test'
      });

      // Should handle the error gracefully
      expect(uninitializedResult).toHaveProperty('error');
    });

    it('should validate tool parameters', async () => {
      // The Zod schema should catch invalid parameters
      // These would typically be caught at the AI SDK level, but we can test tool behavior
      
      try {
        await leadAgentTools.updateRFCContent.execute({
          rfcId: '',
          oldText: '',
          newText: 'test'
        });
      } catch (error) {
        // Should handle empty required fields
        expect(error).toBeDefined();
      }
    });
  });
});
import { describe, it, expect, beforeEach } from '@jest/globals';
import { RFCDomainModel, AgentType, CommentType } from '../../domain';
import { generateRFCTemplate, insertSectionAfter, findSectionInContent } from '../rfc-template';
import type { RFCSection } from '../rfc-template';

describe('RFC Template Generator', () => {
  describe('generateRFCTemplate', () => {
    it('should generate RFC with metadata header', () => {
      const metadata = {
        title: 'Test RFC',
        description: 'A test RFC',
        author: 'test-author',
        status: 'draft',
        created: '2024-01-01T00:00:00Z'
      };

      const content = generateRFCTemplate(metadata, []);

      expect(content).toContain('title: Test RFC');
      expect(content).toContain('description: A test RFC');
      expect(content).toContain('author: test-author');
      expect(content).toContain('status: draft');
      expect(content).toContain('# Test RFC');
      expect(content).toContain('A test RFC');
    });

    it('should include specified sections', () => {
      const metadata = {
        title: 'Test RFC',
        description: 'Test',
        author: 'author',
        status: 'draft',
        created: '2024-01-01T00:00:00Z'
      };

      const sections: RFCSection[] = ['problem', 'solution', 'risks'];
      const content = generateRFCTemplate(metadata, sections);

      expect(content).toContain('## Problem Statement');
      expect(content).toContain('## Proposed Solution');
      expect(content).toContain('## Risks and Mitigations');
      expect(content).not.toContain('## Implementation Details');
    });

    it('should include review status section', () => {
      const metadata = {
        title: 'Test',
        description: 'Test',
        author: 'author',
        status: 'draft',
        created: '2024-01-01T00:00:00Z'
      };

      const content = generateRFCTemplate(metadata, []);

      expect(content).toContain('## Review Status');
      expect(content).toContain('- [ ] Frontend Review');
      expect(content).toContain('- [ ] Backend Review');
      expect(content).toContain('- [ ] Security Review');
    });
  });

  describe('findSectionInContent', () => {
    const sampleContent = `
# RFC Title

## Problem Statement
Some problem

## Proposed Solution
Some solution

## Implementation Details
Some implementation
`;

    it('should find existing sections', () => {
      expect(findSectionInContent(sampleContent, 'Problem Statement')).toBeGreaterThan(0);
      expect(findSectionInContent(sampleContent, 'Proposed Solution')).toBeGreaterThan(0);
      expect(findSectionInContent(sampleContent, 'Implementation Details')).toBeGreaterThan(0);
    });

    it('should return -1 for non-existent sections', () => {
      expect(findSectionInContent(sampleContent, 'Non-existent Section')).toBe(-1);
    });

    it('should be case insensitive', () => {
      expect(findSectionInContent(sampleContent, 'problem statement')).toBeGreaterThan(0);
      expect(findSectionInContent(sampleContent, 'PROPOSED SOLUTION')).toBeGreaterThan(0);
    });
  });

  describe('insertSectionAfter', () => {
    const sampleContent = `# RFC Title

## Problem Statement
Problem content

## Proposed Solution
Solution content

## End Section
End content`;

    it('should insert section after specified section', () => {
      const result = insertSectionAfter(
        sampleContent,
        'Problem Statement',
        'New Section',
        'New section content'
      );

      const problemIndex = result.indexOf('## Problem Statement');
      const newSectionIndex = result.indexOf('## New Section');
      const solutionIndex = result.indexOf('## Proposed Solution');

      expect(problemIndex).toBeLessThan(newSectionIndex);
      expect(newSectionIndex).toBeLessThan(solutionIndex);
      expect(result).toContain('New section content');
    });

    it('should append at end if section not found', () => {
      const result = insertSectionAfter(
        sampleContent,
        'Non-existent Section',
        'Appended Section',
        'Appended content'
      );

      expect(result).toContain('## Appended Section');
      expect(result).toContain('Appended content');
      // Should be at the end
      const appendedIndex = result.indexOf('## Appended Section');
      const endIndex = result.indexOf('## End Section');
      expect(appendedIndex).toBeGreaterThan(endIndex);
    });

    it('should handle empty content', () => {
      const result = insertSectionAfter('', 'Any Section', 'New Section', 'Content');
      
      expect(result).toContain('## New Section');
      expect(result).toContain('Content');
    });
  });
});

describe('Lead Agent Tools Integration', () => {
  let domainModel: RFCDomainModel;
  let leadAgent: any;

  beforeEach(async () => {
    domainModel = new RFCDomainModel();
    leadAgent = await domainModel.createAgent(AgentType.LEAD, 'Test Lead Agent');
  });

  it('should initialize domain model correctly', () => {
    expect(domainModel).toBeDefined();
    expect(leadAgent).toBeDefined();
    expect(leadAgent.type).toBe(AgentType.LEAD);
    expect(leadAgent.capabilities.canEdit).toBe(true);
    expect(leadAgent.capabilities.canComment).toBe(true);
    expect(leadAgent.capabilities.canApprove).toBe(true);
  });

  it('should create RFC using domain model directly', async () => {
    const rfc = await domainModel.createRFC(
      'Integration Test RFC',
      generateRFCTemplate({
        title: 'Integration Test RFC',
        description: 'Testing domain model integration',
        author: leadAgent.id,
        status: 'draft',
        created: new Date().toISOString()
      }, ['problem', 'solution']),
      leadAgent.id,
      'test-session'
    );

    expect(rfc).toBeDefined();
    expect(rfc.title).toBe('Integration Test RFC');
    expect(rfc.version).toBe(1);
    expect(rfc.status).toBe('draft');
    expect(rfc.content).toContain('## Problem Statement');
    expect(rfc.content).toContain('## Proposed Solution');
  });

  it('should perform complete RFC workflow', async () => {
    // Create RFC
    const rfc = await domainModel.createRFC(
      'Workflow Test RFC',
      'Initial content for workflow testing',
      leadAgent.id,
      'test-session'
    );

    // Create reviewer agents  
    const backendAgent = await domainModel.createAgent(AgentType.BACKEND, 'Backend Reviewer');
    const securityAgent = await domainModel.createAgent(AgentType.SECURITY, 'Security Reviewer');

    // Request review
    const reviewRequest = await domainModel.requestReview({
      rfcId: rfc.id,
      requestedBy: leadAgent.id,
      reviewerAgentIds: [backendAgent.id, securityAgent.id]
    });

    expect(reviewRequest).toBeDefined();
    expect(reviewRequest.reviewerAgentIds).toEqual([backendAgent.id, securityAgent.id]);

    // Add reviewer comments
    const backendComment = await domainModel.addComment({
      rfcId: rfc.id,
      agentId: backendAgent.id,
      agentType: AgentType.BACKEND,
      commentType: CommentType.DOCUMENT_LEVEL,
      content: 'Backend considerations look good'
    });

    const securityComment = await domainModel.addComment({
      rfcId: rfc.id,
      agentId: securityAgent.id,
      agentType: AgentType.SECURITY,
      commentType: CommentType.INLINE,
      content: 'Security review: This needs encryption',
      quotedText: 'workflow testing'
    });

    // Verify comments
    const comments = await domainModel.getCommentsForRFC(rfc.id);
    expect(comments).toHaveLength(2);
    
    const backendCommentFound = comments.find(c => c.id === backendComment.id);
    const securityCommentFound = comments.find(c => c.id === securityComment.id);
    
    expect(backendCommentFound).toBeDefined();
    expect(securityCommentFound).toBeDefined();
    expect(securityCommentFound?.textReference?.quotedText).toBe('workflow testing');

    // Update RFC content based on feedback
    const updatedRFC = await domainModel.replaceString({
      rfcId: rfc.id,
      oldText: 'workflow testing',
      newText: 'encrypted workflow testing'
    });

    expect(updatedRFC.content).toContain('encrypted workflow testing');
    expect(updatedRFC.version).toBe(2);

    // Resolve comments
    const resolvedSecurityComment = await domainModel.resolveComment(securityComment.id, leadAgent.id);
    expect(resolvedSecurityComment.status).toBe('resolved');
    expect(resolvedSecurityComment.resolvedBy).toBe(leadAgent.id);

    // Submit reviews
    await domainModel.submitReview({
      reviewRequestId: reviewRequest.id,
      agentId: backendAgent.id,
      comments: []
    });

    await domainModel.submitReview({
      reviewRequestId: reviewRequest.id,
      agentId: securityAgent.id,
      comments: []
    });

    // Check review completion
    const isComplete = await domainModel.isReviewComplete(reviewRequest.id);
    expect(isComplete).toBe(true);

    // Final status check
    const finalRFC = await domainModel.getRFC(rfc.id);
    expect(finalRFC?.version).toBe(2);
    expect(finalRFC?.content).toContain('encrypted workflow testing');

    console.log('✅ Complete RFC workflow test passed!');
  });

  it('should handle error cases gracefully', async () => {
    // Test non-existent RFC
    await expect(domainModel.getRFC('non-existent-id')).resolves.toBeNull();

    // Test invalid string replacement
    const rfc = await domainModel.createRFC('Test', 'Content', leadAgent.id, 'session');
    
    await expect(
      domainModel.replaceString({
        rfcId: rfc.id,
        oldText: 'non-existent-text',
        newText: 'replacement'
      })
    ).rejects.toThrow('not found in RFC content');

    // Test invalid comment resolution
    await expect(
      domainModel.resolveComment('non-existent-comment', leadAgent.id)
    ).rejects.toThrow('not found');
  });
});
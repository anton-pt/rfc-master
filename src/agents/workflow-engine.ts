import { LeadAgent, ActionIntent, ActionType } from './lead-agent';
import { RFCDomainModel } from '../domain';

/**
 * Workflow patterns for common RFC operations
 */
export interface WorkflowPattern {
  name: string;
  description: string;
  steps: WorkflowStep[];
}

export interface WorkflowStep {
  action: ActionType;
  description: string;
  toolName?: string;
  params?: Record<string, any>;
  condition?: (context: any) => boolean;
}

/**
 * Workflow execution context
 */
export interface WorkflowContext {
  userRequest: string;
  rfcId?: string;
  searchResults?: any[];
  impactAnalysis?: any;
  reviewComments?: any[];
  errors: string[];
  metadata: Record<string, any>;
}

/**
 * Workflow execution result
 */
export interface WorkflowResult {
  success: boolean;
  completedSteps: string[];
  errors: string[];
  context: WorkflowContext;
  suggestions: string[];
}

/**
 * Workflow Engine - orchestrates complex RFC operations
 */
export class WorkflowEngine {
  private patterns: Map<string, WorkflowPattern> = new Map();

  constructor() {
    this.initializePatterns();
  }

  /**
   * Initialize common workflow patterns
   */
  private initializePatterns(): void {
    // RFC Creation Pattern
    this.patterns.set('CREATE_RFC', {
      name: 'Create RFC',
      description: 'Complete RFC creation with context gathering and impact analysis',
      steps: [
        {
          action: 'SEARCH_CONTEXT',
          description: 'Search codebase for relevant context',
          toolName: 'searchCodebase'
        },
        {
          action: 'ANALYZE_IMPACT',
          description: 'Analyze potential impact of changes',
          toolName: 'analyzeImpact'
        },
        {
          action: 'CREATE_RFC',
          description: 'Create initial RFC document',
          toolName: 'createRFCDocument'
        },
        {
          action: 'MODIFY_RFC',
          description: 'Add detailed content based on context',
          toolName: 'updateRFCContent'
        }
      ]
    });

    // Review Request Pattern
    this.patterns.set('REQUEST_REVIEW', {
      name: 'Request Review',
      description: 'Coordinate review process with appropriate reviewers',
      steps: [
        {
          action: 'ANALYZE_IMPACT',
          description: 'Analyze RFC to determine reviewer types needed',
          toolName: 'analyzeImpact'
        },
        {
          action: 'REQUEST_REVIEW',
          description: 'Request review from appropriate agents',
          toolName: 'requestReview'
        }
      ]
    });

    // Feedback Processing Pattern
    this.patterns.set('PROCESS_FEEDBACK', {
      name: 'Process Feedback',
      description: 'Gather and process reviewer feedback systematically',
      steps: [
        {
          action: 'PROCESS_FEEDBACK',
          description: 'Get pending review comments',
          toolName: 'getReviewComments'
        },
        {
          action: 'MODIFY_RFC',
          description: 'Update RFC based on feedback',
          toolName: 'updateRFCContent'
        },
        {
          action: 'PROCESS_FEEDBACK',
          description: 'Resolve addressed comments',
          toolName: 'resolveComment'
        }
      ]
    });

    // Context Gathering Pattern
    this.patterns.set('GATHER_CONTEXT', {
      name: 'Gather Context',
      description: 'Comprehensive context gathering for RFC improvement',
      steps: [
        {
          action: 'SEARCH_CONTEXT',
          description: 'Search for implementation context',
          toolName: 'searchCodebase'
        },
        {
          action: 'ANALYZE_IMPACT',
          description: 'Analyze implementation impact',
          toolName: 'analyzeImpact'
        }
      ]
    });

    // RFC Enhancement Pattern
    this.patterns.set('ENHANCE_RFC', {
      name: 'Enhance RFC',
      description: 'Improve RFC with additional context and analysis',
      steps: [
        {
          action: 'SEARCH_CONTEXT',
          description: 'Search for additional relevant context',
          toolName: 'searchCodebase'
        },
        {
          action: 'MODIFY_RFC',
          description: 'Update RFC with new insights',
          toolName: 'updateRFCContent'
        },
        {
          action: 'ANALYZE_IMPACT',
          description: 'Re-analyze impact with updated content',
          toolName: 'analyzeImpact'
        }
      ]
    });
  }

  /**
   * Determine which workflow pattern to use based on user intent
   */
  determineWorkflow(userRequest: string, currentRFCExists: boolean = false): WorkflowPattern | null {
    const request = userRequest.toLowerCase();

    // RFC Creation patterns
    if (request.includes('create') || request.includes('write') || request.includes('new rfc')) {
      return this.patterns.get('CREATE_RFC')!;
    }

    // Review patterns
    if (request.includes('review') || request.includes('feedback')) {
      if (!currentRFCExists) {
        return null; // Can't review without an RFC
      }
      return request.includes('request') ? 
        this.patterns.get('REQUEST_REVIEW')! : 
        this.patterns.get('PROCESS_FEEDBACK')!;
    }

    // Context gathering patterns
    if (request.includes('context') || request.includes('search') || request.includes('analyze')) {
      return this.patterns.get('GATHER_CONTEXT')!;
    }

    // Enhancement patterns
    if (request.includes('improve') || request.includes('enhance') || request.includes('update')) {
      if (currentRFCExists) {
        return this.patterns.get('ENHANCE_RFC')!;
      }
    }

    return null;
  }

  /**
   * Execute a workflow pattern
   */
  async executeWorkflow(
    pattern: WorkflowPattern,
    context: WorkflowContext,
    agent: LeadAgent
  ): Promise<WorkflowResult> {
    const result: WorkflowResult = {
      success: true,
      completedSteps: [],
      errors: [...context.errors],
      context,
      suggestions: []
    };

    console.log(`🔄 Executing workflow: ${pattern.name}`);

    for (const step of pattern.steps) {
      try {
        // Check step condition if present
        if (step.condition && !step.condition(result.context)) {
          console.log(`⏭️  Skipping step: ${step.description} (condition not met)`);
          continue;
        }

        console.log(`🔧 Executing step: ${step.description}`);

        // Execute the step based on action type
        const stepResult = await this.executeStep(step, result.context, agent);
        
        if (stepResult.success) {
          result.completedSteps.push(step.description);
          result.context = { ...result.context, ...stepResult.context };
        } else {
          result.errors.push(`Step failed: ${step.description} - ${stepResult.error}`);
          console.error(`❌ Step failed: ${step.description}`, stepResult.error);
        }

      } catch (error) {
        const errorMessage = `Workflow step error: ${step.description} - ${error instanceof Error ? error.message : 'Unknown error'}`;
        result.errors.push(errorMessage);
        result.success = false;
        console.error('❌', errorMessage);
      }
    }

    // Generate suggestions based on workflow completion
    result.suggestions = this.generateWorkflowSuggestions(pattern, result);

    console.log(`✅ Workflow ${pattern.name} completed. Success: ${result.success}`);
    return result;
  }

  /**
   * Execute a single workflow step
   */
  private async executeStep(
    step: WorkflowStep, 
    context: WorkflowContext,
    agent: LeadAgent
  ): Promise<{ success: boolean; context?: Partial<WorkflowContext>; error?: string }> {
    
    switch (step.action) {
      case 'SEARCH_CONTEXT':
        return await this.executeSearchStep(context);

      case 'ANALYZE_IMPACT':
        return await this.executeAnalysisStep(context);

      case 'CREATE_RFC':
        return await this.executeCreateRFCStep(context);

      case 'MODIFY_RFC':
        return await this.executeModifyRFCStep(context);

      case 'REQUEST_REVIEW':
        return await this.executeRequestReviewStep(context);

      case 'PROCESS_FEEDBACK':
        return await this.executeProcessFeedbackStep(context);

      default:
        return { 
          success: false, 
          error: `Unknown step action: ${step.action}` 
        };
    }
  }

  /**
   * Execute search context step
   */
  private async executeSearchStep(context: WorkflowContext): Promise<any> {
    try {
      // Extract search terms from user request
      const searchTerms = this.extractSearchTerms(context.userRequest);
      
      // This would use the searchCodebase tool
      const searchResults = await this.mockSearchCodebase(searchTerms);
      
      return {
        success: true,
        context: {
          searchResults,
          metadata: { ...context.metadata, searchTerms }
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Search failed'
      };
    }
  }

  /**
   * Execute impact analysis step
   */
  private async executeAnalysisStep(context: WorkflowContext): Promise<any> {
    try {
      // This would use the analyzeImpact tool
      const impactAnalysis = await this.mockAnalyzeImpact(context);
      
      return {
        success: true,
        context: {
          impactAnalysis,
          metadata: { ...context.metadata, impactAnalyzed: true }
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Impact analysis failed'
      };
    }
  }

  /**
   * Execute RFC creation step
   */
  private async executeCreateRFCStep(context: WorkflowContext): Promise<any> {
    try {
      // This would use the createRFCDocument tool
      const rfcId = await this.mockCreateRFC(context);
      
      return {
        success: true,
        context: {
          rfcId,
          metadata: { ...context.metadata, rfcCreated: true }
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'RFC creation failed'
      };
    }
  }

  /**
   * Execute RFC modification step
   */
  private async executeModifyRFCStep(context: WorkflowContext): Promise<any> {
    try {
      if (!context.rfcId) {
        return {
          success: false,
          error: 'No RFC ID available for modification'
        };
      }

      // This would use the updateRFCContent tool
      await this.mockUpdateRFC(context);
      
      return {
        success: true,
        context: {
          metadata: { ...context.metadata, rfcUpdated: true }
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'RFC update failed'
      };
    }
  }

  /**
   * Execute request review step
   */
  private async executeRequestReviewStep(context: WorkflowContext): Promise<any> {
    try {
      if (!context.rfcId) {
        return {
          success: false,
          error: 'No RFC ID available for review request'
        };
      }

      // Determine reviewer types based on impact analysis
      const reviewerTypes = this.determineReviewerTypes(context.impactAnalysis);
      
      // This would use the requestReview tool
      const reviewRequestId = await this.mockRequestReview(context.rfcId, reviewerTypes);
      
      return {
        success: true,
        context: {
          metadata: { 
            ...context.metadata, 
            reviewRequested: true,
            reviewRequestId,
            reviewerTypes
          }
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Review request failed'
      };
    }
  }

  /**
   * Execute process feedback step
   */
  private async executeProcessFeedbackStep(context: WorkflowContext): Promise<any> {
    try {
      if (!context.rfcId) {
        return {
          success: false,
          error: 'No RFC ID available for feedback processing'
        };
      }

      // This would use the getReviewComments tool
      const reviewComments = await this.mockGetReviewComments(context.rfcId);
      
      return {
        success: true,
        context: {
          reviewComments,
          metadata: { ...context.metadata, feedbackProcessed: true }
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Feedback processing failed'
      };
    }
  }

  /**
   * Generate suggestions based on workflow completion
   */
  private generateWorkflowSuggestions(pattern: WorkflowPattern, result: WorkflowResult): string[] {
    const suggestions: string[] = [];

    switch (pattern.name) {
      case 'Create RFC':
        if (result.success) {
          suggestions.push('Request reviews from relevant teams');
          suggestions.push('Add more detailed implementation steps');
          suggestions.push('Consider alternative approaches');
        } else {
          suggestions.push('Try creating a simpler RFC first');
          suggestions.push('Provide more context about the problem');
        }
        break;

      case 'Request Review':
        if (result.success) {
          suggestions.push('Wait for reviewer feedback');
          suggestions.push('Add clarifying comments to complex sections');
        } else {
          suggestions.push('Check if RFC is complete enough for review');
          suggestions.push('Manually specify reviewer types');
        }
        break;

      case 'Process Feedback':
        if (result.success) {
          suggestions.push('Request additional reviews if needed');
          suggestions.push('Finalize RFC for implementation');
        } else {
          suggestions.push('Check for pending review comments');
          suggestions.push('Address reviewer concerns manually');
        }
        break;
    }

    return suggestions;
  }

  // Mock implementations (replace with real tool calls)
  private async mockSearchCodebase(searchTerms: string[]): Promise<any[]> {
    return [{
      file: 'src/api/auth.ts',
      line: 15,
      content: 'export function authenticateUser()',
      context: ['// User authentication logic', 'export function authenticateUser() {']
    }];
  }

  private async mockAnalyzeImpact(context: WorkflowContext): Promise<any> {
    return {
      impacts: [
        { area: 'api', severity: 'medium', description: 'API changes required' },
        { area: 'database', severity: 'low', description: 'Schema updates needed' }
      ]
    };
  }

  private async mockCreateRFC(context: WorkflowContext): Promise<string> {
    return 'rfc-' + Date.now();
  }

  private async mockUpdateRFC(context: WorkflowContext): Promise<void> {
    // Mock implementation
  }

  private async mockRequestReview(rfcId: string, reviewerTypes: string[]): Promise<string> {
    return 'review-' + Date.now();
  }

  private async mockGetReviewComments(rfcId: string): Promise<any[]> {
    return [];
  }

  /**
   * Extract search terms from user request
   */
  private extractSearchTerms(request: string): string[] {
    // Simple keyword extraction - could be enhanced with NLP
    const commonTerms = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'];
    return request
      .toLowerCase()
      .split(/\s+/)
      .filter(word => word.length > 3 && !commonTerms.includes(word))
      .slice(0, 5); // Limit to 5 terms
  }

  /**
   * Determine reviewer types based on impact analysis
   */
  private determineReviewerTypes(impactAnalysis?: any): string[] {
    if (!impactAnalysis) return ['backend'];

    const reviewers: string[] = [];
    impactAnalysis.impacts?.forEach((impact: any) => {
      switch (impact.area) {
        case 'api':
        case 'database':
          reviewers.push('backend');
          break;
        case 'ui':
        case 'frontend':
          reviewers.push('frontend');
          break;
        case 'security':
        case 'auth':
          reviewers.push('security');
          break;
        case 'infrastructure':
        case 'deployment':
          reviewers.push('infrastructure');
          break;
      }
    });

    return [...new Set(reviewers)]; // Remove duplicates
  }
}

/**
 * Factory function to create workflow engine
 */
export function createWorkflowEngine(): WorkflowEngine {
  return new WorkflowEngine();
}
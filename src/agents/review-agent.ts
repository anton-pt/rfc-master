import { LanguageModel } from "ai";
import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";
import { AgentType, CommentType, CommentStatus } from "../domain";
import { log } from "../utils/logging";

// Review context interface - complete context package for review agents
export interface ReviewContext {
  // The codebase being modified
  codebase: {
    filename: string;
    content: string;
    language: string;
    lineCount: number;
    size: number;
  };
  
  // Current RFC state
  rfc: {
    id: string;
    title: string;
    content: string;
    version: number;
    sections: string[];
  };
  
  // Existing comments to avoid duplication
  existingComments: Array<{
    id: string;
    agentType: string;
    type: 'inline' | 'document-level';
    quotedText?: string;
    content: string;
    status: 'open' | 'resolved' | 'dismissed';
    threadId?: string;
    severity?: string;
    category?: string;
  }>;
  
  // Review parameters
  reviewRequest: {
    focusAreas?: string[];
    specificConcerns?: string;
    reviewerType: 'backend' | 'frontend' | 'security' | 'database' | 'infrastructure';
  };
}

// Individual comment structure
export interface ReviewComment {
  type: 'inline' | 'document-level';
  
  // For inline comments
  quotedText?: string;
  lineReference?: string; // e.g., "RFC line 42" or "todo.ts line 89"
  
  // Comment content
  content: string;
  severity: 'critical' | 'major' | 'minor' | 'suggestion' | 'praise';
  
  // Threading
  inReplyTo?: string; // Comment ID if replying to existing
  
  // Metadata
  category: string; // e.g., "performance", "security", "maintainability"
  suggestedChange?: string; // Concrete improvement suggestion
}

// Review agent response
export interface ReviewResponse {
  agentType: string;
  overallRecommendation: 'approve' | 'needs-work' | 'reject' | 'abstain';
  summary: string;
  comments: ReviewComment[];
  reviewDuration: number;
  focusAreasAnalyzed: string[];
}

// Review agent configuration
export interface ReviewAgentConfig {
  model: LanguageModel;
  temperature: number;
  maxTokens: number;
  agentType: string;
}

/**
 * Specialized Review Agent Class
 * 
 * Each review agent focuses on a specific domain (backend, frontend, security, etc.)
 * and provides structured feedback on RFCs with comprehensive logging.
 */
export class ReviewAgent {
  private config: ReviewAgentConfig;
  private agentId: string;
  private logger: any;

  constructor(config: ReviewAgentConfig) {
    this.config = config;
    this.agentId = `${config.agentType}-reviewer`;
    this.logger = log.agent(this.agentId);
  }

  /**
   * Main review method - analyzes RFC and generates structured comments
   */
  async review(context: ReviewContext): Promise<ReviewResponse> {
    const reviewStartTime = Date.now();
    
    console.log(`\n🔍 [${new Date().toISOString()}] REVIEW AGENT START: ${this.config.agentType.toUpperCase()}`);
    console.log(`   🎯 RFC: "${context.rfc.title}" (v${context.rfc.version})`);
    console.log(`   📊 Codebase: ${context.codebase.lineCount} lines of ${context.codebase.language}`);
    console.log(`   💬 Existing Comments: ${context.existingComments.length}`);
    console.log(`   🔧 Focus Areas: ${this.getFocusAreas().length} areas`);
    
    try {
      // Build specialized system prompt
      const systemPrompt = this.buildSystemPrompt(context);
      const reviewRequest = this.buildReviewRequest(context);
      
      console.log(`   🧠 Generating ${this.config.agentType} review...`);
      
      // Generate review using AI model
      const result = await generateText({
        model: this.config.model,
        system: systemPrompt,
        messages: [{
          role: 'user',
          content: reviewRequest
        }],
        temperature: this.config.temperature,
        maxTokens: this.config.maxTokens,
      });

      // Parse and validate response
      const reviewResponse = this.parseReviewResponse(result.text, context);
      reviewResponse.reviewDuration = Date.now() - reviewStartTime;
      reviewResponse.focusAreasAnalyzed = this.getFocusAreas();
      
      console.log(`\n✅ [${new Date().toISOString()}] REVIEW COMPLETE: ${this.config.agentType.toUpperCase()}`);
      console.log(`   ⏱️  Duration: ${reviewResponse.reviewDuration}ms`);
      console.log(`   📊 Recommendation: ${reviewResponse.overallRecommendation}`);
      console.log(`   💬 Comments Generated: ${reviewResponse.comments.length}`);
      console.log(`   🎯 Focus Areas: ${reviewResponse.focusAreasAnalyzed.join(', ')}`);
      
      this.logCommentSummary(reviewResponse.comments);
      
      return reviewResponse;
      
    } catch (error) {
      const duration = Date.now() - reviewStartTime;
      console.error(`\n❌ [${new Date().toISOString()}] REVIEW AGENT ERROR: ${this.config.agentType.toUpperCase()}`);
      console.error(`   💥 Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      console.error(`   ⏱️  Duration: ${duration}ms`);
      
      // Return fallback response
      return {
        agentType: this.config.agentType,
        overallRecommendation: 'abstain',
        summary: `Review failed due to error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        comments: [],
        reviewDuration: duration,
        focusAreasAnalyzed: []
      };
    }
  }

  /**
   * Build specialized system prompt based on agent type and context
   */
  private buildSystemPrompt(context: ReviewContext): string {
    const specialistFocus = this.getSpecialistFocus();
    const focusAreas = this.getFocusAreas();
    
    return `# ${this.config.agentType.toUpperCase()} Review Agent

You are a ${this.config.agentType} specialist reviewing an RFC for technical changes to a codebase.

## Codebase Under Review
\`\`\`${context.codebase.language}
// ${context.codebase.filename} (${context.codebase.lineCount} lines)
${context.codebase.content}
\`\`\`

## RFC Being Reviewed
${context.rfc.content}

## Existing Comments (${context.existingComments.length} total)
${this.formatExistingComments(context.existingComments)}

## Your Specialist Role
As a ${this.config.agentType} specialist, you should focus on:
${specialistFocus}

## Review Guidelines
1. **Reference Specific Lines**: Always reference specific line numbers from both RFC and codebase
2. **Build on Existing**: Don't duplicate existing comments, but you can build on them with replies
3. **Actionable Feedback**: Provide concrete, implementable suggestions
4. **Impact Assessment**: Consider feasibility and impact of proposed changes
5. **Code Quality**: Focus on maintainability, performance, and best practices

## Severity Levels
- **critical**: Must fix before implementation (security, breaking changes)
- **major**: Should fix, significant impact on system/users
- **minor**: Nice to fix, small impact
- **suggestion**: Optional improvement
- **praise**: Positive reinforcement for good design

## Focus Areas for This Review
${focusAreas.map(area => `- ${area}`).join('\n')}

${context.reviewRequest.specificConcerns ? 
  `## Specific Concerns to Address\n${context.reviewRequest.specificConcerns}` : ''}

## Response Format
You MUST respond with valid JSON in this exact format:
{
  "overallRecommendation": "approve|needs-work|reject|abstain",
  "summary": "Brief overall assessment (2-3 sentences)",
  "comments": [
    {
      "type": "inline|document-level",
      "quotedText": "exact text from RFC or code (for inline comments)",
      "lineReference": "RFC line 42 or todo.ts line 89",
      "content": "Your comment content",
      "severity": "critical|major|minor|suggestion|praise",
      "category": "performance|security|maintainability|etc",
      "suggestedChange": "concrete improvement suggestion (optional)",
      "inReplyTo": "comment-id (if replying to existing comment)"
    }
  ]
}`;
  }

  /**
   * Build the review request prompt
   */
  private buildReviewRequest(context: ReviewContext): string {
    return `Please review this RFC from your ${this.config.agentType} specialist perspective.

RFC Title: "${context.rfc.title}"

Focus on your areas of expertise and provide structured feedback that will help improve the RFC's technical quality and implementation feasibility.

Remember to:
- Reference specific code lines and RFC sections
- Avoid duplicating existing comments
- Provide actionable suggestions
- Consider the impact on ${this.config.agentType} concerns

Return your response as valid JSON only.`;
  }

  /**
   * Parse AI response into structured ReviewResponse
   */
  private parseReviewResponse(responseText: string, context: ReviewContext): ReviewResponse {
    try {
      // Extract JSON from response (handle cases where AI adds extra text)
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No valid JSON found in response');
      }
      
      const parsed = JSON.parse(jsonMatch[0]);
      
      // Validate required fields
      if (!parsed.overallRecommendation || !parsed.summary || !Array.isArray(parsed.comments)) {
        throw new Error('Invalid response structure');
      }
      
      // Process and validate comments
      const validatedComments = parsed.comments.map((comment: any, index: number) => {
        // Validate comment structure
        if (!comment.content || !comment.severity) {
          console.warn(`   ⚠️  Comment ${index + 1}: Missing required fields, skipping`);
          return null;
        }
        
        // Check for duplication with existing comments
        if (this.isDuplicateComment(comment, context.existingComments)) {
          console.log(`   🔄 Comment ${index + 1}: Similar to existing comment, skipping`);
          return null;
        }
        
        // Set defaults and validate
        return {
          type: comment.type || 'document-level',
          quotedText: comment.quotedText,
          lineReference: comment.lineReference,
          content: comment.content,
          severity: comment.severity,
          category: comment.category || this.config.agentType,
          suggestedChange: comment.suggestedChange,
          inReplyTo: comment.inReplyTo
        };
      }).filter((comment: any) => comment !== null);
      
      return {
        agentType: this.config.agentType,
        overallRecommendation: parsed.overallRecommendation,
        summary: parsed.summary,
        comments: validatedComments,
        reviewDuration: 0, // Will be set by caller
        focusAreasAnalyzed: [] // Will be set by caller
      };
      
    } catch (error) {
      console.error(`   💥 Failed to parse review response: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      // Return fallback response with summary from raw text
      return {
        agentType: this.config.agentType,
        overallRecommendation: 'abstain',
        summary: `Review parsing failed. Raw response: ${responseText.substring(0, 200)}...`,
        comments: [],
        reviewDuration: 0,
        focusAreasAnalyzed: []
      };
    }
  }

  /**
   * Get specialist focus areas based on agent type
   */
  private getSpecialistFocus(): string {
    const focusMap: Record<string, string> = {
      backend: `
- API design and contracts
- Data flow and state management  
- Error handling and recovery
- Performance and scalability
- Service boundaries and dependencies
- Database interactions
- Business logic implementation`,

      frontend: `
- User experience impact
- UI component changes
- State management on client
- Accessibility implications
- Breaking changes for users
- Performance impact on user interactions
- Component architecture`,

      security: `
- Authentication and authorization
- Data validation and sanitization
- Potential vulnerabilities
- Security best practices
- Compliance requirements
- Input validation
- Data exposure risks`,

      database: `
- Schema changes and migrations
- Query performance
- Data integrity
- Transaction handling
- Indexing strategies
- Data consistency
- Migration safety`,

      infrastructure: `
- Deployment implications
- Resource requirements
- Monitoring and observability
- Rollback strategies
- System dependencies
- Scalability considerations
- Operational impact`
    };

    return focusMap[this.config.agentType] || 'General code quality and maintainability';
  }

  /**
   * Get focus areas for this agent type
   */
  private getFocusAreas(): string[] {
    const areaMap: Record<string, string[]> = {
      backend: ['API Design', 'Performance', 'Error Handling', 'Data Flow', 'Scalability'],
      frontend: ['User Experience', 'Accessibility', 'Performance', 'Component Design', 'State Management'],
      security: ['Authentication', 'Authorization', 'Input Validation', 'Data Protection', 'Vulnerabilities'],
      database: ['Schema Design', 'Query Performance', 'Migrations', 'Data Integrity', 'Transactions'],
      infrastructure: ['Deployment', 'Monitoring', 'Scalability', 'Dependencies', 'Operations']
    };

    return areaMap[this.config.agentType] || ['Code Quality', 'Maintainability'];
  }

  /**
   * Format existing comments for context
   */
  private formatExistingComments(comments: ReviewContext['existingComments']): string {
    if (comments.length === 0) {
      return 'No existing comments.';
    }

    return comments.map((comment, index) => {
      const severity = comment.severity ? ` [${comment.severity}]` : '';
      const category = comment.category ? ` (${comment.category})` : '';
      const quoted = comment.quotedText ? `\n   Quoted: "${comment.quotedText}"` : '';
      
      return `${index + 1}. ${comment.agentType}${severity}${category}: ${comment.content}${quoted}`;
    }).join('\n');
  }

  /**
   * Check if a comment is too similar to existing ones
   */
  private isDuplicateComment(newComment: any, existingComments: ReviewContext['existingComments']): boolean {
    const newContent = newComment.content.toLowerCase();
    
    return existingComments.some(existing => {
      const existingContent = existing.content.toLowerCase();
      
      // Simple similarity check - could be enhanced with more sophisticated algorithms
      const similarity = this.calculateSimilarity(newContent, existingContent);
      return similarity > 0.7; // 70% similarity threshold
    });
  }

  /**
   * Calculate simple similarity between two strings
   */
  private calculateSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const distance = this.levenshteinDistance(longer, shorter);
    return (longer.length - distance) / longer.length;
  }

  /**
   * Calculate Levenshtein distance for similarity
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
    
    for (let i = 0; i <= str1.length; i += 1) {
      matrix[0][i] = i;
    }
    
    for (let j = 0; j <= str2.length; j += 1) {
      matrix[j][0] = j;
    }
    
    for (let j = 1; j <= str2.length; j += 1) {
      for (let i = 1; i <= str1.length; i += 1) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,
          matrix[j - 1][i] + 1,
          matrix[j - 1][i - 1] + indicator
        );
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  /**
   * Log summary of generated comments
   */
  private logCommentSummary(comments: ReviewComment[]): void {
    if (comments.length === 0) {
      console.log(`   📝 No comments generated`);
      return;
    }

    const severityCounts = comments.reduce((acc, comment) => {
      acc[comment.severity] = (acc[comment.severity] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const typeCounts = comments.reduce((acc, comment) => {
      acc[comment.type] = (acc[comment.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    console.log(`   📝 Comment Breakdown:`);
    console.log(`      🎯 Types: ${Object.entries(typeCounts).map(([k, v]) => `${k}: ${v}`).join(', ')}`);
    console.log(`      ⚠️  Severity: ${Object.entries(severityCounts).map(([k, v]) => `${k}: ${v}`).join(', ')}`);
    
    // Log critical comments
    const criticalComments = comments.filter(c => c.severity === 'critical');
    if (criticalComments.length > 0) {
      console.log(`   🚨 Critical Issues: ${criticalComments.length}`);
      criticalComments.forEach((comment, index) => {
        console.log(`      ${index + 1}. ${comment.content.substring(0, 100)}...`);
      });
    }
  }
}

/**
 * Factory function to create review agents
 */
export function createReviewAgent(
  agentType: 'backend' | 'frontend' | 'security' | 'database' | 'infrastructure',
  options: Partial<ReviewAgentConfig> = {}
): ReviewAgent {
  const defaultConfig: ReviewAgentConfig = {
    model: openai("gpt-4o"),
    temperature: 0.5, // Lower temperature for more consistent reviews
    maxTokens: 3000, // Larger token limit for detailed reviews
    agentType
  };

  const config = { ...defaultConfig, ...options };
  return new ReviewAgent(config);
}

/**
 * Review summary interface for aggregating results
 */
export interface ReviewSummary {
  totalReviews: number;
  recommendations: Record<string, number>;
  totalComments: number;
  severityBreakdown: Record<string, number>;
  averageReviewTime: number;
  reviewerTypes: string[];
  overallRecommendation: string;
  criticalIssues: number;
}

/**
 * Aggregate multiple review responses into summary
 */
export function aggregateReviews(reviews: ReviewResponse[]): ReviewSummary {
  if (reviews.length === 0) {
    return {
      totalReviews: 0,
      recommendations: {},
      totalComments: 0,
      severityBreakdown: {},
      averageReviewTime: 0,
      reviewerTypes: [],
      overallRecommendation: 'no-reviews',
      criticalIssues: 0
    };
  }

  const recommendations = reviews.reduce((acc, review) => {
    acc[review.overallRecommendation] = (acc[review.overallRecommendation] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const allComments = reviews.flatMap(review => review.comments);
  const severityBreakdown = allComments.reduce((acc, comment) => {
    acc[comment.severity] = (acc[comment.severity] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const averageReviewTime = reviews.reduce((sum, review) => sum + review.reviewDuration, 0) / reviews.length;
  const criticalIssues = allComments.filter(c => c.severity === 'critical').length;

  // Determine overall recommendation based on individual reviews
  let overallRecommendation = 'approve';
  if (recommendations['reject'] > 0 || criticalIssues > 0) {
    overallRecommendation = 'reject';
  } else if (recommendations['needs-work'] > reviews.length / 2) {
    overallRecommendation = 'needs-work';
  }

  return {
    totalReviews: reviews.length,
    recommendations,
    totalComments: allComments.length,
    severityBreakdown,
    averageReviewTime,
    reviewerTypes: reviews.map(r => r.agentType),
    overallRecommendation,
    criticalIssues
  };
}
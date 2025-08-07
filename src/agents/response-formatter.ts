import { RFC, Comment } from '../domain';
import { AgentResponse } from './lead-agent';

/**
 * Response formatting utilities for the Lead Agent
 */
export class ResponseFormatter {
  
  /**
   * Format an RFC artifact for display
   */
  static formatRFCArtifact(rfc: RFC): string {
    const sections = [
      `# ${rfc.title}`,
      '',
      `**Status:** ${rfc.status} | **Version:** ${rfc.version} | **Author:** ${rfc.author}`,
      `**Created:** ${rfc.createdAt.toISOString().split('T')[0]} | **Updated:** ${rfc.updatedAt.toISOString().split('T')[0]}`,
      '',
      '---',
      '',
      rfc.content
    ];

    return sections.join('\n');
  }

  /**
   * Format review summary for display
   */
  static formatReviewSummary(summary: any): string {
    if (!summary) return '';

    const sections = [
      '## 📋 Review Summary',
      '',
      `**Total Comments:** ${summary.totalComments}`,
      `**Open:** ${summary.openComments} | **Resolved:** ${summary.resolvedComments}`,
      ''
    ];

    if (summary.bySeverity) {
      sections.push('**By Severity:**');
      Object.entries(summary.bySeverity).forEach(([severity, count]) => {
        const emoji = ResponseFormatter.getSeverityEmoji(severity);
        sections.push(`- ${emoji} ${severity}: ${count}`);
      });
      sections.push('');
    }

    if (summary.byAgent) {
      sections.push('**By Reviewer:**');
      Object.entries(summary.byAgent).forEach(([agent, count]) => {
        const emoji = ResponseFormatter.getAgentEmoji(agent);
        sections.push(`- ${emoji} ${agent}: ${count} comments`);
      });
      sections.push('');
    }

    return sections.join('\n');
  }

  /**
   * Format action list for display
   */
  static formatActions(actions: string[]): string {
    if (actions.length === 0) return '';

    const sections = [
      '## 🔧 Actions Performed',
      ''
    ];

    actions.forEach((action, index) => {
      const emoji = ResponseFormatter.getActionEmoji(action);
      sections.push(`${index + 1}. ${emoji} ${action}`);
    });

    sections.push('');
    return sections.join('\n');
  }

  /**
   * Format suggestions for display
   */
  static formatSuggestions(suggestions: string[]): string {
    if (suggestions.length === 0) return '';

    const sections = [
      '## 💡 Suggested Next Steps',
      ''
    ];

    suggestions.forEach((suggestion, index) => {
      sections.push(`${index + 1}. ${suggestion}`);
    });

    sections.push('');
    return sections.join('\n');
  }

  /**
   * Format search results for display
   */
  static formatSearchResults(results: any[]): string {
    if (!results || results.length === 0) return '';

    const sections = [
      '## 🔍 Codebase Context',
      ''
    ];

    results.slice(0, 5).forEach((result, index) => {
      sections.push(`**${index + 1}. ${result.file}:${result.line}**`);
      sections.push('```typescript');
      
      // Add context lines
      if (result.context?.before) {
        result.context.before.forEach((line: string) => {
          sections.push(line);
        });
      }
      
      sections.push(`> ${result.matchedLine}`); // Highlight matched line
      
      if (result.context?.after) {
        result.context.after.forEach((line: string) => {
          sections.push(line);
        });
      }
      
      sections.push('```');
      
      if (result.metaJoke) {
        sections.push(`*${result.metaJoke}*`);
      }
      
      sections.push('');
    });

    return sections.join('\n');
  }

  /**
   * Format impact analysis for display
   */
  static formatImpactAnalysis(analysis: any): string {
    if (!analysis || !analysis.impacts) return '';

    const sections = [
      '## 📊 Impact Analysis',
      ''
    ];

    // Summary
    if (analysis.summary) {
      sections.push('**Impact Summary:**');
      Object.entries(analysis.summary).forEach(([severity, count]) => {
        if (count > 0) {
          const emoji = ResponseFormatter.getSeverityEmoji(severity);
          sections.push(`- ${emoji} ${severity}: ${count} impact${count > 1 ? 's' : ''}`);
        }
      });
      sections.push('');
    }

    // Detailed impacts
    sections.push('**Detailed Analysis:**');
    analysis.impacts.forEach((impact: any, index: number) => {
      const emoji = ResponseFormatter.getSeverityEmoji(impact.severity);
      sections.push(`${index + 1}. ${emoji} **${impact.area.toUpperCase()}** (${impact.severity})`);
      sections.push(`   ${impact.description}`);
      
      if (impact.files && impact.files.length > 0) {
        sections.push(`   *Files: ${impact.files.join(', ')}*`);
      }
      
      if (impact.metaJoke) {
        sections.push(`   💭 ${impact.metaJoke}`);
      }
      
      sections.push('');
    });

    // Meta messages
    if (analysis.metaMessage) {
      sections.push(`🎭 **Meta Note:** ${analysis.metaMessage}`);
      sections.push('');
    }

    return sections.join('\n');
  }

  /**
   * Format review comments for display
   */
  static formatReviewComments(comments: Comment[]): string {
    if (!comments || comments.length === 0) {
      return '## 💬 No review comments yet\n\nOnce reviewers provide feedback, their comments will appear here.\n\n';
    }

    const sections = [
      '## 💬 Review Comments',
      ''
    ];

    const groupedComments = ResponseFormatter.groupCommentsByAgent(comments);
    
    Object.entries(groupedComments).forEach(([agentType, agentComments]) => {
      const emoji = ResponseFormatter.getAgentEmoji(agentType);
      sections.push(`### ${emoji} ${agentType.charAt(0).toUpperCase() + agentType.slice(1)} Reviewer`);
      sections.push('');

      agentComments.forEach((comment, index) => {
        const statusEmoji = comment.status === 'open' ? '🔴' : comment.status === 'resolved' ? '✅' : '⚪';
        sections.push(`${index + 1}. ${statusEmoji} **${comment.type}**`);
        sections.push(`   ${comment.content}`);
        
        if (comment.quotedText) {
          sections.push(`   > "${comment.quotedText}"`);
        }
        
        sections.push(`   *${comment.createdAt.toISOString().split('T')[0]}*`);
        sections.push('');
      });
    });

    return sections.join('\n');
  }

  /**
   * Create a complete formatted response
   */
  static formatComplete(response: AgentResponse): string {
    const sections: string[] = [];

    // Main message
    sections.push(response.message);
    sections.push('');

    // Actions performed
    if (response.actions && response.actions.length > 0) {
      sections.push(ResponseFormatter.formatActions(response.actions));
    }

    // RFC artifact
    if (response.rfcArtifact) {
      sections.push('## 📄 RFC Document');
      sections.push('');
      sections.push(ResponseFormatter.formatRFCArtifact(response.rfcArtifact));
      sections.push('');
    }

    // Review summary
    if (response.reviewSummary) {
      sections.push(ResponseFormatter.formatReviewSummary(response.reviewSummary));
    }

    // Suggestions
    if (response.suggestions && response.suggestions.length > 0) {
      sections.push(ResponseFormatter.formatSuggestions(response.suggestions));
    }

    return sections.join('\n');
  }

  /**
   * Get emoji for action types
   */
  private static getActionEmoji(action: string): string {
    const actionEmojis: Record<string, string> = {
      'Used searchCodebase': '🔍',
      'Used createRFCDocument': '📝',
      'Used updateRFCContent': '✏️',
      'Used analyzeImpact': '📊',
      'Used requestReview': '👥',
      'Used getReviewComments': '💬',
      'Used resolveComment': '✅',
      'Used addLeadComment': '📌',
      'Used getRFCStatus': '📋',
      'ERROR_RECOVERY': '🔧'
    };

    return actionEmojis[action] || '⚙️';
  }

  /**
   * Get emoji for severity levels
   */
  private static getSeverityEmoji(severity: string): string {
    const severityEmojis: Record<string, string> = {
      'critical': '🔥',
      'high': '🔴',
      'medium': '🟡',
      'low': '🟢',
      'existential': '🌀',
      'zen': '🧘',
      'universe-ending': '💥'
    };

    return severityEmojis[severity.toLowerCase()] || '⚪';
  }

  /**
   * Get emoji for agent types
   */
  private static getAgentEmoji(agentType: string): string {
    const agentEmojis: Record<string, string> = {
      'lead': '👑',
      'backend': '⚙️',
      'frontend': '🖥️',
      'security': '🔒',
      'database': '🗄️',
      'infrastructure': '🏗️',
      'design': '🎨',
      'product': '📈'
    };

    return agentEmojis[agentType.toLowerCase()] || '👤';
  }

  /**
   * Group comments by agent type
   */
  private static groupCommentsByAgent(comments: Comment[]): Record<string, Comment[]> {
    return comments.reduce((grouped, comment) => {
      const agentType = comment.agentType.toString().toLowerCase();
      if (!grouped[agentType]) {
        grouped[agentType] = [];
      }
      grouped[agentType].push(comment);
      return grouped;
    }, {} as Record<string, Comment[]>);
  }
}

/**
 * Utility class for creating interactive CLI-like responses
 */
export class InteractiveFormatter {
  
  /**
   * Create a progress indicator
   */
  static createProgress(steps: string[], currentStep: number): string {
    const sections = ['## 🚀 Progress\n'];
    
    steps.forEach((step, index) => {
      const status = index < currentStep ? '✅' : 
                   index === currentStep ? '🔄' : '⏳';
      sections.push(`${index + 1}. ${status} ${step}`);
    });
    
    sections.push('');
    return sections.join('\n');
  }

  /**
   * Create a status dashboard
   */
  static createStatusDashboard(state: any): string {
    const sections = [
      '## 📊 RFC Dashboard',
      ''
    ];

    if (state.currentRFC) {
      sections.push(`**Current RFC:** ${state.currentRFC.title}`);
      sections.push(`**Status:** ${state.currentRFC.status} | **ID:** \`${state.currentRFC.id}\``);
      sections.push('');
    }

    if (state.reviewState?.active) {
      sections.push(`**Review Status:** Active (${state.reviewState.pendingComments} pending comments)`);
      sections.push('');
    }

    if (state.context.searchResults) {
      sections.push(`**Context:** Found ${state.context.searchResults.length} relevant code references`);
      sections.push('');
    }

    return sections.join('\n');
  }

  /**
   * Create a help menu
   */
  static createHelpMenu(): string {
    const sections = [
      '## 🤖 RFC Lead Agent - Available Commands',
      '',
      '### RFC Creation',
      '- `"Create an RFC for [feature/change]"` - Start a new RFC',
      '- `"Add more context about [topic]"` - Enhance RFC with additional details',
      '- `"Update the [section] section"` - Modify specific RFC sections',
      '',
      '### Review Process',
      '- `"Request review from [team]"` - Get expert feedback',
      '- `"Check for review comments"` - See pending feedback',
      '- `"Address the [concern] feedback"` - Handle reviewer comments',
      '',
      '### Analysis & Context',
      '- `"Search the codebase for [topic]"` - Find relevant code',
      '- `"Analyze the impact of these changes"` - Understand implications',
      '- `"What\'s the current RFC status?"` - Get progress update',
      '',
      '### Examples',
      '- `"Create an RFC for adding rate limiting to our API"`',
      '- `"Request security review for this authentication change"`',
      '- `"Search for existing session management code"`',
      '',
      'Just describe what you want to do in natural language!'
    ];

    return sections.join('\n');
  }
}
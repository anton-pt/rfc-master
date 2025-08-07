import * as fs from 'fs';
import * as path from 'path';

/**
 * Agent Context Interface
 * 
 * Provides direct access to codebase content instead of requiring file system tools.
 * This simplifies the architecture and provides immediate access to all code.
 */

export interface CodebaseContext {
  filename: string;
  content: string;
  language: string;
  lastModified: Date;
  lineCount: number;
  size: number;
}

export interface AgentContext {
  codebase: CodebaseContext;
}

/**
 * Load codebase context from a file
 */
export function loadCodebaseContext(filePath: string): CodebaseContext {
  try {
    const fullPath = path.resolve(filePath);
    const content = fs.readFileSync(fullPath, 'utf-8');
    const stats = fs.statSync(fullPath);
    
    return {
      filename: path.basename(filePath),
      content,
      language: getLanguageFromExtension(path.extname(filePath)),
      lastModified: stats.mtime,
      lineCount: content.split('\n').length,
      size: stats.size
    };
  } catch (error) {
    throw new Error(`Failed to load codebase context from ${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Create agent context with codebase
 */
export function createAgentContext(codebaseFilePath: string): AgentContext {
  return {
    codebase: loadCodebaseContext(codebaseFilePath)
  };
}

/**
 * Get language from file extension
 */
function getLanguageFromExtension(ext: string): string {
  const languageMap: Record<string, string> = {
    '.ts': 'typescript',
    '.js': 'javascript',
    '.tsx': 'tsx',
    '.jsx': 'jsx',
    '.py': 'python',
    '.java': 'java',
    '.cpp': 'cpp',
    '.c': 'c',
    '.cs': 'csharp',
    '.php': 'php',
    '.rb': 'ruby',
    '.go': 'go',
    '.rs': 'rust',
    '.kt': 'kotlin',
    '.scala': 'scala',
    '.md': 'markdown',
    '.json': 'json',
    '.yaml': 'yaml',
    '.yml': 'yaml',
    '.xml': 'xml',
    '.html': 'html',
    '.css': 'css',
    '.scss': 'scss',
    '.sass': 'sass',
    '.sql': 'sql'
  };
  
  return languageMap[ext.toLowerCase()] || 'text';
}

/**
 * Build system prompt with injected code context
 */
export function buildSystemPromptWithContext(
  basePrompt: string, 
  context: AgentContext,
  agentRole: 'lead' | 'reviewer' = 'lead'
): string {
  const codeSection = `
## Codebase Context

You have direct access to the complete codebase you'll be working with:

**File:** ${context.codebase.filename} (${context.codebase.lineCount} lines, ${context.codebase.language})
**Last Modified:** ${context.codebase.lastModified.toISOString()}

\`\`\`${context.codebase.language}
${context.codebase.content}
\`\`\`

## Analysis Guidelines

${agentRole === 'lead' ? 
  `As a technical lead:
- Reference specific line numbers when proposing changes
- Consider the current architecture and patterns in the code
- Identify potential breaking changes and suggest migration strategies  
- Use concrete examples from the existing code
- Suggest incremental improvements that maintain backward compatibility` :
  `As a specialist reviewer:
- Focus on your area of expertise within the provided codebase
- Reference specific functions, lines, or patterns from the code above
- Identify potential issues or improvements in your domain
- Provide actionable feedback with concrete suggestions`
}

The code above is the COMPLETE application. You have full visibility into:
- All data structures and interfaces (lines 14-28)
- Configuration and constants (lines 31-39)  
- Storage functions (lines 42-68)
- Business logic functions (lines 71-270)
- CLI interface and command parsing (lines 273-503)

Use this context to provide specific, actionable recommendations.
`;

  return basePrompt + '\n\n' + codeSection;
}

/**
 * Extract code references for analysis
 */
export function extractCodeReferences(context: AgentContext): {
  interfaces: string[];
  functions: string[];
  constants: string[];
  imports: string[];
} {
  const lines = context.codebase.content.split('\n');
  
  const interfaces: string[] = [];
  const functions: string[] = [];
  const constants: string[] = [];
  const imports: string[] = [];
  
  lines.forEach((line, index) => {
    const trimmed = line.trim();
    
    // Extract interfaces
    if (trimmed.startsWith('interface ')) {
      const match = trimmed.match(/interface\s+(\w+)/);
      if (match) {
        interfaces.push(`${match[1]} (line ${index + 1})`);
      }
    }
    
    // Extract functions
    if (trimmed.startsWith('function ') || trimmed.includes('function ')) {
      const match = trimmed.match(/function\s+(\w+)/);
      if (match) {
        functions.push(`${match[1]} (line ${index + 1})`);
      }
    }
    
    // Extract const declarations
    if (trimmed.startsWith('const ')) {
      const match = trimmed.match(/const\s+(\w+)/);
      if (match) {
        constants.push(`${match[1]} (line ${index + 1})`);
      }
    }
    
    // Extract imports
    if (trimmed.startsWith('import ')) {
      imports.push(`${trimmed} (line ${index + 1})`);
    }
  });
  
  return { interfaces, functions, constants, imports };
}

/**
 * Generate context summary for debugging/logging
 */
export function summarizeContext(context: AgentContext): string {
  const refs = extractCodeReferences(context);
  
  return `
📁 Codebase Context Summary:
   File: ${context.codebase.filename}
   Language: ${context.codebase.language}
   Lines: ${context.codebase.lineCount}
   Size: ${context.codebase.size} bytes
   Modified: ${context.codebase.lastModified.toISOString()}
   
📦 Code Structure:
   Interfaces: ${refs.interfaces.length} (${refs.interfaces.slice(0, 3).join(', ')}${refs.interfaces.length > 3 ? '...' : ''})
   Functions: ${refs.functions.length} (${refs.functions.slice(0, 3).join(', ')}${refs.functions.length > 3 ? '...' : ''})
   Constants: ${refs.constants.length}
   Imports: ${refs.imports.length}
`;
}
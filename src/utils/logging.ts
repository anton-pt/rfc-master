/**
 * Comprehensive Logging Utilities for RFC Lead Agent
 * 
 * Provides structured, colorized logging for tools, agents, and system operations
 * with timestamps, performance metrics, and visual formatting.
 */

// ANSI color codes for beautiful console output
export const LogColors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  
  // Foreground colors
  black: '\x1b[30m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  
  // Background colors
  bgBlack: '\x1b[40m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
  bgMagenta: '\x1b[45m',
  bgCyan: '\x1b[46m',
  bgWhite: '\x1b[47m',
};

// Log level configuration
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  SILENT = 4,
}

// Global logging configuration
export interface LogConfig {
  level: LogLevel;
  enableColors: boolean;
  enableTimestamps: boolean;
  enablePerformance: boolean;
  maxParameterLength: number;
}

const defaultConfig: LogConfig = {
  level: LogLevel.INFO,
  enableColors: true,
  enableTimestamps: true,
  enablePerformance: true,
  maxParameterLength: 200,
};

let currentConfig: LogConfig = { ...defaultConfig };

/**
 * Configure global logging settings
 */
export function configureLogging(config: Partial<LogConfig>): void {
  currentConfig = { ...currentConfig, ...config };
}

/**
 * Get current logging configuration
 */
export function getLoggingConfig(): LogConfig {
  return { ...currentConfig };
}

/**
 * Colorize text with ANSI codes (if colors enabled)
 */
function colorize(text: string, color: string): string {
  if (!currentConfig.enableColors) return text;
  return `${color}${text}${LogColors.reset}`;
}

/**
 * Get formatted timestamp
 */
function getTimestamp(): string {
  if (!currentConfig.enableTimestamps) return '';
  return `[${new Date().toISOString()}] `;
}

/**
 * Truncate long parameters for logging
 */
function truncateParameter(param: any, maxLength: number = currentConfig.maxParameterLength): string {
  const str = typeof param === 'string' ? param : JSON.stringify(param, null, 2);
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength) + '...';
}

/**
 * Create a visual separator line
 */
export function createSeparator(char: string = '─', length: number = 80): string {
  return char.repeat(length);
}

/**
 * Agent Session Logging
 */
export class AgentSessionLogger {
  private sessionId: string;
  private startTime: number;

  constructor(sessionId: string = 'default') {
    this.sessionId = sessionId;
    this.startTime = Date.now();
  }

  logSessionStart(userMessage: string, agentId: string, contextInfo: any): void {
    if (currentConfig.level > LogLevel.INFO) return;

    console.log(`\n${colorize('🤖', LogColors.cyan)} ${getTimestamp()}${colorize('AGENT SESSION START', LogColors.bright + LogColors.cyan)}`);
    console.log(`   ${colorize('🆔', LogColors.dim)} Session: ${this.sessionId}`);
    console.log(`   ${colorize('👤', LogColors.blue)} Agent: ${agentId}`);
    console.log(`   ${colorize('💬', LogColors.green)} Message: "${truncateParameter(userMessage, 200)}"`);
    console.log(`   ${colorize('📊', LogColors.magenta)} Context: ${contextInfo.lineCount} lines from ${contextInfo.filename}`);
  }

  logIterationStart(iteration: number, maxIterations: number): void {
    if (currentConfig.level > LogLevel.INFO) return;

    console.log(`\n${colorize('🔄', LogColors.yellow)} ${getTimestamp()}${colorize(`ITERATION ${iteration}/${maxIterations}`, LogColors.bright + LogColors.yellow)}`);
  }

  logAICall(toolCount: number): void {
    if (currentConfig.level > LogLevel.DEBUG) return;

    console.log(`   ${colorize('🧠', LogColors.magenta)} Calling AI model with ${toolCount} tools available...`);
  }

  logToolCallsFound(toolCalls: any[]): void {
    if (currentConfig.level > LogLevel.INFO) return;

    console.log(`\n${colorize('🔧', LogColors.blue)} ${getTimestamp()}${colorize(`PROCESSING ${toolCalls.length} TOOL CALLS`, LogColors.bright + LogColors.blue)}`);
    
    toolCalls.forEach((call, index) => {
      console.log(`   ${index + 1}. ${colorize('🛠️', LogColors.cyan)}  ${call.toolName}`);
      console.log(`      ${colorize('📝', LogColors.dim)} Call ID: ${call.toolCallId}`);
      console.log(`      ${colorize('⚙️', LogColors.dim)}  Args: ${truncateParameter(call.args, 150)}`);
    });
  }

  logSessionComplete(iterations: number, toolCallsTotal: number, actionsCount: number, suggestionsCount: number): void {
    if (currentConfig.level > LogLevel.INFO) return;

    const duration = Date.now() - this.startTime;
    
    console.log(`\n${colorize('🎉', LogColors.green)} ${getTimestamp()}${colorize('AGENT SESSION COMPLETE', LogColors.bright + LogColors.green)}`);
    console.log(`   ${colorize('⏱️', LogColors.dim)}  Duration: ${duration}ms`);
    console.log(`   ${colorize('🔄', LogColors.dim)} Iterations: ${iterations}`);
    console.log(`   ${colorize('🔧', LogColors.dim)} Tool Calls: ${toolCallsTotal}`);
    console.log(`   ${colorize('📊', LogColors.dim)} Actions: ${actionsCount}`);
    console.log(`   ${colorize('💡', LogColors.dim)} Suggestions: ${suggestionsCount}`);
    console.log(`   ${colorize(createSeparator('═', 80), LogColors.dim)}`);
  }

  logSessionError(error: Error, duration: number, toolCallsCompleted: number): void {
    console.error(`\n${colorize('❌', LogColors.red)} ${getTimestamp()}${colorize('AGENT SESSION ERROR', LogColors.bright + LogColors.red)}`);
    console.error(`   ${colorize('💥', LogColors.red)} Error: ${error.message}`);
    console.error(`   ${colorize('⏱️', LogColors.dim)}  Duration: ${duration}ms`);
    console.error(`   ${colorize('🔧', LogColors.dim)} Tool Calls: ${toolCallsCompleted}`);
    console.error(`   ${colorize(createSeparator('═', 80), LogColors.dim)}`);
  }
}

/**
 * Tool Execution Logging
 */
export class ToolExecutionLogger {
  private toolName: string;
  private startTime: number;
  private callId: string;

  constructor(toolName: string, callId: string = 'unknown') {
    this.toolName = toolName;
    this.callId = callId;
    this.startTime = Date.now();
  }

  logStart(parameters: any, agentId: string): void {
    if (currentConfig.level > LogLevel.INFO) return;

    console.log(`\n${colorize('🔧', LogColors.blue)} ${getTimestamp()}${colorize(`TOOL START: ${this.toolName}`, LogColors.bright + LogColors.blue)}`);
    console.log(`   ${colorize('🆔', LogColors.dim)} Call ID: ${this.callId}`);
    console.log(`   ${colorize('👤', LogColors.dim)} Agent: ${agentId}`);
    console.log(`   ${colorize('📝', LogColors.dim)} Parameters:`);
    
    // Pretty-print parameters with proper indentation
    const paramStr = JSON.stringify(parameters, null, 2);
    paramStr.split('\n').forEach(line => {
      console.log(`      ${colorize(line, LogColors.dim)}`);
    });
  }

  logSuccess(result: any): void {
    if (currentConfig.level > LogLevel.INFO) return;

    const duration = Date.now() - this.startTime;
    
    console.log(`\n${colorize('✅', LogColors.green)} ${getTimestamp()}${colorize(`TOOL SUCCESS: ${this.toolName}`, LogColors.bright + LogColors.green)}`);
    console.log(`   ${colorize('⏱️', LogColors.dim)}  Duration: ${duration}ms`);
    
    // Log key result metrics
    this.logResultMetrics(result);
    
    console.log(`   ${colorize(createSeparator('─', 70), LogColors.dim)}`);
  }

  logError(error: Error): void {
    const duration = Date.now() - this.startTime;
    
    console.error(`\n${colorize('❌', LogColors.red)} ${getTimestamp()}${colorize(`TOOL FAILED: ${this.toolName}`, LogColors.bright + LogColors.red)}`);
    console.error(`   ${colorize('⏱️', LogColors.dim)}  Duration: ${duration}ms`);
    console.error(`   ${colorize('💥', LogColors.red)} Error: ${error.message}`);
    console.error(`   ${colorize(createSeparator('─', 70), LogColors.dim)}`);
  }

  private logResultMetrics(result: any): void {
    // Log different metrics based on result content
    if (result.rfcId) console.log(`   ${colorize('📄', LogColors.cyan)} RFC ID: ${result.rfcId}`);
    if (result.success !== undefined) console.log(`   ${colorize('✅', LogColors.green)} Success: ${result.success}`);
    if (result.commentId) console.log(`   ${colorize('💬', LogColors.yellow)} Comment ID: ${result.commentId}`);
    if (result.reviewRequestId) console.log(`   ${colorize('👥', LogColors.magenta)} Review Request: ${result.reviewRequestId}`);
    if (result.replacementCount !== undefined) console.log(`   ${colorize('🔄', LogColors.blue)} Replacements: ${result.replacementCount}`);
    if (result.totalCount !== undefined) console.log(`   ${colorize('📊', LogColors.cyan)} Total Count: ${result.totalCount}`);
    if (result.version) console.log(`   ${colorize('🔖', LogColors.green)} Version: ${result.version}`);
    if (result.error) console.log(`   ${colorize('⚠️', LogColors.red)} Error: ${result.error}`);
  }
}

/**
 * Response Formatting Logging
 */
export class ResponseFormattingLogger {
  private startTime: number;

  constructor() {
    this.startTime = Date.now();
  }

  logStart(toolCallsCount: number, textLength: number): void {
    if (currentConfig.level > LogLevel.INFO) return;

    console.log(`\n${colorize('🎨', LogColors.magenta)} ${getTimestamp()}${colorize('FORMATTING RESPONSE', LogColors.bright + LogColors.magenta)}`);
    console.log(`   ${colorize('🔧', LogColors.dim)} Tool calls: ${toolCallsCount}`);
    console.log(`   ${colorize('📝', LogColors.dim)} Text length: ${textLength} characters`);
  }

  logToolCallProcessing(toolName: string, index: number): void {
    if (currentConfig.level > LogLevel.DEBUG) return;

    console.log(`   ${index + 1}. ${colorize('📝', LogColors.cyan)} Processing: ${toolName}`);
  }

  logRFCFetch(rfcId: string): void {
    if (currentConfig.level > LogLevel.DEBUG) return;

    console.log(`   ${colorize('📄', LogColors.blue)} Fetching RFC: ${rfcId}`);
  }

  logRFCFetched(title: string, version: number): void {
    if (currentConfig.level > LogLevel.DEBUG) return;

    console.log(`   ${colorize('✅', LogColors.green)} RFC Retrieved: "${title}" (v${version})`);
  }

  logComplete(actionsCount: number, suggestionsCount: number, hasRFC: boolean, hasReview: boolean): void {
    if (currentConfig.level > LogLevel.INFO) return;

    const duration = Date.now() - this.startTime;
    
    console.log(`\n${colorize('✨', LogColors.green)} ${getTimestamp()}${colorize('RESPONSE FORMATTING COMPLETE', LogColors.bright + LogColors.green)}`);
    console.log(`   ${colorize('⏱️', LogColors.dim)}  Duration: ${duration}ms`);
    console.log(`   ${colorize('🎬', LogColors.dim)} Actions: ${actionsCount}`);
    console.log(`   ${colorize('💡', LogColors.dim)} Suggestions: ${suggestionsCount}`);
    console.log(`   ${colorize('📄', LogColors.dim)} RFC Artifact: ${hasRFC ? 'Yes' : 'No'}`);
    console.log(`   ${colorize('📊', LogColors.dim)} Review Summary: ${hasReview ? 'Yes' : 'No'}`);
  }
}

/**
 * CLI Operation Logging
 */
export class CLILogger {
  static logCommand(command: string, args: string[]): void {
    if (currentConfig.level > LogLevel.INFO) return;

    console.log(`\n${colorize('⌨️', LogColors.cyan)} ${getTimestamp()}${colorize(`CLI COMMAND: ${command}`, LogColors.bright + LogColors.cyan)}`);
    if (args.length > 0) {
      console.log(`   ${colorize('📝', LogColors.dim)} Args: ${args.join(' ')}`);
    }
  }

  static logRFCCreation(description: string): void {
    if (currentConfig.level > LogLevel.INFO) return;

    console.log(`\n${colorize('🚀', LogColors.blue)} ${getTimestamp()}${colorize('RFC CREATION REQUEST', LogColors.bright + LogColors.blue)}`);
    console.log(`   ${colorize('📋', LogColors.green)} Description: "${description}"`);
  }

  static logExport(filename: string, success: boolean): void {
    const icon = success ? '✅' : '❌';
    const color = success ? LogColors.green : LogColors.red;
    const status = success ? 'EXPORTED' : 'EXPORT FAILED';
    
    console.log(`\n${colorize(icon, color)} ${getTimestamp()}${colorize(`RFC ${status}`, LogColors.bright + color)}`);
    console.log(`   ${colorize('📁', LogColors.dim)} File: ${filename}`);
  }
}

/**
 * Performance Monitoring
 */
export class PerformanceLogger {
  private static measurements: Map<string, number> = new Map();

  static startMeasurement(name: string): void {
    if (!currentConfig.enablePerformance) return;
    this.measurements.set(name, Date.now());
  }

  static endMeasurement(name: string, context?: string): number {
    if (!currentConfig.enablePerformance) return 0;
    
    const startTime = this.measurements.get(name);
    if (!startTime) return 0;
    
    const duration = Date.now() - startTime;
    this.measurements.delete(name);
    
    if (currentConfig.level <= LogLevel.DEBUG) {
      const contextStr = context ? ` (${context})` : '';
      console.log(`   ${colorize('⚡', LogColors.yellow)} Performance: ${name}${contextStr} = ${duration}ms`);
    }
    
    return duration;
  }
}

// Export convenience functions
export const log = {
  agent: (sessionId?: string) => new AgentSessionLogger(sessionId),
  tool: (toolName: string, callId?: string) => new ToolExecutionLogger(toolName, callId),
  response: () => new ResponseFormattingLogger(),
  cli: CLILogger,
  perf: PerformanceLogger,
};
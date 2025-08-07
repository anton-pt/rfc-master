#!/usr/bin/env tsx

/**
 * RFC Lead Agent CLI
 * 
 * Interactive command-line interface for collaborating with the AI-powered
 * Lead Agent to create, iterate on, and manage RFC documents.
 * 
 * Usage: npm run dev
 */

import * as readline from 'readline';
import * as fs from 'fs';
import * as path from 'path';
import { RFCDomainModel } from './domain';
import { InMemoryStorage } from './domain/storage/in-memory';
import { createLeadAgent, LeadAgent, AgentResponse } from './agents/lead-agent';
import { ResponseFormatter, InteractiveFormatter } from './agents/response-formatter';
import { createAgentContext } from './agents/agent-context';

// CLI Configuration
const CLI_CONFIG = {
  sessionFile: '.rfc-cli-session.json',
  historyFile: '.rfc-cli-history.json',
  maxHistorySize: 100,
  autoSave: true
};

// ANSI color codes for beautiful output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bgBlue: '\x1b[44m',
  bgGreen: '\x1b[42m'
};

// CLI Command Interface
interface CLICommand {
  name: string;
  aliases: string[];
  description: string;
  usage: string;
  execute: (args: string[], cli: RFCCLI) => Promise<void>;
}

// Session state for persistence
interface CLISession {
  currentRFCId?: string;
  conversationHistory: any[];
  lastActivity: string;
  statistics: {
    rfcsCreated: number;
    reviewsRequested: number;
    commandsExecuted: number;
  };
}

/**
 * Main RFC CLI Class
 */
export class RFCCLI {
  private rl: readline.Interface;
  private agent: LeadAgent;
  private domainModel: RFCDomainModel;
  private session: CLISession;
  private commands: Map<string, CLICommand> = new Map();
  private isRunning = false;

  private constructor() {
    // Initialize domain model
    const storage = new InMemoryStorage();
    this.domainModel = new RFCDomainModel(storage);

    // Initialize readline interface
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: `${colors.cyan}rfc-agent${colors.reset}> `,
      completer: this.completer.bind(this)
    });

    // Initialize session
    this.session = this.loadSession();

    // Setup commands
    this.setupCommands();

    // Setup event handlers
    this.setupEventHandlers();
  }

  /**
   * Static factory method to create and initialize CLI
   */
  static async create(): Promise<RFCCLI> {
    const cli = new RFCCLI();
    await cli.initialize();
    return cli;
  }

  /**
   * Initialize the CLI with async operations
   */
  private async initialize(): Promise<void> {
    // Load codebase context from todo.ts
    const TODO_FILE_PATH = './demo/todo.ts';
    const codebaseContext = createAgentContext(TODO_FILE_PATH);

    // Initialize lead agent with context (now async)
    this.agent = await createLeadAgent(this.domainModel, codebaseContext);
  }

  /**
   * Setup CLI commands
   */
  private setupCommands(): void {
    const commands: CLICommand[] = [
      {
        name: 'create',
        aliases: ['new', 'rfc'],
        description: 'Create a new RFC with AI assistance',
        usage: 'create <description>',
        execute: this.createRFC.bind(this)
      },
      {
        name: 'chat',
        aliases: ['ask', 'c'],
        description: 'Chat with the lead agent about the current RFC',
        usage: 'chat <message>',
        execute: this.chatWithAgent.bind(this)
      },
      {
        name: 'status',
        aliases: ['stat', 's'],
        description: 'Show current RFC status and progress',
        usage: 'status',
        execute: this.showStatus.bind(this)
      },
      {
        name: 'review',
        aliases: ['rev', 'feedback'],
        description: 'Request reviews or process feedback',
        usage: 'review [team1,team2,...]',
        execute: this.manageReview.bind(this)
      },
      {
        name: 'export',
        aliases: ['save', 'output'],
        description: 'Export RFC to markdown file',
        usage: 'export [filename]',
        execute: this.exportRFC.bind(this)
      },
      {
        name: 'history',
        aliases: ['hist', 'h'],
        description: 'Show command history',
        usage: 'history [count]',
        execute: this.showHistory.bind(this)
      },
      {
        name: 'clear',
        aliases: ['cls'],
        description: 'Clear the screen',
        usage: 'clear',
        execute: this.clearScreen.bind(this)
      },
      {
        name: 'help',
        aliases: ['?', 'commands'],
        description: 'Show this help message',
        usage: 'help [command]',
        execute: this.showHelp.bind(this)
      },
      {
        name: 'quit',
        aliases: ['exit', 'q'],
        description: 'Exit the RFC CLI',
        usage: 'quit',
        execute: this.quit.bind(this)
      }
    ];

    // Register commands and aliases
    commands.forEach(cmd => {
      this.commands.set(cmd.name, cmd);
      cmd.aliases.forEach(alias => {
        this.commands.set(alias, cmd);
      });
    });
  }

  /**
   * Setup event handlers
   */
  private setupEventHandlers(): void {
    this.rl.on('line', this.handleInput.bind(this));
    this.rl.on('close', this.quit.bind(this));

    // Handle Ctrl+C gracefully
    process.on('SIGINT', () => {
      console.log(`\n${colors.yellow}Use 'quit' or 'exit' to close the RFC CLI${colors.reset}`);
      this.rl.prompt();
    });

    // Auto-save session periodically
    if (CLI_CONFIG.autoSave) {
      setInterval(() => {
        this.saveSession();
      }, 30000); // Every 30 seconds
    }
  }

  /**
   * Start the CLI
   */
  async start(): Promise<void> {
    this.isRunning = true;
    this.showWelcome();
    this.rl.prompt();

    // Keep the process alive
    return new Promise((resolve) => {
      this.rl.on('close', resolve);
    });
  }

  /**
   * Show welcome message
   */
  private showWelcome(): void {
    console.clear();
    console.log(`${colors.cyan}${colors.bright}
╔══════════════════════════════════════════════════════════════════════════════╗
║                          🤖 RFC Lead Agent CLI                              ║
║                                                                              ║
║  AI-powered technical lead for creating and managing RFC documents          ║
║  Type 'help' for commands or just start chatting!                          ║
╚══════════════════════════════════════════════════════════════════════════════╝${colors.reset}
`);

    if (this.session.currentRFCId) {
      console.log(`${colors.green}📄 Current RFC: ${this.session.currentRFCId}${colors.reset}`);
    }

    if (this.session.statistics.rfcsCreated > 0) {
      console.log(`${colors.dim}📊 Session: ${this.session.statistics.rfcsCreated} RFCs created, ${this.session.statistics.commandsExecuted} commands executed${colors.reset}`);
    }

    console.log(`\n${colors.yellow}💡 Try: ${colors.white}"create Add rate limiting to our API"${colors.reset}`);
    console.log();
  }

  /**
   * Handle user input
   */
  private async handleInput(line: string): Promise<void> {
    const input = line.trim();
    
    if (!input) {
      this.rl.prompt();
      return;
    }

    // Parse command and arguments
    const [commandName, ...args] = input.split(' ');
    const command = this.commands.get(commandName.toLowerCase());

    try {
      if (command) {
        // Execute known command
        this.session.statistics.commandsExecuted++;
        await command.execute(args, this);
      } else {
        // Treat as chat message to agent
        await this.chatWithAgent(input.split(' '));
      }
    } catch (error) {
      console.error(`${colors.red}Error: ${error instanceof Error ? error.message : 'Unknown error'}${colors.reset}`);
    }

    this.rl.prompt();
  }

  /**
   * Create a new RFC
   */
  private async createRFC(args: string[]): Promise<void> {
    const description = args.join(' ');
    
    if (!description) {
      console.log(`${colors.yellow}Usage: create <description>${colors.reset}`);
      console.log(`${colors.dim}Example: create Add authentication middleware to our API${colors.reset}`);
      return;
    }

    console.log(`${colors.blue}🚀 Creating RFC: "${description}"${colors.reset}`);
    console.log(`${colors.dim}⏳ Analyzing codebase and generating comprehensive RFC...${colors.reset}\n`);

    const response = await this.agent.createRFC(description);
    this.displayResponse(response);

    // Update session
    if (response.conversationState.currentRFC) {
      this.session.currentRFCId = response.conversationState.currentRFC.id;
      this.session.statistics.rfcsCreated++;
    }

    this.saveSession();
  }

  /**
   * Chat with the agent
   */
  private async chatWithAgent(args: string[]): Promise<void> {
    const message = args.join(' ');
    
    if (!message) {
      console.log(`${colors.yellow}What would you like to discuss about the RFC?${colors.reset}`);
      return;
    }

    console.log(`${colors.dim}🤖 Processing: "${message}"...${colors.reset}\n`);

    const response = await this.agent.processMessage(message);
    this.displayResponse(response);

    // Update session state
    if (response.conversationState.currentRFC) {
      this.session.currentRFCId = response.conversationState.currentRFC.id;
    }

    this.saveSession();
  }

  /**
   * Show current status
   */
  private async showStatus(): Promise<void> {
    const response = await this.agent.getRFCStatus();
    this.displayResponse(response);
  }


  /**
   * Manage reviews
   */
  private async manageReview(args: string[]): Promise<void> {
    const teams = args.length > 0 ? args.join(' ').split(',').map(t => t.trim()) : [];
    const message = teams.length > 0
      ? `Request review from ${teams.join(', ')} teams`
      : 'Check for review comments and process feedback';

    console.log(`${colors.blue}👥 ${message}${colors.reset}\n`);

    if (teams.length > 0) {
      this.session.statistics.reviewsRequested++;
    }

    const response = await this.agent.processMessage(message);
    this.displayResponse(response);
  }

  /**
   * Export RFC to file
   */
  private async exportRFC(args: string[]): Promise<void> {
    if (!this.session.currentRFCId) {
      console.log(`${colors.yellow}No active RFC to export. Create an RFC first.${colors.reset}`);
      return;
    }

    const filename = args[0] || `rfc-${this.session.currentRFCId}.md`;
    
    try {
      const rfc = await this.domainModel.getRFC(this.session.currentRFCId);
      if (!rfc) {
        console.log(`${colors.red}Could not find RFC ${this.session.currentRFCId}${colors.reset}`);
        return;
      }

      const content = ResponseFormatter.formatRFCArtifact(rfc);
      fs.writeFileSync(filename, content, 'utf8');
      
      console.log(`${colors.green}✅ RFC exported to ${filename}${colors.reset}`);
    } catch (error) {
      console.log(`${colors.red}Failed to export RFC: ${error instanceof Error ? error.message : 'Unknown error'}${colors.reset}`);
    }
  }

  /**
   * Show command history
   */
  private async showHistory(args: string[]): Promise<void> {
    const count = parseInt(args[0]) || 10;
    const history = this.loadHistory().slice(-count);

    console.log(`${colors.cyan}📜 Command History (last ${count}):${colors.reset}`);
    history.forEach((cmd, index) => {
      console.log(`${colors.dim}${history.length - index}.${colors.reset} ${cmd}`);
    });
  }

  /**
   * Clear screen
   */
  private async clearScreen(): Promise<void> {
    console.clear();
    this.showWelcome();
  }

  /**
   * Show help
   */
  private async showHelp(args: string[]): Promise<void> {
    const commandName = args[0];

    if (commandName) {
      const command = this.commands.get(commandName.toLowerCase());
      if (command) {
        console.log(`${colors.cyan}${colors.bright}${command.name}${colors.reset} - ${command.description}`);
        console.log(`${colors.dim}Usage: ${command.usage}${colors.reset}`);
        if (command.aliases.length > 0) {
          console.log(`${colors.dim}Aliases: ${command.aliases.join(', ')}${colors.reset}`);
        }
      } else {
        console.log(`${colors.red}Unknown command: ${commandName}${colors.reset}`);
      }
    } else {
      console.log(InteractiveFormatter.createHelpMenu());
      console.log(`\n${colors.cyan}Available Commands:${colors.reset}`);
      
      const uniqueCommands = Array.from(new Set(Array.from(this.commands.values())));
      uniqueCommands.forEach(cmd => {
        console.log(`  ${colors.green}${cmd.name.padEnd(12)}${colors.reset} ${cmd.description}`);
      });

      console.log(`\n${colors.dim}💡 Tip: You can also just type natural language and I'll understand!${colors.reset}`);
    }
  }

  /**
   * Quit the CLI
   */
  private async quit(): Promise<void> {
    console.log(`\n${colors.cyan}👋 Thanks for using RFC Lead Agent CLI!${colors.reset}`);
    
    this.saveSession();
    
    if (this.session.statistics.rfcsCreated > 0) {
      console.log(`${colors.green}📊 Session Summary: ${this.session.statistics.rfcsCreated} RFCs created, ${this.session.statistics.commandsExecuted} commands executed${colors.reset}`);
    }

    this.rl.close();
    this.isRunning = false;
  }

  /**
   * Display agent response with beautiful formatting
   */
  private displayResponse(response: AgentResponse): void {
    // Main message
    console.log(this.formatMessage(response.message));

    // RFC artifact (if available)
    if (response.rfcArtifact) {
      console.log(`\n${colors.bgBlue}${colors.white} RFC DOCUMENT ${colors.reset}`);
      console.log(ResponseFormatter.formatRFCArtifact(response.rfcArtifact));
    }

    // Actions performed
    if (response.actions && response.actions.length > 0) {
      console.log(`\n${colors.cyan}🔧 Actions Performed:${colors.reset}`);
      response.actions.forEach((action, index) => {
        console.log(`  ${index + 1}. ${this.getActionEmoji(action)} ${action}`);
      });
    }

    // Suggestions
    if (response.suggestions && response.suggestions.length > 0) {
      console.log(`\n${colors.yellow}💡 Suggestions:${colors.reset}`);
      response.suggestions.forEach((suggestion, index) => {
        console.log(`  ${index + 1}. ${suggestion}`);
      });
    }

    console.log(); // Extra spacing
  }

  /**
   * Format message with markdown-like styling
   */
  private formatMessage(message: string): string {
    return message
      .replace(/\*\*(.*?)\*\*/g, `${colors.bright}$1${colors.reset}`)
      .replace(/\*(.*?)\*/g, `${colors.dim}$1${colors.reset}`)
      .replace(/`(.*?)`/g, `${colors.cyan}$1${colors.reset}`)
      .replace(/^## (.*$)/gm, `\n${colors.blue}${colors.bright}$1${colors.reset}`)
      .replace(/^### (.*$)/gm, `${colors.blue}$1${colors.reset}`)
      .replace(/^- (.*$)/gm, `${colors.green}•${colors.reset} $1`)
      .replace(/✅/g, `${colors.green}✅${colors.reset}`)
      .replace(/❌/g, `${colors.red}❌${colors.reset}`)
      .replace(/🔄/g, `${colors.yellow}🔄${colors.reset}`);
  }

  /**
   * Get emoji for action types
   */
  private getActionEmoji(action: string): string {
    const emojis: Record<string, string> = {
      'Used searchCodebase': '🔍',
      'Used createRFCDocument': '📝',
      'Used updateRFCContent': '✏️',
      'Used analyzeImpact': '📊',
      'Used requestReview': '👥',
      'Used getReviewComments': '💬',
      'Used resolveComment': '✅',
      'Used addLeadComment': '📌',
      'Used getRFCStatus': '📋'
    };
    return emojis[action] || '⚙️';
  }

  /**
   * Tab completion for commands
   */
  private completer(line: string): [string[], string] {
    const completions = Array.from(this.commands.keys());
    const hits = completions.filter((c) => c.startsWith(line));
    return [hits.length ? hits : completions, line];
  }

  /**
   * Load session from file
   */
  private loadSession(): CLISession {
    try {
      if (fs.existsSync(CLI_CONFIG.sessionFile)) {
        const data = fs.readFileSync(CLI_CONFIG.sessionFile, 'utf8');
        return JSON.parse(data);
      }
    } catch (error) {
      console.warn(`Failed to load session: ${error}`);
    }

    return {
      conversationHistory: [],
      lastActivity: new Date().toISOString(),
      statistics: {
        rfcsCreated: 0,
        reviewsRequested: 0,
        commandsExecuted: 0
      }
    };
  }

  /**
   * Save session to file
   */
  private saveSession(): void {
    try {
      this.session.lastActivity = new Date().toISOString();
      const data = JSON.stringify(this.session, null, 2);
      fs.writeFileSync(CLI_CONFIG.sessionFile, data, 'utf8');
    } catch (error) {
      console.warn(`Failed to save session: ${error}`);
    }
  }

  /**
   * Load command history
   */
  private loadHistory(): string[] {
    try {
      if (fs.existsSync(CLI_CONFIG.historyFile)) {
        const data = fs.readFileSync(CLI_CONFIG.historyFile, 'utf8');
        return JSON.parse(data);
      }
    } catch (error) {
      // Ignore errors, return empty history
    }
    return [];
  }

  /**
   * Save command to history
   */
  private saveToHistory(command: string): void {
    try {
      const history = this.loadHistory();
      history.push(command);
      
      // Limit history size
      if (history.length > CLI_CONFIG.maxHistorySize) {
        history.splice(0, history.length - CLI_CONFIG.maxHistorySize);
      }

      const data = JSON.stringify(history, null, 2);
      fs.writeFileSync(CLI_CONFIG.historyFile, data, 'utf8');
    } catch (error) {
      // Ignore errors
    }
  }
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  const cli = await RFCCLI.create();
  await cli.start();
}

// Run the CLI (ES module compatible)
main().catch(console.error);

export default RFCCLI;
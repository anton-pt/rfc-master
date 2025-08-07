#!/usr/bin/env node

/**
 * Todo CLI Application
 * A simple command-line todo manager with basic features
 * This application will be the target for RFC improvements
 */

import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";

// Types
interface Todo {
  id: number;
  title: string;
  description?: string;
  completed: boolean;
  priority: "low" | "medium" | "high";
  createdAt: Date;
  completedAt?: Date;
  tags: string[];
}

interface TodoStore {
  todos: Todo[];
  nextId: number;
}

// Configuration
const TODO_FILE = path.join(process.env.HOME || ".", ".todos.json");
const COLORS = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  gray: "\x1b[90m",
};

// Storage functions
function loadTodos(): TodoStore {
  try {
    if (fs.existsSync(TODO_FILE)) {
      const data = fs.readFileSync(TODO_FILE, "utf-8");
      const parsed = JSON.parse(data);
      // Parse dates back from JSON
      parsed.todos = parsed.todos.map((todo: any) => ({
        ...todo,
        createdAt: new Date(todo.createdAt),
        completedAt: todo.completedAt ? new Date(todo.completedAt) : undefined,
      }));
      return parsed;
    }
  } catch (error) {
    console.error("Error loading todos:", error);
  }
  return { todos: [], nextId: 1 };
}

function saveTodos(store: TodoStore): void {
  try {
    fs.writeFileSync(TODO_FILE, JSON.stringify(store, null, 2));
  } catch (error) {
    console.error("Error saving todos:", error);
    process.exit(1);
  }
}

// Todo operations
function addTodo(
  title: string,
  options: { description?: string; priority?: string; tags?: string }
): void {
  const store = loadTodos();

  const newTodo: Todo = {
    id: store.nextId,
    title,
    description: options.description,
    completed: false,
    priority: (options.priority as Todo["priority"]) || "medium",
    createdAt: new Date(),
    tags: options.tags ? options.tags.split(",").map((t) => t.trim()) : [],
  };

  store.todos.push(newTodo);
  store.nextId++;
  saveTodos(store);

  console.log(
    `${COLORS.green}✓${COLORS.reset} Added todo #${newTodo.id}: ${newTodo.title}`
  );
}

function listTodos(options: {
  all?: boolean;
  tag?: string;
  priority?: string;
}): void {
  const store = loadTodos();
  let todos = store.todos;

  // Filter
  if (!options.all) {
    todos = todos.filter((todo) => !todo.completed);
  }
  if (options.tag) {
    todos = todos.filter((todo) => todo.tags.includes(options.tag));
  }
  if (options.priority) {
    todos = todos.filter((todo) => todo.priority === options.priority);
  }

  // Sort by priority and creation date
  todos.sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    }
    return a.createdAt.getTime() - b.createdAt.getTime();
  });

  if (todos.length === 0) {
    console.log("No todos found.");
    return;
  }

  // Display
  console.log("\n" + "=".repeat(50));
  todos.forEach((todo) => {
    const checkbox = todo.completed ? `${COLORS.green}✓${COLORS.reset}` : "☐";
    const priorityColor =
      todo.priority === "high"
        ? COLORS.red
        : todo.priority === "medium"
        ? COLORS.yellow
        : COLORS.gray;
    const title = todo.completed
      ? `${COLORS.gray}${todo.title}${COLORS.reset}`
      : todo.title;

    console.log(
      `${checkbox} [${todo.id}] ${priorityColor}(${todo.priority})${COLORS.reset} ${title}`
    );

    if (todo.description) {
      console.log(`  ${COLORS.gray}${todo.description}${COLORS.reset}`);
    }

    if (todo.tags.length > 0) {
      console.log(
        `  ${COLORS.blue}Tags: ${todo.tags.join(", ")}${COLORS.reset}`
      );
    }

    if (todo.completed && todo.completedAt) {
      console.log(
        `  ${COLORS.gray}Completed: ${todo.completedAt.toLocaleDateString()}${
          COLORS.reset
        }`
      );
    }
  });
  console.log("=".repeat(50) + "\n");
}

function completeTodo(id: number): void {
  const store = loadTodos();
  const todo = store.todos.find((t) => t.id === id);

  if (!todo) {
    console.error(`${COLORS.red}✗${COLORS.reset} Todo #${id} not found`);
    process.exit(1);
  }

  if (todo.completed) {
    console.log(
      `${COLORS.yellow}!${COLORS.reset} Todo #${id} is already completed`
    );
    return;
  }

  todo.completed = true;
  todo.completedAt = new Date();
  saveTodos(store);

  console.log(
    `${COLORS.green}✓${COLORS.reset} Completed todo #${id}: ${todo.title}`
  );
}

function deleteTodo(id: number): void {
  const store = loadTodos();
  const index = store.todos.findIndex((t) => t.id === id);

  if (index === -1) {
    console.error(`${COLORS.red}✗${COLORS.reset} Todo #${id} not found`);
    process.exit(1);
  }

  const deleted = store.todos.splice(index, 1)[0];
  saveTodos(store);

  console.log(
    `${COLORS.red}✗${COLORS.reset} Deleted todo #${id}: ${deleted.title}`
  );
}

function updateTodo(
  id: number,
  options: {
    title?: string;
    description?: string;
    priority?: string;
    tags?: string;
  }
): void {
  const store = loadTodos();
  const todo = store.todos.find((t) => t.id === id);

  if (!todo) {
    console.error(`${COLORS.red}✗${COLORS.reset} Todo #${id} not found`);
    process.exit(1);
  }

  if (options.title) todo.title = options.title;
  if (options.description !== undefined) todo.description = options.description;
  if (options.priority) todo.priority = options.priority as Todo["priority"];
  if (options.tags !== undefined) {
    todo.tags = options.tags
      ? options.tags.split(",").map((t) => t.trim())
      : [];
  }

  saveTodos(store);
  console.log(`${COLORS.green}✓${COLORS.reset} Updated todo #${id}`);
}

function showStats(): void {
  const store = loadTodos();
  const total = store.todos.length;
  const completed = store.todos.filter((t) => t.completed).length;
  const pending = total - completed;

  const byPriority = store.todos.reduce((acc, todo) => {
    if (!todo.completed) {
      acc[todo.priority] = (acc[todo.priority] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);

  console.log("\n" + "=".repeat(30));
  console.log("📊 Todo Statistics");
  console.log("=".repeat(30));
  console.log(`Total todos: ${total}`);
  console.log(`✓ Completed: ${completed}`);
  console.log(`☐ Pending: ${pending}`);

  if (pending > 0) {
    console.log("\nPending by priority:");
    console.log(`  ${COLORS.red}High:${COLORS.reset} ${byPriority.high || 0}`);
    console.log(
      `  ${COLORS.yellow}Medium:${COLORS.reset} ${byPriority.medium || 0}`
    );
    console.log(`  ${COLORS.gray}Low:${COLORS.reset} ${byPriority.low || 0}`);
  }

  console.log("=".repeat(30) + "\n");
}

// Interactive mode
async function interactiveMode(): Promise<void> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: "todo> ",
  });

  console.log("Todo CLI - Interactive Mode");
  console.log('Type "help" for commands, "exit" to quit\n');

  rl.prompt();

  rl.on("line", (line) => {
    const parts = line.trim().split(" ");
    const command = parts[0];

    switch (command) {
      case "help":
        console.log("\nCommands:");
        console.log("  add <title>       - Add a new todo");
        console.log("  list              - List pending todos");
        console.log("  complete <id>     - Mark todo as complete");
        console.log("  delete <id>       - Delete a todo");
        console.log("  stats             - Show statistics");
        console.log("  exit              - Exit interactive mode\n");
        break;

      case "add":
        if (parts.length < 2) {
          console.log("Usage: add <title>");
        } else {
          addTodo(parts.slice(1).join(" "), {});
        }
        break;

      case "list":
        listTodos({});
        break;

      case "complete":
        if (parts.length < 2) {
          console.log("Usage: complete <id>");
        } else {
          completeTodo(parseInt(parts[1]));
        }
        break;

      case "delete":
        if (parts.length < 2) {
          console.log("Usage: delete <id>");
        } else {
          deleteTodo(parseInt(parts[1]));
        }
        break;

      case "stats":
        showStats();
        break;

      case "exit":
      case "quit":
        rl.close();
        return;

      default:
        if (command) {
          console.log(`Unknown command: ${command}. Type "help" for commands.`);
        }
    }

    rl.prompt();
  });

  rl.on("close", () => {
    console.log("\nGoodbye!");
    process.exit(0);
  });
}

// CLI argument parsing
function main(): void {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    interactiveMode();
    return;
  }

  const command = args[0];

  switch (command) {
    case "add":
      if (args.length < 2) {
        console.error(
          "Usage: todo add <title> [--desc <description>] [--priority <low|medium|high>] [--tags <tag1,tag2>]"
        );
        process.exit(1);
      }

      const title = args[1];
      const options: any = {};

      for (let i = 2; i < args.length; i += 2) {
        const flag = args[i];
        const value = args[i + 1];

        switch (flag) {
          case "--desc":
            options.description = value;
            break;
          case "--priority":
            options.priority = value;
            break;
          case "--tags":
            options.tags = value;
            break;
        }
      }

      addTodo(title, options);
      break;

    case "list":
      const listOptions: any = {};

      for (let i = 1; i < args.length; i++) {
        if (args[i] === "--all") {
          listOptions.all = true;
        } else if (args[i] === "--tag" && args[i + 1]) {
          listOptions.tag = args[i + 1];
          i++;
        } else if (args[i] === "--priority" && args[i + 1]) {
          listOptions.priority = args[i + 1];
          i++;
        }
      }

      listTodos(listOptions);
      break;

    case "complete":
      if (args.length < 2) {
        console.error("Usage: todo complete <id>");
        process.exit(1);
      }
      completeTodo(parseInt(args[1]));
      break;

    case "delete":
      if (args.length < 2) {
        console.error("Usage: todo delete <id>");
        process.exit(1);
      }
      deleteTodo(parseInt(args[1]));
      break;

    case "update":
      if (args.length < 2) {
        console.error(
          "Usage: todo update <id> [--title <title>] [--desc <description>] [--priority <priority>] [--tags <tags>]"
        );
        process.exit(1);
      }

      const updateId = parseInt(args[1]);
      const updateOptions: any = {};

      for (let i = 2; i < args.length; i += 2) {
        const flag = args[i];
        const value = args[i + 1];

        switch (flag) {
          case "--title":
            updateOptions.title = value;
            break;
          case "--desc":
            updateOptions.description = value;
            break;
          case "--priority":
            updateOptions.priority = value;
            break;
          case "--tags":
            updateOptions.tags = value;
            break;
        }
      }

      updateTodo(updateId, updateOptions);
      break;

    case "stats":
      showStats();
      break;

    case "help":
      console.log(`
Todo CLI - A simple command-line todo manager

Usage: todo <command> [options]

Commands:
  add <title> [options]     Add a new todo
    --desc <description>    Add description
    --priority <level>      Set priority (low|medium|high)
    --tags <tag1,tag2>      Add tags
    
  list [options]            List todos
    --all                   Show completed todos
    --tag <tag>            Filter by tag
    --priority <level>     Filter by priority
    
  complete <id>             Mark todo as complete
  delete <id>               Delete a todo
  update <id> [options]     Update a todo
  stats                     Show statistics
  help                      Show this help message
  
Interactive mode:
  Run 'todo' without arguments to enter interactive mode
      `);
      break;

    default:
      console.error(`Unknown command: ${command}`);
      console.error('Run "todo help" for usage information');
      process.exit(1);
  }
}

// Run the application
main();

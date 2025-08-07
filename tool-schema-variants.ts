#!/usr/bin/env tsx

import { tool } from "ai";
import { z } from "zod";
import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";

console.log("Testing different tool schema approaches...");

// Approach 1: Simple Zod schema
const toolV1 = tool({
  description: "Simple test tool v1",
  parameters: z.object({
    message: z.string().describe("A test message"),
  }),
  execute: async ({ message }) => {
    return { result: `V1: ${message}` };
  },
});

// Approach 2: More explicit Zod schema
const toolV2 = tool({
  description: "Simple test tool v2",
  parameters: z
    .object({
      message: z.string().describe("A test message"),
    })
    .describe("Tool parameters"),
  execute: async ({ message }) => {
    return { result: `V2: ${message}` };
  },
});

// Approach 3: Try with strict Zod schema
const toolV3 = tool({
  description: "Simple test tool v3",
  parameters: z
    .object({
      message: z.string().min(1).describe("A test message"),
    })
    .strict(),
  execute: async ({ message }) => {
    return { result: `V3: ${message}` };
  },
});

const testTool = async (toolName: string, testTool: any) => {
  console.log(`\n--- Testing ${toolName} ---`);
  try {
    await generateText({
      model: openai("gpt-4o"),
      system: "You are a helpful assistant.",
      messages: [{ role: "user", content: "Hello" }],
      tools: { [toolName]: testTool },
      maxTokens: 100,
    });
  } catch (error: any) {
    console.log(`${toolName} Error:`, error.message);
    if (error.requestBodyValues?.tools) {
      console.log(
        `${toolName} serialized:`,
        JSON.stringify(error.requestBodyValues.tools, null, 2)
      );
    }
  }
};

// Test each approach
await testTool("toolV1", toolV1);
await testTool("toolV2", toolV2);
await testTool("toolV3", toolV3);

// Also test with the zod-to-json-schema approach manually
console.log("\n--- Manual Zod inspection ---");
const schema = z.object({
  message: z.string().describe("A test message"),
});

console.log("Zod schema properties:");
console.log("- _def:", schema._def);
console.log("- _def.shape():", schema._def.shape());
const shape = schema._def.shape();
console.log("- shape keys:", Object.keys(shape));
for (const [key, value] of Object.entries(shape)) {
  console.log(`  - ${key}:`, (value as any)._def);
}

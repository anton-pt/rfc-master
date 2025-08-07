#!/usr/bin/env tsx

import { tool } from "ai";
import { z } from "zod";
import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";

console.log("Creating minimal tool...");

// Create a simple tool like in the docs
const simpleTool = tool({
  description: "Simple test tool",
  parameters: z.object({
    message: z.string().describe("A test message"),
  }),
  execute: async ({ message }) => {
    return { result: `Processed: ${message}` };
  },
});

console.log("Simple tool created:", simpleTool);
console.log("Tool properties:", Object.keys(simpleTool));

// Test with just this one tool
const tools = {
  simpleTool,
};

console.log("\nTesting with single tool...");

try {
  // This should fail with API key error, but show us the serialized request
  await generateText({
    model: openai("gpt-4o"),
    system: "You are a helpful assistant.",
    messages: [{ role: "user", content: "Hello" }],
    tools,
    maxTokens: 100,
  });
} catch (error: any) {
  console.log("Error:", error.message);
  if (error.requestBodyValues?.tools) {
    console.log(
      "\nSerialized tools:",
      JSON.stringify(error.requestBodyValues.tools, null, 2)
    );
  }
}

#!/usr/bin/env tsx

import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";
import { RFCDomainModel } from "./src/domain";
import { InMemoryStorage } from "./src/domain/storage/in-memory";
import { leadAgentTools, initializeTools } from "./src/tools/lead-agent-tools";

console.log("Debugging tool schemas...");

// Initialize domain model
const storage = new InMemoryStorage();
const domainModel = new RFCDomainModel(storage);
initializeTools(domainModel, "test-agent");

// Examine the tools object in detail
console.log("\n--- Tools Object Structure ---");
console.log("Type of leadAgentTools:", typeof leadAgentTools);
console.log("Is array?", Array.isArray(leadAgentTools));
console.log("Keys:", Object.keys(leadAgentTools));

// Convert to the format expected by AI SDK
const toolsArray = Object.entries(leadAgentTools).map(([name, tool]) => {
  console.log(`\n--- Tool: ${name} ---`);
  console.log("Tool object:", tool);
  console.log("Tool properties:", Object.keys(tool));

  // Try to access the schema directly
  const schema = (tool as any).parameters;
  console.log("Schema object:", typeof schema);
  console.log("Schema properties:", schema ? Object.keys(schema) : "undefined");

  if (schema && schema._def) {
    console.log("Schema._def:", schema._def);
    console.log("Schema._def.typeName:", schema._def.typeName);
  }

  return tool;
});

// Test with a simple generateText call to see the exact error
try {
  console.log("\n--- Testing generateText call ---");

  const result = await generateText({
    model: openai("gpt-4o"),
    system: "You are a helpful assistant.",
    messages: [{ role: "user", content: "Hello" }],
    tools: leadAgentTools,
    maxTokens: 100,
  });

  console.log("Success! Result:", result.text);
} catch (error: any) {
  console.log("Error details:");
  console.log("Message:", error.message);
  console.log(
    "RequestBodyValues:",
    JSON.stringify(error.requestBodyValues, null, 2)
  );

  if (error.requestBodyValues?.tools) {
    console.log("\n--- Inspecting serialized tools ---");
    error.requestBodyValues.tools.forEach((tool: any, index: number) => {
      console.log(`Tool ${index}:`, JSON.stringify(tool, null, 2));
    });
  }
}

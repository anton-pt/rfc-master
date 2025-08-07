#!/usr/bin/env tsx

import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";

console.log("Testing bypassing AI SDK tool wrapper...");

// Try passing tools in Anthropic's native format
const nativeTools = [
  {
    name: "simple_test",
    description: "A simple test tool",
    input_schema: {
      type: "object",
      properties: {
        message: {
          type: "string",
          description: "A test message",
        },
      },
      required: ["message"],
      additionalProperties: false,
    },
  },
];

console.log("Native tools:", JSON.stringify(nativeTools, null, 2));

try {
  const result = await generateText({
    model: openai("gpt-4o"),
    system: "You are a helpful assistant.",
    messages: [
      {
        role: "user",
        content: 'Use the simple_test tool with message "hello"',
      },
    ],
    // Try bypassing AI SDK tool wrapper completely
    tools: nativeTools as any,
    maxTokens: 100,
  });
  console.log("SUCCESS! Native format works!");
  console.log("Result:", result.text);
} catch (error: any) {
  console.log("Error:", error.message);
  if (error.requestBodyValues?.tools) {
    console.log(
      "Serialized tools:",
      JSON.stringify(error.requestBodyValues.tools, null, 2)
    );
  }
}

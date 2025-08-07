#!/usr/bin/env tsx

import { tool } from "ai";
import { z } from "zod";
import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";
import {
  leadAgentTools,
  initializeTools,
  createRFCDocument,
} from "./src/tools/lead-agent-tools";
import { RFCDomainModel } from "./src/domain";
import { InMemoryStorage } from "./src/domain/storage/in-memory";

console.log("Attempting to fix tool schema conversion...");

// Initialize domain model
const storage = new InMemoryStorage();
const domainModel = new RFCDomainModel(storage);
initializeTools(domainModel, "test-agent");

// Function to manually convert Zod to JSON Schema
function zodToJsonSchema(schema: z.ZodType): any {
  if (schema instanceof z.ZodObject) {
    const shape = schema._def.shape();
    const properties: any = {};
    const required: string[] = [];

    for (const [key, value] of Object.entries(shape)) {
      const zodType = value as z.ZodType;

      if (zodType instanceof z.ZodString) {
        properties[key] = {
          type: "string",
          description: zodType._def.description || "",
        };
        if (!zodType.isOptional()) {
          required.push(key);
        }
      } else if (zodType instanceof z.ZodNumber) {
        properties[key] = {
          type: "number",
          description: zodType._def.description || "",
        };
        if (!zodType.isOptional()) {
          required.push(key);
        }
      } else if (zodType instanceof z.ZodBoolean) {
        properties[key] = {
          type: "boolean",
          description: zodType._def.description || "",
        };
        if (!zodType.isOptional()) {
          required.push(key);
        }
      } else if (zodType instanceof z.ZodArray) {
        properties[key] = {
          type: "array",
          items: zodToJsonSchema(zodType._def.type),
          description: zodType._def.description || "",
        };
        if (!zodType.isOptional()) {
          required.push(key);
        }
      } else if (zodType instanceof z.ZodEnum) {
        properties[key] = {
          type: "string",
          enum: zodType._def.values,
          description: zodType._def.description || "",
        };
        if (!zodType.isOptional()) {
          required.push(key);
        }
      } else if (zodType instanceof z.ZodOptional) {
        const innerSchema = zodToJsonSchema(zodType._def.innerType);
        properties[key] = {
          ...innerSchema,
          description:
            zodType._def.description || innerSchema.description || "",
        };
        // Optional, so don't add to required
      }
    }

    return {
      type: "object",
      properties,
      required: required.length > 0 ? required : undefined,
      additionalProperties: false,
    };
  }

  // Fallback for other types
  return { type: "object", properties: {}, additionalProperties: false };
}

// Create a corrected version of the tools
function createFixedTool(originalTool: any, name: string) {
  const zodSchema = originalTool.parameters;
  const jsonSchema = zodToJsonSchema(zodSchema);

  console.log(`Fixed schema for ${name}:`, JSON.stringify(jsonSchema, null, 2));

  // Create a new tool with the fixed schema
  return {
    name,
    description: originalTool.description,
    input_schema: jsonSchema,
    execute: originalTool.execute,
  };
}

// Test with a single fixed tool
const fixedTool = createFixedTool(
  leadAgentTools.createRFCDocument,
  "createRFCDocument"
);

console.log("\nTesting fixed tool...");
try {
  await generateText({
    model: openai("gpt-4o"),
    system: "You are a helpful assistant.",
    messages: [
      { role: "user", content: "Create an RFC for adding rate limiting" },
    ],
    tools: { createRFCDocument: fixedTool },
    maxTokens: 100,
  });
  console.log("SUCCESS! Fixed tool works!");
} catch (error: any) {
  console.log("Error:", error.message);
  if (error.requestBodyValues?.tools) {
    console.log(
      "Serialized tools:",
      JSON.stringify(error.requestBodyValues.tools, null, 2)
    );
  }
}

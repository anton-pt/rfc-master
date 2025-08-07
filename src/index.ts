import { generateText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";

const result = await generateText({
  model: anthropic("claude-3-7-sonnet-20250219"),
  prompt: "Hello world.",
});

console.log(result.text);

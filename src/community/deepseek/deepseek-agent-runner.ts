import { ClaudeAgentRunner } from "@/community/anthropic";

const DEEPSEEK_ANTHROPIC_BASE_URL = "https://api.deepseek.com/anthropic";
const DEFAULT_DEEPSEEK_MODEL = "deepseek-v4-pro";

/**
 * Runs Agentara through Claude Code while using DeepSeek's Anthropic-compatible
 * endpoint as the model backend.
 */
export class DeepSeekAgentRunner extends ClaudeAgentRunner {
  constructor(model = DEFAULT_DEEPSEEK_MODEL) {
    const apiKey = Bun.env.DEEPSEEK_API_KEY?.trim();
    if (!apiKey) {
      throw new Error(
        "DEEPSEEK_API_KEY is required when agents.default.type is deepseek",
      );
    }

    const resolvedModel = model.trim() || DEFAULT_DEEPSEEK_MODEL;
    super({
      type: "deepseek",
      model: resolvedModel,
      processName: "DeepSeek via Claude Code",
      env: {
        // Read the secret from the parent process environment and expose it to
        // Claude Code only through its provider-specific authentication key.
        DEEPSEEK_API_KEY: "",
        ANTHROPIC_API_KEY: "",
        ANTHROPIC_AUTH_TOKEN: apiKey,
        ANTHROPIC_BASE_URL: DEEPSEEK_ANTHROPIC_BASE_URL,
        ANTHROPIC_MODEL: resolvedModel,
        ANTHROPIC_DEFAULT_OPUS_MODEL: resolvedModel,
        ANTHROPIC_DEFAULT_SONNET_MODEL: resolvedModel,
        ANTHROPIC_DEFAULT_HAIKU_MODEL: resolvedModel,
        CLAUDE_CODE_SUBAGENT_MODEL: resolvedModel,
        CLAUDE_CODE_EFFORT_LEVEL: "max",
      },
    });
  }
}

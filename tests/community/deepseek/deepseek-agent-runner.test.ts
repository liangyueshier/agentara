import { afterEach, describe, expect, test } from "bun:test";

import { DeepSeekAgentRunner } from "@/community/deepseek";

const originalApiKey = Bun.env.DEEPSEEK_API_KEY;

class InspectableDeepSeekAgentRunner extends DeepSeekAgentRunner {
  inspectSpawnEnv(): Record<string, string | undefined> {
    return this._buildSpawnEnv();
  }
}

afterEach(() => {
  if (originalApiKey === undefined) {
    delete Bun.env.DEEPSEEK_API_KEY;
  } else {
    Bun.env.DEEPSEEK_API_KEY = originalApiKey;
  }
});

describe("DeepSeekAgentRunner", () => {
  test("requires DEEPSEEK_API_KEY", () => {
    delete Bun.env.DEEPSEEK_API_KEY;

    expect(() => new DeepSeekAgentRunner()).toThrow("DEEPSEEK_API_KEY");
  });

  test("maps the environment key to the DeepSeek Anthropic endpoint", () => {
    Bun.env.DEEPSEEK_API_KEY = "test-deepseek-key";

    const runner = new InspectableDeepSeekAgentRunner("deepseek-v4-pro");
    const env = runner.inspectSpawnEnv();

    expect(runner.type).toBe("deepseek");
    expect(env.DEEPSEEK_API_KEY).toBe("");
    expect(env.ANTHROPIC_API_KEY).toBe("");
    expect(env.ANTHROPIC_AUTH_TOKEN).toBe("test-deepseek-key");
    expect(env.ANTHROPIC_BASE_URL).toBe(
      "https://api.deepseek.com/anthropic",
    );
    expect(env.ANTHROPIC_MODEL).toBe("deepseek-v4-pro");
    expect(env.ANTHROPIC_DEFAULT_OPUS_MODEL).toBe("deepseek-v4-pro");
    expect(env.ANTHROPIC_DEFAULT_SONNET_MODEL).toBe("deepseek-v4-pro");
    expect(env.ANTHROPIC_DEFAULT_HAIKU_MODEL).toBe("deepseek-v4-pro");
    expect(env.CLAUDE_CODE_SUBAGENT_MODEL).toBe("deepseek-v4-pro");
  });
});

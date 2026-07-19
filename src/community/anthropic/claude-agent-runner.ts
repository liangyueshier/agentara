import {
  config,
  createLogger,
  extractTextContent,
  type MessageContent,
  type ToolMessage,
  type AgentRunner,
  type AgentRunOptions,
  type AssistantMessage,
  type SystemMessage,
  type UserMessage,
} from "@/shared";

const logger = createLogger("claude-agent-runner");

type ClaudeProcessEnv = Record<string, string | undefined>;

/**
 * Runtime overrides for Claude Code-compatible providers.
 */
export interface ClaudeAgentRunnerOptions {
  type?: string;
  model?: string;
  processName?: string;
  env?: ClaudeProcessEnv;
}

/**
 * Error thrown when the agent runner is aborted.
 */
export class AgentAbortError extends Error {
  constructor(message = "Agent execution was aborted") {
    super(message);
    this.name = "AgentAbortError";
  }
}

/**
 * The agent runner for Claude Code CLI.
 */
export class ClaudeAgentRunner implements AgentRunner {
  readonly type: string;

  private readonly _model?: string;
  private readonly _processName: string;
  private readonly _env: ClaudeProcessEnv;

  constructor(options: ClaudeAgentRunnerOptions = {}) {
    this.type = options.type ?? "claude";
    this._model = options.model;
    this._processName = options.processName ?? "Claude Code";
    this._env = options.env ?? {};
  }

  async *stream(
    message: UserMessage,
    options: AgentRunOptions,
  ): AsyncIterableIterator<SystemMessage | AssistantMessage | ToolMessage> {
    const sessionId = message.session_id;
    const isNew = options?.isNewSession ?? false;
    const signal = options?.signal;
    const textContentOfUserMessage = JSON.stringify(
      extractTextContent(message),
    );

    const args = [
      "claude",
      ...(!isNew ? ["--resume", sessionId] : ["--session-id", sessionId]),
      ...["--model", this._model ?? config.agents.default.model],
      ...["--output-format", "stream-json"],
      "--print",
      "--verbose",
      textContentOfUserMessage,
    ];
    const proc = Bun.spawn(args, {
      cwd: options.cwd,
      env: this._buildSpawnEnv(),
      stderr: "pipe",
    });

    // Handle abort signal
    let aborted = false;
    const abortHandler = () => {
      aborted = true;
      logger.info(
        { session_id: sessionId },
        `killing ${this._processName} process`,
      );
      proc.kill();
    };
    if (signal) {
      if (signal.aborted) {
        proc.kill();
        throw new AgentAbortError();
      }
      signal.addEventListener("abort", abortHandler, { once: true });
    }

    const decoder = new TextDecoder();
    const stderrChunks: Uint8Array[] = [];
    const stderrPipe = proc.stderr.pipeTo(
      new WritableStream({
        write(chunk) {
          stderrChunks.push(chunk);
        },
      }),
    );
    let buffer = "";
    let stdoutRaw = "";
    try {
      for await (const chunk of proc.stdout) {
        if (aborted) {
          break;
        }
        const decoded = decoder.decode(chunk, { stream: true });
        buffer += decoded;
        stdoutRaw += decoded;
        const lines = buffer.split("\n");
        buffer = lines.pop()!;
        for (const line of lines) {
          if (line.trim()) {
            const parsed = this._parseStreamLine(line.trim(), sessionId);
            if (parsed) {
              yield parsed;
            }
          }
        }
      }
      if (!aborted && buffer.trim()) {
        const parsed = this._parseStreamLine(buffer.trim(), sessionId);
        if (parsed) {
          yield parsed;
        }
      }
    } finally {
      if (signal) {
        signal.removeEventListener("abort", abortHandler);
      }
    }

    if (aborted) {
      throw new AgentAbortError();
    }

    const exitCode = await proc.exited;
    await stderrPipe;
    if (exitCode !== 0) {
      const stderrText =
        stderrChunks.length > 0
          ? decoder.decode(Bun.concatArrayBuffers(stderrChunks))
          : "";
      const parts: string[] = [];
      if (stdoutRaw.trim()) {
        parts.push(`Stdout:\n${stdoutRaw.trim()}`);
      }
      if (stderrText.trim()) {
        parts.push(`Stderr:\n${stderrText.trim()}`);
      }
      const detail = parts.length > 0 ? `\n\n${parts.join("\n\n")}` : "";
      throw new Error(
        `${this._processName} exited with code ${exitCode}${detail}`,
      );
    }
  }

  /**
   * Builds the environment passed to the Claude Code child process.
   * Provider-specific secrets are supplied only at process launch time.
   */
  protected _buildSpawnEnv(): ClaudeProcessEnv {
    return {
      ...Bun.env,
      ANTHROPIC_API_KEY: "",
      ...this._env,
    };
  }

  private _parseStreamLine(
    line: string,
    sessionId: string,
  ): AssistantMessage | ToolMessage | SystemMessage | null {
    try {
      const obj = JSON.parse(line);
      if (obj.type === "system") {
        const message: SystemMessage = {
          id: obj.uuid,
          session_id: obj.session_id,
          role: "system",
          subtype: obj.subtype,
        };
        return message;
      } else if (obj.type === "assistant" || obj.type === "user") {
        let role: "assistant" | "tool" = "assistant";
        if (obj.type === "user" && containsToolResult(obj.message)) {
          role = "tool";
        } else {
          role = "assistant";
        }
        const message: AssistantMessage | ToolMessage = {
          id: obj.uuid,
          session_id: sessionId,
          role,
          content: obj.message.content,
        };
        return message;
      }
      return null;
    } catch {
      return null;
    }
  }
}

function containsToolResult(message: { content: MessageContent[] }): boolean {
  return message.content.some((content) => content.type === "tool_result");
}

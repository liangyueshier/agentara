# DeepSeek provider

Agentara can run its existing Claude Code agent loop against DeepSeek's
Anthropic-compatible API endpoint.

## 1. Provide the API key through the environment

Do not put the key in `config.yaml`.

Linux / macOS:

```bash
export DEEPSEEK_API_KEY="your-key-here"
```

PowerShell:

```powershell
$env:DEEPSEEK_API_KEY="your-key-here"
```

For deployments, set `DEEPSEEK_API_KEY` through the platform's secret manager.
The repository ignores local `.env` files, but committed configuration must
never contain the real key.

## 2. Select DeepSeek in Agentara

Edit `$AGENTARA_HOME/config.yaml` (defaults to `~/.agentara/config.yaml`):

```yaml
agents:
  default:
    type: deepseek
    model: deepseek-v4-pro
```

No `api_key` field is required or supported in this configuration block.

## 3. Start Agentara

Claude Code must already be installed because Agentara reuses its streaming
agent interface and points it at DeepSeek at process launch time.

```bash
bun run dev
```

When `agents.default.type` is `deepseek`, creation of the runner fails with a
clear error if `DEEPSEEK_API_KEY` is absent.

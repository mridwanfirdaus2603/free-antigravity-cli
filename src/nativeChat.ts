import * as readline from 'readline/promises';
import { CustomModelEntry, listModels } from './config';
import * as registry from './proxy/registry';

interface NativeMessage {
  role: 'user' | 'model';
  parts: { text: string }[];
}

function getProvider(model: CustomModelEntry): string {
  return model.provider === 'custom' || model.provider === 'openrouter' ? 'openai' : model.provider;
}

function getRequestUrl(model: CustomModelEntry, provider: string): string {
  let url = model.apiUrl;
  if (provider === 'google' || provider === 'ollama') {
    return registry.getProviderUrl(url, model.externalModelName, false, registry.getTranslator(provider));
  }

  const isOpenAICompatible = [
    'openai', 'openrouter', 'custom', 'huggingface', 'groq', 'mistral', 'cerebras', 'nvidia',
    'opencode', 'codestral',
  ].includes(model.provider);
  if (isOpenAICompatible && !url.toLowerCase().includes('/chat/completions') && !url.toLowerCase().includes('/completions')) {
    if (url.endsWith('/v1')) url += '/chat/completions';
    else if (!url.endsWith('/')) url += '/v1/chat/completions';
    else url += 'v1/chat/completions';
  }
  return url;
}

export async function sendNativeMessage(model: CustomModelEntry, history: NativeMessage[]): Promise<string> {
  const provider = getProvider(model);
  const geminiBody = { contents: history };
  const payload = registry.translateRequest(provider, geminiBody, model.externalModelName);
  const headers = Object.fromEntries(
    Object.entries(registry.getProviderHeaders(model.provider, model.apiKey))
      .filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
  );
  const response = await fetch(getRequestUrl(model, provider), {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(model.timeout || 120_000),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`${model.provider} API returned HTTP ${response.status}: ${body.slice(0, 500)}`);
  }

  const mapped = registry.translateResponse(provider, await response.json(), model.name) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text = mapped.candidates?.[0]?.content?.parts
    ?.map((part) => part.text || '')
    .join('');
  if (!text) throw new Error(`${model.provider} returned no text response`);
  return text;
}

export async function runNativeChat(models: CustomModelEntry[] = listModels()): Promise<void> {
  if (models.length === 0) {
    console.error('No models configured. Add one first with "antigravity models add".');
    return;
  }

  let model = models[0];
  const history: NativeMessage[] = [];
  const terminal = readline.createInterface({ input: process.stdin, output: process.stdout });
  let active = true;
  terminal.on('SIGINT', () => terminal.close());
  terminal.on('close', () => { active = false; });

  console.log(`Native chat — ${model.displayName || model.name}`);
  console.log('Commands: /model [name], /clear, /exit');
  try {
    while (active) {
      let input: string;
      try {
        input = (await terminal.question('\nYou> ')).trim();
      } catch {
        break;
      }

      if (!input) continue;
      if (input === '/exit' || input === '/quit') break;
      if (input === '/clear') {
        history.length = 0;
        console.log('Conversation cleared.');
        continue;
      }
      if (input === '/model' || input.startsWith('/model ')) {
        const requested = input.slice('/model'.length).trim();
        if (!requested) {
          models.forEach((entry, index) => {
            console.log(`${index + 1}. ${entry.displayName || entry.name} (${entry.provider})`);
          });
          continue;
        }
        const selectedIndex = Number(requested) - 1;
        const selected = Number.isInteger(selectedIndex) && selectedIndex >= 0
          ? models[selectedIndex]
          : models.find(
            (entry) => entry.name === requested || entry.displayName === requested || entry.externalModelName === requested,
          );
        if (!selected) {
          console.error(`Model not found: ${requested}`);
          continue;
        }
        model = selected;
        console.log(`Using ${model.displayName || model.name}`);
        continue;
      }

      history.push({ role: 'user', parts: [{ text: input }] });
      try {
        const answer = await sendNativeMessage(model, history);
        history.push({ role: 'model', parts: [{ text: answer }] });
        console.log(`\n${model.displayName || model.name}> ${answer}`);
      } catch (error) {
        history.pop();
        console.error(`\nNative chat request failed: ${(error as Error).message}`);
      }
    }
  } finally {
    terminal.close();
  }
}

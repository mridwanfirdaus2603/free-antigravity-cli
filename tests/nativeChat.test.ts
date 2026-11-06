import { sendNativeMessage } from '../src/nativeChat';
import { CustomModelEntry } from '../src/config';

describe('native chat provider requests', () => {
  const model: CustomModelEntry = {
    name: 'models/test-model',
    displayName: 'Test Model',
    provider: 'openai',
    apiKey: 'test-key',
    apiUrl: 'https://api.example.test/v1',
    externalModelName: 'test-model',
  };
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test('sends the conversation directly to the configured provider and returns translated text', async () => {
    let requestUrl = '';
    let requestOptions: RequestInit | undefined;
    globalThis.fetch = jest.fn(async (input: unknown, init?: RequestInit) => {
      requestUrl = String(input);
      requestOptions = init;
      return new Response(JSON.stringify({
        choices: [{ message: { content: 'Hello from native chat' } }],
      }), { status: 200 });
    }) as typeof fetch;

    const result = await sendNativeMessage(model, [
      { role: 'user', parts: [{ text: 'Hello' }] },
    ]);

    expect(requestUrl).toBe('https://api.example.test/v1/chat/completions');
    expect(requestOptions?.headers).toEqual({
      'Content-Type': 'application/json',
      Authorization: 'Bearer test-key',
    });
    expect(JSON.parse(String(requestOptions?.body))).toMatchObject({
      model: 'test-model',
      messages: [{ role: 'user', content: 'Hello' }],
    });
    expect(result).toBe('Hello from native chat');
  });

  test('reports provider HTTP errors', async () => {
    globalThis.fetch = jest.fn(async () => new Response('invalid key', { status: 401 })) as typeof fetch;

    await expect(sendNativeMessage(model, [
      { role: 'user', parts: [{ text: 'Hello' }] },
    ])).rejects.toThrow('openai API returned HTTP 401: invalid key');
  });
});

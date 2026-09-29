import type { ChatInput, ChatResult } from '@jarvis/contracts'
import { getActiveProvider, type ActiveProviderCredentials } from './providerRepository'

export const JARVIS_PERSONA = [
  '你是sir的个人智能助理，代号贾维斯。',
  '默认使用简洁中文，先给结论，再解释必要细节。',
  '语气冷静、克制、精准、礼貌，带少量英式冷幽默。',
  '不得声称已经执行未实际执行的动作。',
  '修改、删除、上传、对外发送、付款、权限和日历写入必须先请求确认。'
].join('\n')

type FetchLike = typeof fetch

type OpenAiChatResponse = {
  choices?: Array<{ message?: { content?: string } }>
  error?: { message?: string }
}

function validatePrompt(prompt: string): string {
  const value = prompt.trim()
  if (!value) throw new Error('请输入要交给贾维斯的内容')
  if (value.length > 12_000) throw new Error('单次输入不能超过12000个字符')
  return value
}

export async function requestChatCompletion(
  provider: ActiveProviderCredentials,
  input: ChatInput,
  fetchImpl: FetchLike = fetch
): Promise<ChatResult> {
  const prompt = validatePrompt(input.prompt)
  const response = await fetchImpl(`${provider.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${provider.apiKey}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      model: provider.model,
      messages: [
        { role: 'system', content: JARVIS_PERSONA },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3,
      stream: false
    }),
    signal: AbortSignal.timeout(30_000)
  })
  const payload = await response.json() as OpenAiChatResponse
  if (!response.ok) throw new Error(`模型调用失败（${response.status}）：${payload.error?.message ?? '服务返回异常'}`)
  const content = payload.choices?.[0]?.message?.content?.trim()
  if (!content) throw new Error('模型没有返回有效文本')
  return { content, providerName: provider.name, model: provider.model }
}

export async function chatWithActiveProvider(input: ChatInput): Promise<ChatResult> {
  return requestChatCompletion(await getActiveProvider(), input)
}

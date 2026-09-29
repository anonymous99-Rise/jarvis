import { describe, expect, it, vi } from 'vitest'
import { JARVIS_PERSONA, requestChatCompletion } from '../apps/backend/src/services/models/modelGateway'
import type { ActiveProviderCredentials } from '../apps/backend/src/services/models/providerRepository'

// 模型请求测试不依赖本机 Electron 运行环境。
vi.mock('electron', () => ({ app: {}, safeStorage: {} }))

const provider: ActiveProviderCredentials = {
  id: 'provider-a',
  name: '供应商A',
  baseUrl: 'https://api.example.com/v1',
  model: 'model-a',
  hasKey: true,
  keyLast4: '1234',
  active: true,
  updatedAt: '2026-09-29T00:00:00.000Z',
  apiKey: 'secret-1234'
}

describe('模型网关', () => {
  it('使用当前供应商并保持统一人格', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: '随时待命，sir。' } }]
    }), { status: 200, headers: { 'content-type': 'application/json' } }))
    const result = await requestChatCompletion(provider, { prompt: '报告状态' }, fetchMock)
    expect(result).toEqual({ content: '随时待命，sir。', providerName: '供应商A', model: 'model-a' })
    const [url, request] = fetchMock.mock.calls[0]
    expect(url).toBe('https://api.example.com/v1/chat/completions')
    const body = JSON.parse(request.body)
    expect(body.messages[0].content).toBe(JARVIS_PERSONA)
    expect(request.headers.authorization).toBe('Bearer secret-1234')
  })

  it('不把空输入发送给外部模型', async () => {
    await expect(requestChatCompletion(provider, { prompt: '  ' }, vi.fn()))
      .rejects.toThrow('请输入')
  })
})

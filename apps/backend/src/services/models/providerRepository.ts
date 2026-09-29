import { app, safeStorage } from 'electron'
import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { ProviderInput, ProviderSummary } from '@jarvis/contracts'
import { validateProviderInput } from './providerSchema'

type StoredProvider = ProviderSummary & {
  keyCipher: string
}

export type ActiveProviderCredentials = ProviderSummary & {
  apiKey: string
}

function storePath(): string {
  return join(app.getPath('userData'), 'private', 'model-providers.json')
}

async function readStore(): Promise<StoredProvider[]> {
  try {
    return JSON.parse(await readFile(storePath(), 'utf8')) as StoredProvider[]
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw error
  }
}

async function writeStore(items: StoredProvider[]): Promise<void> {
  const path = storePath()
  const temp = `${path}.tmp`
  await mkdir(dirname(path), { recursive: true, mode: 0o700 })
  await writeFile(temp, JSON.stringify(items, null, 2), { encoding: 'utf8', mode: 0o600 })
  await rename(temp, path)
}

function encryptKey(apiKey: string): string {
  if (!safeStorage.isEncryptionAvailable()) throw new Error('当前系统安全存储不可用')
  return safeStorage.encryptString(apiKey).toString('base64')
}

function decryptKey(cipher: string): string {
  if (!cipher) return ''
  return safeStorage.decryptString(Buffer.from(cipher, 'base64'))
}

function toSummary(item: StoredProvider): ProviderSummary {
  const { keyCipher: _keyCipher, ...summary } = item
  return { ...summary, active: Boolean(summary.active) }
}

export async function listProviders(): Promise<ProviderSummary[]> {
  return (await readStore()).map(toSummary)
}

export async function saveProvider(input: ProviderInput): Promise<ProviderSummary> {
  const valid = validateProviderInput(input)
  const items = await readStore()
  const index = valid.id ? items.findIndex((item) => item.id === valid.id) : -1
  const previous = index >= 0 ? items[index] : undefined

  if (!valid.apiKey && !previous?.keyCipher) throw new Error('首次配置必须填写API Key')

  const keyCipher = valid.apiKey ? encryptKey(valid.apiKey) : previous!.keyCipher
  const keyLast4 = valid.apiKey ? valid.apiKey.slice(-4) : previous!.keyLast4
  const item: StoredProvider = {
    id: previous?.id ?? randomUUID(),
    name: valid.name,
    baseUrl: valid.baseUrl,
    model: valid.model,
    hasKey: Boolean(keyCipher),
    keyLast4,
    active: previous?.active ?? !items.some((provider) => provider.active),
    keyCipher,
    updatedAt: new Date().toISOString()
  }

  if (index >= 0) items[index] = item
  else items.push(item)
  await writeStore(items)
  return toSummary(item)
}

export async function activateProvider(id: string): Promise<ProviderSummary[]> {
  const items = await readStore()
  if (!items.some((item) => item.id === id)) throw new Error('找不到该供应商配置')
  for (const item of items) item.active = item.id === id
  await writeStore(items)
  return items.map(toSummary)
}

export async function getActiveProvider(): Promise<ActiveProviderCredentials> {
  const items = await readStore()
  const active = items.find((item) => item.active) ?? items[0]
  if (!active) throw new Error('尚未配置模型供应商')
  return { ...toSummary(active), apiKey: decryptKey(active.keyCipher) }
}

export async function testProvider(id: string): Promise<{ ok: boolean; message: string }> {
  const provider = (await readStore()).find((item) => item.id === id)
  if (!provider) return { ok: false, message: '找不到该供应商配置' }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 8_000)
  try {
    const response = await fetch(`${provider.baseUrl}/models`, {
      headers: { Authorization: `Bearer ${decryptKey(provider.keyCipher)}` },
      signal: controller.signal
    })
    if (!response.ok) return { ok: false, message: `连接失败，服务返回 ${response.status}` }
    return { ok: true, message: '连接正常，密钥未写入日志' }
  } catch (error) {
    const message = error instanceof Error && error.name === 'AbortError' ? '连接超时' : '无法连接该服务'
    return { ok: false, message }
  } finally {
    clearTimeout(timer)
  }
}

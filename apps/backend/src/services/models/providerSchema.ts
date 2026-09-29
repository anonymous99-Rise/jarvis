import type { ProviderInput } from '@jarvis/contracts'

export type ValidatedProviderInput = Omit<ProviderInput, 'baseUrl'> & {
  baseUrl: string
}

export function validateProviderInput(input: ProviderInput): ValidatedProviderInput {
  const name = input.name.trim()
  const model = input.model.trim()
  const apiKey = input.apiKey?.trim()

  if (name.length < 2 || name.length > 60) throw new Error('供应商名称需为2-60个字符')
  if (!model || model.length > 120) throw new Error('请输入有效的模型名称')

  let url: URL
  try {
    url = new URL(input.baseUrl.trim())
  } catch {
    throw new Error('Base URL格式不正确')
  }

  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Base URL仅支持HTTP或HTTPS')
  if (url.username || url.password) throw new Error('Base URL不得包含账号或密码')

  return {
    ...input,
    name,
    model,
    baseUrl: url.toString().replace(/\/$/, ''),
    apiKey
  }
}

export function redactSecret(value: string): string {
  if (value.length <= 4) return '*'.repeat(value.length)
  return `${'*'.repeat(Math.min(8, value.length - 4))}${value.slice(-4)}`
}

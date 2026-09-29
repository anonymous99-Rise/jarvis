import { describe, expect, it } from 'vitest'
import { redactSecret, validateProviderInput } from '../apps/backend/src/services/models/providerSchema'

describe('provider schema', () => {
  it('normalizes a compatible provider', () => {
    expect(validateProviderInput({
      name: ' OpenAI Compatible ',
      baseUrl: 'https://api.example.com/v1/',
      model: ' model-a ',
      apiKey: 'secret-1234'
    })).toMatchObject({
      name: 'OpenAI Compatible',
      baseUrl: 'https://api.example.com/v1',
      model: 'model-a'
    })
  })

  it('rejects embedded credentials', () => {
    expect(() => validateProviderInput({
      name: 'Bad Provider',
      baseUrl: 'https://user:pass@example.com/v1',
      model: 'model-a'
    })).toThrow('不得包含账号或密码')
  })

  it('redacts all but the final four characters', () => {
    expect(redactSecret('secret-1234')).toBe('*******1234')
  })
})

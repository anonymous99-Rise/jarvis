import { describe, expect, it } from 'vitest'
import {
  isHumanHandoffResponse,
  isSupportedTenderFile,
  sanitizeTenderFilename,
  validateOfficialProcurementUrl,
  validateRedirectUrl
} from '../apps/backend/src/services/download/downloadPolicy'

describe('政府采购文件下载策略', () => {
  it('只允许已登记官网的 HTTPS 地址', () => {
    expect(validateOfficialProcurementUrl('https://www.ccgp-ningxia.gov.cn/a.pdf').allowed).toBe(true)
    expect(validateOfficialProcurementUrl('http://www.ccgp-ningxia.gov.cn/a.pdf').allowed).toBe(false)
    expect(validateOfficialProcurementUrl('https://www.ccgp-ningxia.gov.cn.attacker.test/a.pdf').allowed).toBe(false)
  })

  it('逐跳检查重定向，不跟随到非官网域名', () => {
    expect(validateRedirectUrl('https://www.ccgp-ningxia.gov.cn/a', '/b')).toMatchObject({
      allowed: true,
      url: 'https://www.ccgp-ningxia.gov.cn/b'
    })
    expect(validateRedirectUrl('https://www.ccgp-ningxia.gov.cn/a', 'https://example.com/b').allowed).toBe(false)
  })

  it('清理文件名中的路径和非法字符，并阻止可执行文件', () => {
    expect(sanitizeTenderFilename('../../报价:材料.pdf')).toBe('报价_材料.pdf')
    expect(sanitizeTenderFilename('')).toBe('招标文件')
    expect(isSupportedTenderFile('application/pdf', 'tender.pdf').allowed).toBe(true)
    expect(isSupportedTenderFile('application/octet-stream', 'payload.exe').allowed).toBe(false)
    expect(isSupportedTenderFile('text/html', 'login.html').allowed).toBe(false)
  })

  it('识别登录或验证码页面并转入人工接管', () => {
    expect(isHumanHandoffResponse('text/html', '<p>请先登录后下载</p>')).toBe(true)
    expect(isHumanHandoffResponse('application/pdf', '请登录')).toBe(false)
  })
})

const OFFICIAL_PROCUREMENT_HOSTS = new Set([
  'www.ccgp.gov.cn',
  'ccgp.gov.cn',
  'www.ccgp-ningxia.gov.cn',
  'ccgp-ningxia.gov.cn',
  'www.nxggzy.org.cn',
  'nxggzy.org.cn'
])

export type DownloadPolicyDecision = { allowed: boolean; reason: string }

export function validateOfficialProcurementUrl(input: string): DownloadPolicyDecision {
  let url: URL
  try {
    url = new URL(input)
  } catch {
    return { allowed: false, reason: '下载链接格式无效。' }
  }
  if (url.protocol !== 'https:') return { allowed: false, reason: '下载链接必须使用 HTTPS。' }
  if (url.username || url.password) return { allowed: false, reason: '下载链接不能包含账号或密码。' }
  if (!OFFICIAL_PROCUREMENT_HOSTS.has(url.hostname.toLowerCase())) {
    return { allowed: false, reason: '下载只允许来自已登记的政府采购官网域名。' }
  }
  return { allowed: true, reason: '官方 HTTPS 域名校验通过。' }
}

export function validateRedirectUrl(currentUrl: string, location: string): DownloadPolicyDecision & { url?: string } {
  try {
    const next = new URL(location, currentUrl)
    const decision = validateOfficialProcurementUrl(next.toString())
    return decision.allowed ? { ...decision, url: next.toString() } : decision
  } catch {
    return { allowed: false, reason: '官网返回的跳转地址无效。' }
  }
}

export function sanitizeTenderFilename(input: string): string {
  const basename = input.replace(/\\/g, '/').split('/').pop() ?? ''
  const cleaned = basename
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_')
    .replace(/[. ]+$/g, '')
    .trim()
    .slice(0, 160)
  if (!cleaned || cleaned === '.' || cleaned === '..') return '招标文件'
  return cleaned
}

export function isHumanHandoffResponse(contentType: string, body: string): boolean {
  return /text\/html|application\/xhtml/i.test(contentType)
    && /验证码|安全验证|请先登录|登录后(?:查看|下载)|访问验证|captcha|sign\s*in/i.test(body)
}

export function isSupportedTenderFile(contentType: string, filename: string): DownloadPolicyDecision {
  const normalizedType = contentType.split(';', 1)[0].trim().toLowerCase()
  const extension = filename.split('.').pop()?.toLowerCase() ?? ''
  if (/\.(?:exe|msi|bat|cmd|com|scr|js|vbs|ps1)$/i.test(filename)) {
    return { allowed: false, reason: '可执行文件不属于允许下载的招标材料类型。' }
  }
  if (/text\/html|application\/xhtml/i.test(normalizedType)) {
    return { allowed: false, reason: '官网返回的是网页，不是招标文件。' }
  }
  const allowedTypes = new Set([
    'application/pdf', 'application/zip', 'application/x-zip-compressed',
    'application/octet-stream', 'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ])
  const allowedExtensions = new Set(['pdf', 'zip', 'rar', 'doc', 'docx', 'xls', 'xlsx', '7z'])
  if (allowedTypes.has(normalizedType) || allowedExtensions.has(extension)) {
    return { allowed: true, reason: '文件类型符合受控下载策略。' }
  }
  return { allowed: false, reason: '文件类型无法确认，需要在官网人工核验。' }
}

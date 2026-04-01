/** 将各模块 health 接口的 code / message 转为简短用户文案 */
export function formatHealthStatus(code: number, message: string): string {
  const msg = (message ?? '').trim()
  if (code === 0) {
    if (!msg || msg.toLowerCase() === 'ok') return '服务正常'
    return `服务正常（${msg}）`
  }
  if (msg) return `不可用：${msg}（code ${code}）`
  return `不可用（code ${code}）`
}

export function isHealthStatusOk(label: string): boolean {
  return label.startsWith('服务正常')
}

export function isHealthStatusErr(label: string): boolean {
  return (
    label.startsWith('不可用') ||
    label.includes('失败') ||
    label.includes('不可用:') ||
    label.includes('后端不可用')
  )
}

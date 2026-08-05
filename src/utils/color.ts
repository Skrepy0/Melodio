/**
 * 将十六进制颜色转为 RGB 数组
 */
function hexToRgb(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!result) return [0, 0, 0]
  return [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)]
}

/**
 * RGB 数组转十六进制
 */
function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.min(255, Math.max(0, Math.round(v)))
  return `#${clamp(r).toString(16).padStart(2, '0')}${clamp(g).toString(16).padStart(2, '0')}${clamp(b).toString(16).padStart(2, '0')}`
}

/**
 * 混色函数
 * @param colorA 起始颜色
 * @param colorB 目标颜色
 * @param t 混合比例 0~1（0 全 A，1 全 B）
 */
export function mixColors(colorA: string, colorB: string, t: number): string {
  const [r1, g1, b1] = hexToRgb(colorA)
  const [r2, g2, b2] = hexToRgb(colorB)

  const r = r1 + (r2 - r1) * t
  const g = g1 + (g2 - g1) * t
  const b = b1 + (b2 - b1) * t

  return rgbToHex(r, g, b)
}
export function getContrastText(hex: string): '#ffffff' | '#000000' {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255

  const luminance = 0.299 * r + 0.587 * g + 0.114 * b

  return luminance > 0.5 ? '#000000' : '#ffffff'
}

export type ColorConfig = {
  bg: string
  text: string
  accent: string
  marker: string
}

export const DEFAULT_LIGHT_COLORS: ColorConfig = {
  bg: '#FAFAF8',
  text: '#374151',
  accent: '#6366f1',
  marker: '#818cf8',
}

export const DEFAULT_DARK_COLORS: ColorConfig = {
  bg: '#1C1C1E',
  text: '#d1d5db',
  accent: '#818cf8',
  marker: '#6366f1',
}

export const LIGHT_COLORS_KEY = 'thinkspeed-light-colors'
export const DARK_COLORS_KEY = 'thinkspeed-dark-colors'
export const EMPHASIS_COLORS_KEY = 'thinkspeed-emphasis-colors'
export const DEFAULT_EMPHASIS_COLORS: [string, string, string] = ['#ef4444', '#3b82f6', '#22c55e']

export const EMPHASIS_COLOR_SWATCHES = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6',
  '#ec4899', '#f43f5e', '#14b8a6', '#a855f7', '#06b6d4', '#84cc16',
]

export function loadEmphasisColorsFromStorage(): [string, string, string] {
  try {
    const raw = localStorage.getItem(EMPHASIS_COLORS_KEY)
    if (!raw) return [...DEFAULT_EMPHASIS_COLORS]
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return [...DEFAULT_EMPHASIS_COLORS]
    return [
      typeof parsed[0] === 'string' ? parsed[0] : DEFAULT_EMPHASIS_COLORS[0],
      typeof parsed[1] === 'string' ? parsed[1] : DEFAULT_EMPHASIS_COLORS[1],
      typeof parsed[2] === 'string' ? parsed[2] : DEFAULT_EMPHASIS_COLORS[2],
    ]
  } catch {
    return [...DEFAULT_EMPHASIS_COLORS]
  }
}

export function applyColorsToDOM(lightColors: ColorConfig, darkColors: ColorConfig) {
  const el = document.documentElement
  el.style.setProperty('--ts-light-bg-main', lightColors.bg)
  el.style.setProperty('--ts-light-text-color', lightColors.text)
  el.style.setProperty('--ts-light-accent', lightColors.accent)
  el.style.setProperty('--ts-light-marker', lightColors.marker)
  el.style.setProperty('--ts-dark-bg-main', darkColors.bg)
  el.style.setProperty('--ts-dark-text-color', darkColors.text)
  el.style.setProperty('--ts-dark-accent', darkColors.accent)
  el.style.setProperty('--ts-dark-marker', darkColors.marker)
  // ::marker 疑似要素では CSS 変数のエイリアスチェーン (var(--ts-light-marker)) が
  // 正しく解決されないケースがあるため、アクティブな値を直接セットする
  const isDark = el.classList.contains('dark')
  el.style.setProperty('--ts-marker', isDark ? darkColors.marker : lightColors.marker)
}

export function loadColorsFromStorage(): { light: ColorConfig; dark: ColorConfig } {
  const tryParse = (key: string, defaults: ColorConfig): ColorConfig => {
    try {
      const raw = localStorage.getItem(key)
      if (!raw) return defaults
      const parsed = JSON.parse(raw)
      return {
        bg:     typeof parsed.bg     === 'string' ? parsed.bg     : defaults.bg,
        text:   typeof parsed.text   === 'string' ? parsed.text   : defaults.text,
        accent: typeof parsed.accent === 'string' ? parsed.accent : defaults.accent,
        marker: typeof parsed.marker === 'string' ? parsed.marker : defaults.marker,
      }
    } catch {
      return defaults
    }
  }
  return {
    light: tryParse(LIGHT_COLORS_KEY, DEFAULT_LIGHT_COLORS),
    dark: tryParse(DARK_COLORS_KEY, DEFAULT_DARK_COLORS),
  }
}

// ─── カラーパレット ────────────────────────────────────────────────

export const BG_LIGHT_SWATCHES = [
  // 白系
  '#FFFFFF', '#FAFAFA', '#F5F5F5', '#F0F0F0', '#E8E8E8',
  // ウォーム
  '#FAFAF8', '#F8F6F2', '#F5F0E8', '#EDE4D3', '#E5D9C4',
  // クール
  '#F7F8FA', '#F0F2F8', '#E8EDF5', '#DDE5F0', '#D2DCEB',
  // グリーン
  '#F4F8F5', '#EBF5ED', '#DFF0E3', '#D0E9D5', '#C2E0CA',
  // ローズ / ラベンダー
  '#FDF5F6', '#F8EBEF', '#F5E4EC', '#F0E6F5', '#E8DDF5',
]

export const BG_DARK_SWATCHES = [
  // ブラック系
  '#000000', '#080808', '#0F0F0F', '#141414', '#1A1A1A',
  // ニュートラル
  '#1C1C1E', '#202020', '#252526', '#2C2C2E', '#333333',
  // クール（ブルー系）
  '#0F1117', '#0F172A', '#111827', '#1A2332', '#1C2A3A',
  // ウォーム（ブラウン系）
  '#1E1510', '#1A1209', '#201A15', '#2A2018', '#17110C',
  // カラー（グリーン / パープル）
  '#0E1A10', '#0A1512', '#131A18', '#1A1025', '#0F0A1A',
]

export const TEXT_LIGHT_SWATCHES = [
  '#111827', '#1F2937', '#374151', '#4B5563', '#6B7280',
  '#1E3A5F', '#1A3A2A', '#4A1D96', '#7C2D12', '#2D1A3A',
]

export const TEXT_DARK_SWATCHES = [
  '#FFFFFF', '#F9FAFB', '#F3F4F6', '#E5E7EB', '#D1D5DB',
  '#BFDBFE', '#BBF7D0', '#FDE8D8', '#EDE9FE', '#9CA3AF',
]

export const ACCENT_SWATCHES = [
  '#6366F1', '#818CF8', '#8B5CF6', '#3B82F6', '#0EA5E9',
  '#10B981', '#22C55E', '#F59E0B', '#EF4444', '#F97316',
  '#EC4899', '#14B8A6', '#A78BFA', '#60A5FA', '#34D399',
]

export const MARKER_SWATCHES = [
  '#6366F1', '#818CF8', '#A78BFA', '#C4B5FD', '#8B5CF6',
  '#3B82F6', '#60A5FA', '#0EA5E9', '#38BDF8', '#67E8F9',
  '#10B981', '#34D399', '#22C55E', '#86EFAC', '#4ADE80',
  '#F59E0B', '#FBBF24', '#EF4444', '#F87171', '#EC4899',
  '#9CA3AF', '#6B7280', '#D1D5DB', '#F97316', '#14B8A6',
]

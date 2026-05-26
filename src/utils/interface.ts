export interface CircleButtonProps {
  icon: string // 图标名称（Iconify 格式，如 'mdi:heart'）
  size?: number | string // 按钮尺寸（宽高），默认 48px
  bgColor?: string // 背景色，默认使用主题的 --bg-header 或当前背景
  iconColor?: string // 图标颜色，默认使用主题的 --text-color
  disabled?: boolean // 是否禁用
}
export interface DropdownItem {
  icon?: string
  description: string
  value?: any
  disabled?: boolean
}
export interface DropdownButtonProps {
  // 圆形按钮相关属性（透传）
  buttonIcon?: string // 圆形按钮上的图标，默认 'mdi:dots-horizontal'
  size?: number | string // 按钮尺寸
  bgColor?: string // 按钮背景色
  iconColor?: string // 按钮图标颜色
  disabled?: boolean // 是否禁用按钮
  // 下拉菜单相关属性
  options: DropdownItem[] // 下拉选项列表
  placement?: 'bottom-start' | 'bottom-end' | 'top-start' | 'top-end'
  maxHeight?: string
  itemIconSize?: number // 选项内的图标尺寸
  dx?: number // x轴偏移
  dy?: number // y轴偏移
}

export interface HorizontalSelectOption {
  value: any
  label?: string
  description?: string // 兼容 description
  icon?: string
  disabled?: boolean
}

export interface HorizontalSelectProps {
  options: HorizontalSelectOption[]
  modelValue?: any // v-model 绑定的值
  iconSize?: number | string
}
export interface Song {
  id: string | number
  name: string
  artist: string
  duration: number // 秒数
  coverUrl?: string // 可选封面图
}

export interface SongItemSelectableProps {
  song: Song
  selectable: boolean
  selected: boolean
}

export interface NowPlayingSong {
  id: string | number
  name: string
  artist: string
  coverUrl?: string
  audioUrl?: string
}

// 播放列表数据结构
export interface Playlist {
  id: string | number
  name: string
  description?: string // 描述（如“我的最爱”）
  coverUrl?: string
  songCount: number // 包含的歌曲数量
}

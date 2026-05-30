import { createVNode, render } from 'vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'

export interface ConfirmOptions {
  title?: string
  message: string
  confirmText?: string
  cancelText?: string
}

export function showConfirm(options: ConfirmOptions): Promise<boolean> {
  // 创建容器
  const container = document.createElement('div')
  document.body.appendChild(container)

  // 创建 VNode
  const vnode = createVNode(ConfirmDialog, {
    title: options.title,
    message: options.message,
    confirmText: options.confirmText,
    cancelText: options.cancelText,
  })

  // 渲染组件
  render(vnode, container)

  // 获取组件实例
  const instance = vnode.component

  // 调用实例的 show 方法获取 Promise
  if (instance?.exposed?.show) {
    return instance.exposed.show() as Promise<boolean>
  }
  return Promise.resolve(false)
}

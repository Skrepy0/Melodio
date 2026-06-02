import { createVNode, render } from 'vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'

export interface ConfirmOptions {
  title?: string
  message: string
  confirmText?: string
  cancelText?: string
}

export function showConfirm(options: ConfirmOptions): Promise<boolean> {
  const container = document.createElement('div')
  document.body.appendChild(container)

  const vnode = createVNode(ConfirmDialog, {
    title: options.title,
    message: options.message,
    confirmText: options.confirmText,
    cancelText: options.cancelText,
  })

  render(vnode, container)

  const instance = vnode.component

  if (instance?.exposed?.show) {
    return instance.exposed.show() as Promise<boolean>
  }
  return Promise.resolve(false)
}

import { createVNode, render } from 'vue'
import type { ToastType } from '@/components/ToastCard.vue'
import ToastComponent from '@/components/ToastCard.vue'

let toastInstance: any = null
let container: HTMLDivElement | null = null

const showToast = (message: string, type: ToastType = 'info', duration = 2000) => {
  if (toastInstance) {
    toastInstance.show(message, type, duration)
    return
  }
  container = document.createElement('div')
  document.body.appendChild(container)
  const vnode = createVNode(ToastComponent)
  render(vnode, container)

  toastInstance = vnode.component?.exposed
  if (toastInstance) {
    toastInstance.show(message, type, duration)
  }
}

export default {
  success: (msg: string, duration?: number) => showToast(msg, 'success', duration),
  error: (msg: string, duration?: number) => showToast(msg, 'error', duration),
  warning: (msg: string, duration?: number) => showToast(msg, 'warning', duration),
  info: (msg: string, duration?: number) => showToast(msg, 'info', duration),
}

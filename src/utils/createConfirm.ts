import { createVNode, render } from 'vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import { getDialogAppContext } from '@/utils/appContext'

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

  const appContext = getDialogAppContext()
  if (appContext) vnode.appContext = appContext

  render(vnode, container)

  const cleanup = () => {
    // Unmount first so the dialog's focus-restore hook runs, then drop the host.
    render(null, container)
    if (container.parentNode) {
      container.parentNode.removeChild(container)
    }
  }

  const instance = vnode.component

  if (instance?.exposed?.show) {
    return (instance.exposed.show() as Promise<boolean>).finally(cleanup)
  }
  cleanup()
  return Promise.resolve(false)
}

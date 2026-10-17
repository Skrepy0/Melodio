import { createVNode, render } from 'vue'
import PromptComponent from '@/components/PromptDialog.vue'

export interface PromptOptions {
  title?: string
  message?: string
  defaultValue?: string
  placeholder?: string
  confirmContent?: string
  cancelContent?: string
}

export function showPrompt(options: PromptOptions = {}): Promise<string | null> {
  const container = document.createElement('div')
  document.body.appendChild(container)

  const vnode = createVNode(PromptComponent, {
    title: options.title,
    message: options.message,
    defaultValue: options.defaultValue,
    placeholder: options.placeholder,
    confirmContent: options.confirmContent,
    cancelContent: options.cancelContent,
  })

  render(vnode, container)

  const cleanup = () => {
    render(null, container)
    if (container.parentNode) {
      container.parentNode.removeChild(container)
    }
  }

  const instance = vnode.component

  if (instance?.exposed?.show) {
    return (instance.exposed.show() as Promise<string | null>).finally(cleanup)
  }
  cleanup()
  return Promise.resolve(null)
}

import { createVNode, render } from 'vue'
import PromptComponent from '@/components/PromptDialog.vue'

let container: HTMLDivElement | null = null
let currentInstance: any = null

export interface PromptOptions {
  title?: string
  message?: string
  defaultValue?: string
  placeholder?: string
}

export function showPrompt(options: PromptOptions = {}): Promise<string | null> {
  if (currentInstance) {
    currentInstance.unmount?.()
    if (container?.parentNode) {
      container.parentNode.removeChild(container)
    }
    container = null
    currentInstance = null
  }

  container = document.createElement('div')
  document.body.appendChild(container)

  const vnode = createVNode(PromptComponent, {
    title: options.title,
    message: options.message,
    defaultValue: options.defaultValue,
    placeholder: options.placeholder,
  })

  render(vnode, container)

  currentInstance = vnode.component

  if (currentInstance?.exposed?.show) {
    return currentInstance.exposed.show() as Promise<string | null>
  }
  return Promise.resolve(null)
}

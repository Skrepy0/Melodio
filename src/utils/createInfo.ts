import { createVNode, render } from 'vue'
import InfoDialog from '@/components/InfoDialog.vue'
import { OnlineSong, Song } from '@/utils/interface'
import { getDialogAppContext } from '@/utils/appContext'

export function showSongInfo(song: Song | OnlineSong): Promise<boolean> {
  const container = document.createElement('div')
  document.body.appendChild(container)

  const vnode = createVNode(InfoDialog, {
    song,
  })

  const appContext = getDialogAppContext()
  if (appContext) {
    vnode.appContext = appContext
  }

  render(vnode, container)

  const instance = vnode.component
  if (!instance?.exposed?.show) {
    render(null, container)
    document.body.removeChild(container)
    return Promise.resolve(false)
  }

  const promise = instance.exposed.show() as Promise<boolean>

  return promise.finally(() => {
    render(null, container)
    if (container.parentNode) {
      document.body.removeChild(container)
    }
  })
}

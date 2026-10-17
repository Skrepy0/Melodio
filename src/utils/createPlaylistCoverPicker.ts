import { createVNode, render } from 'vue'
import PlaylistCoverPicker from '@/components/PlaylistCoverPicker.vue'
import type { Playlist } from '@/utils/interface'
import { getDialogAppContext } from '@/utils/appContext'

/**
 * Let the user pick a playlist cover.
 * Resolves with the new cover URL, `null` to reset to the default, or
 * `undefined` when the dialog was dismissed.
 */
export function showPlaylistCoverPicker(playlist: Playlist): Promise<string | null | undefined> {
  const container = document.createElement('div')
  document.body.appendChild(container)

  const vnode = createVNode(PlaylistCoverPicker)
  const appContext = getDialogAppContext()
  if (appContext) vnode.appContext = appContext

  render(vnode, container)

  const cleanup = () => {
    render(null, container)
    if (container.parentNode) {
      container.parentNode.removeChild(container)
    }
  }

  const instance = vnode.component

  if (instance?.exposed?.show) {
    return (instance.exposed.show(playlist) as Promise<string | null | undefined>).finally(cleanup)
  }
  cleanup()
  return Promise.resolve(undefined)
}

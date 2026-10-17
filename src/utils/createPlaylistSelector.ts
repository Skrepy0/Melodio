import { createVNode, render } from 'vue'
import PlaylistSelectorDialog from '@/components/PlaylistSelectorDialog.vue'
import type { Playlist } from '@/utils/interface'
import { getDialogAppContext } from '@/utils/appContext'

export function showPlaylistSelector(
  playlists: Playlist[],
  head: string,
  likeListName: string,
  likeListDescription: string
): Promise<Playlist | null> {
  const container = document.createElement('div')
  document.body.appendChild(container)

  const vnode = createVNode(PlaylistSelectorDialog, {
    title: head,
    likeListName: likeListName,
    likeListDescription: likeListDescription,
  })
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
    return (instance.exposed.show(playlists) as Promise<Playlist | null>).finally(cleanup)
  }
  cleanup()
  return Promise.resolve(null)
}

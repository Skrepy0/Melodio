import { createVNode, render } from 'vue'
import PlaylistSelectorDialog from '@/components/PlaylistSelectorDialog.vue'
import type { Playlist } from '@/utils/interface'

let container: HTMLDivElement | null = null
let instance: any = null

export function showPlaylistSelector(
  playlists: Playlist[],
  head: string,
  likeListName: string,
  likeListDescription: string
): Promise<Playlist | null> {
  if (container) {
    document.body.removeChild(container)
    container = null
    instance = null
  }

  container = document.createElement('div')
  document.body.appendChild(container)

  const vnode = createVNode(PlaylistSelectorDialog, {
    title: head,
    likeListName: likeListName,
    likeListDescription: likeListDescription,
  })
  render(vnode, container)
  instance = vnode.component

  if (instance?.exposed?.show) {
    return instance.exposed.show(playlists) as Promise<Playlist | null>
  }
  return Promise.resolve(null)
}

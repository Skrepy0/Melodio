import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import type { Plugin } from 'vite'

/** Bundle literal mdi: references from source so icons remain available offline. */
export function mdiIcons(): Plugin {
  const virtualId = 'virtual:mdi-icons'
  const resolvedId = '\0' + virtualId
  const sourceDir = path.resolve('src')
  return {
    name: 'melodio-mdi-icons',
    resolveId(id) {
      if (id === virtualId) return resolvedId
    },
    load(id) {
      if (id !== resolvedId) return
      const names = new Set<string>()
      const scan = (directory: string) => {
        for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
          const file = path.join(directory, entry.name)
          if (entry.isDirectory()) scan(file)
          else if (/\.(vue|ts|js|json)$/.test(file)) {
            this.addWatchFile(file)
            for (const match of fs
              .readFileSync(file, 'utf8')
              .matchAll(/mdi:([a-z0-9]+(?:-[a-z0-9]+)*)/g))
              names.add(match[1])
          }
        }
      }
      scan(sourceDir)
      const require = createRequire(import.meta.url)
      const collection = require('@iconify-json/mdi/icons.json')
      const icons: Record<string, unknown> = {}
      const aliases: Record<string, unknown> = {}
      const add = (name: string) => {
        if (collection.icons[name]) icons[name] = collection.icons[name]
        else if (collection.aliases?.[name]) {
          aliases[name] = collection.aliases[name]
          add(collection.aliases[name].parent)
        }
      }
      for (const name of names) add(name)
      return `export default ${JSON.stringify({ prefix: 'mdi', width: collection.width, height: collection.height, icons, aliases })}`
    },
    handleHotUpdate({ server, file, modules }) {
      if (path.resolve(file).startsWith(sourceDir + path.sep)) {
        const module = server.moduleGraph.getModuleById(resolvedId)
        if (module) {
          server.moduleGraph.invalidateModule(module)
          return [...modules, module]
        }
      }
    },
  }
}

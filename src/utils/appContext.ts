import type { AppContext } from 'vue'

/**
 * Vue app context for components rendered imperatively (dialogs created with
 * `createVNode` + `render` outside the mounted tree). Without it, such
 * components have no app, so `useI18n()` and global components fail.
 */
let appContext: AppContext | null = null

export function setDialogAppContext(context: AppContext) {
  appContext = context
}

export function getDialogAppContext(): AppContext | null {
  return appContext
}

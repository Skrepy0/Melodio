import { nextTick, onBeforeUnmount, onMounted, type Ref } from 'vue'

/**
 * Minimal dialog accessibility contract shared by the imperative dialogs:
 * moves focus into the dialog, closes on Escape, and restores focus to the
 * element that was focused before the dialog opened.
 */
export function useDialogA11y(
  containerRef: Ref<HTMLElement | null>,
  onEscape: () => void,
  isOpen: () => boolean = () => true
) {
  let previouslyFocused: HTMLElement | null = null

  const focusFirst = () => {
    const root = containerRef.value
    if (!root) return
    const target = root.querySelector<HTMLElement>(
      '[data-autofocus], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )
    target?.focus()
  }

  const handleKeydown = (event: KeyboardEvent) => {
    if (event.key === 'Escape' && isOpen()) {
      event.stopPropagation()
      onEscape()
    }
  }

  onMounted(async () => {
    previouslyFocused = document.activeElement as HTMLElement | null
    await nextTick()
    focusFirst()
    document.addEventListener('keydown', handleKeydown)
  })

  onBeforeUnmount(() => {
    document.removeEventListener('keydown', handleKeydown)
    previouslyFocused?.focus?.()
  })

  return { focusFirst }
}

/** Keep Tab focus cycling inside the dialog while it is open. */
export function trapTabKey(event: KeyboardEvent, root: HTMLElement | null) {
  if (event.key !== 'Tab' || !root) return
  const focusable = Array.from(
    root.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
    )
  ).filter((el) => el.offsetParent !== null)
  if (focusable.length === 0) return
  const first = focusable[0]
  const last = focusable[focusable.length - 1]
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first.focus()
  }
}

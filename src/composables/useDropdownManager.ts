import { ref } from 'vue'

export function useDropdownManager() {
  const openDropdownId = ref<string | number | null>(null)

  const handleDropdownToggle = (id: string | number, isOpen: boolean) => {
    if (isOpen) {
      openDropdownId.value = id
    } else {
      if (openDropdownId.value === id) {
        openDropdownId.value = null
      }
    }
  }

  const closeAllDropdowns = () => {
    openDropdownId.value = null
  }

  return {
    openDropdownId,
    handleDropdownToggle,
    closeAllDropdowns,
  }
}

import { computed } from 'vue'

export function useDropdownControl(
  props: { dropdownOpen?: boolean },
  emit: (event: 'update:dropdownOpen', value: boolean) => void
) {
  const dropdownVisible = computed({
    get: () => props.dropdownOpen ?? false,
    set: (val: boolean) => emit('update:dropdownOpen', val),
  })

  return {
    dropdownVisible,
  }
}

export function getNextSongIndex(idx: number, queueLength: number) {
  if (queueLength === 0) return { idx: idx, meg: 'error' }
  const newIdx = (idx + 1) % queueLength
  return { idx: newIdx, meg: 'success' }
}

export function getPrevSongIndex(idx: number, queueLength: number) {
  if (queueLength === 0) return { idx: idx, meg: 'error' }
  const newIdx = (idx - 1 + queueLength) % queueLength
  return { idx: newIdx, meg: 'success' }
}

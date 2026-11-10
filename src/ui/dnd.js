import { pointerWithin } from '@dnd-kit/core'

export const COLUMN_IDS = ['todo', 'doing', 'done']

// Prima la card sotto il puntatore, poi la colonna sotto il puntatore (anche vuota).
// Fuori dalle colonne abilitate (Chiusi, margini) nessuna destinazione: il rilascio non fa niente.
export function collide(args) {
  const hits = pointerWithin(args)
  const cards = hits.filter(h => !COLUMN_IDS.includes(h.id))
  return cards.length ? cards : hits
}

// Rilascio sullo sfondo della colonna: posizione = quante card hanno il centro sopra il puntatore.
export function dropIndex(centers, y) {
  return centers.filter(c => c < y).length
}

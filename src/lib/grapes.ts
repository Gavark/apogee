// Many wines (Alsace, Vin de France…) are named after their grape rather than a cuvée:
// on a cellar card, a single grape is what tells two otherwise identical bottles apart.
// Blends and annotated values ("Merlot, Cabernet Franc (assemblage typique)") stay off
// the card: they are long, and the detail page shows them in full.

const MAX_LEN = 30;
const BLEND = /[,;/&+()]|\set\s/i;

/** The grape when `grapes` names exactly one, otherwise null. */
export function singleGrape(grapes: string | null): string | null {
  const g = grapes?.trim() ?? '';
  if (!g || g.length > MAX_LEN || BLEND.test(g)) return null;
  return g;
}

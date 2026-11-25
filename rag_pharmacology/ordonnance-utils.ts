/** Extrait un court résumé « médicaments » pour préremplir le chat. */
export function extractMedicationsSnippet(analysis: string): string {
  const t = analysis.trim();
  if (!t) return "des médicaments mentionnés sur mon ordonnance";
  const med = /1\.\s*M[éeÉ]DICAMENTS[^\n]*\n([\s\S]*?)(?=\n2\.|\n2\s|INSTRUCTIONS|$)/i.exec(t);
  const chunk = (med?.[1] ?? t).trim().replace(/\s+/g, " ");
  if (chunk.length <= 220) return chunk;
  return `${chunk.slice(0, 217)}…`;
}

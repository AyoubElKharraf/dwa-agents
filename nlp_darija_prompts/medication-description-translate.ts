import { callClaude, CLAUDE_SERVICE_UNAVAILABLE } from "@/lib/claude";
import type { AppLanguage } from "@/lib/translations";

/**
 * Traduit une description / notice d’étiquette médicament vers la langue UI.
 */
export async function translateMedicationDescription(
  text: string,
  targetLanguage: AppLanguage,
): Promise<string> {
  const source = text.trim();
  if (!source) return source;

  try {
    const translated = await callClaude({
      pillar: "health",
      model: "haiku",
      maxTokens: 1200,
      outputLanguage: targetLanguage,
      messages: [
        {
          role: "user",
          content: `Tu es un traducteur médical. Traduis le texte suivant (notice, avertissements, composition sur boîte de médicament).
Conserve exactement : doses (mg, g, ml), numéros de lot, codes pays, pourcentages.
Réponds UNIQUEMENT avec la traduction, sans guillemets ni commentaire.

Texte :
${source}`,
        },
      ],
    });
    return translated.trim() || source;
  } catch (e) {
    if (e instanceof Error && e.message !== CLAUDE_SERVICE_UNAVAILABLE) throw e;
    throw new Error(CLAUDE_SERVICE_UNAVAILABLE);
  }
}

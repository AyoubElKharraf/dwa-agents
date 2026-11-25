import {
  callClaudeWithImage,
  callClaudeWithImages,
  CLAUDE_SERVICE_UNAVAILABLE,
} from "@/lib/claude";
import type { MedicamentExtrait, PriseHoraire } from "@/lib/chronic-care-types";
import { detectInteractions } from "@/lib/drug-interactions";

export {
  detectInteractions,
  hasInteractionMajeure,
  getInteractionAlert,
  DRUG_INTERACTIONS,
  type DrugInteraction,
  type DrugInteractionNiveau,
} from "@/lib/drug-interactions";

/** Interactions dangereuses entre médicaments extraits d’un scan boîtes. */
export function detectInteractionsFromExtractedMeds(meds: MedicamentExtrait[]) {
  const names = meds.map((m) => m.nom?.trim() || "").filter(Boolean);
  return detectInteractions(names);
}

/** Même contrat que OrdonnanceAnalyzer : base64 JPEG compressé. */
const MEDICATION_JSON_SHAPE = `{"nom":null,"dosage":null,"forme":null,"dateExpiration":null,"posologie":null,"description":null,"indication":null,"fabricant":null,"confidence":0,"warning":null}`;

const MEDICATION_PROMPT = `Analyse cette photo de boîte de médicament.
Extrais UNIQUEMENT ce qui est visible. Réponds en JSON strict (sans backticks) :
${MEDICATION_JSON_SHAPE}
Règles : date ISO YYYY-MM-DD (EXP/Exp) ; dosage mg/g/ml ; description = texte complet notice/avertissements/composition visible ; confidence < 40 si flou ; null si invisible.`;

function medicationMultiPrompt(photoCount: number): string {
  return `Tu reçois ${photoCount} photo(s) du MÊME médicament (faces différentes de la même boîte, ou plusieurs angles).
Fusionne TOUTES les informations visibles en UN SEUL médicament. Réponds en JSON strict (sans backticks) :
${MEDICATION_JSON_SHAPE}
Règles : un seul nom commercial + dosage ; priorise le texte le plus lisible ; complète nom/dosage/expiration/posologie/fabricant depuis toutes les images ; date ISO YYYY-MM-DD ; confidence < 40 si flou ; null si invisible.`;
}

const MEDICATION_SCHEDULES: Record<string, PriseHoraire[]> = {
  metformine: [
    { moment: "matin", heure: "08:00", quantite: 1, avecRepas: true, obligatoire: true },
    { moment: "soir", heure: "20:00", quantite: 1, avecRepas: true, obligatoire: true },
  ],
  amlodipine: [
    { moment: "matin", heure: "08:00", quantite: 1, avecRepas: false, obligatoire: true },
  ],
  lisinopril: [
    { moment: "matin", heure: "08:00", quantite: 1, avecRepas: false, obligatoire: true },
  ],
  atorvastatine: [
    { moment: "soir", heure: "21:00", quantite: 1, avecRepas: false, obligatoire: true },
  ],
  aspirin: [
    { moment: "matin", heure: "08:00", quantite: 1, avecRepas: true, obligatoire: true },
  ],
  default: [
    { moment: "matin", heure: "08:00", quantite: 1, avecRepas: false, obligatoire: true },
  ],
};

export function getSuggestedSchedule(nomMedicament: string): PriseHoraire[] {
  const key = nomMedicament
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]/g, "");
  for (const [name, schedule] of Object.entries(MEDICATION_SCHEDULES)) {
    if (name === "default") continue;
    if (key.includes(name)) return schedule.map((h) => ({ ...h }));
  }
  return MEDICATION_SCHEDULES.default.map((h) => ({ ...h }));
}

function parseJsonFromModel(text: string): Record<string, unknown> | null {
  const trimmed = text.trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fence ? fence[1].trim() : trimmed;
  try {
    return JSON.parse(body) as Record<string, unknown>;
  } catch {
    const start = body.indexOf("{");
    const end = body.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(body.slice(start, end + 1)) as Record<string, unknown>;
      } catch {
        return null;
      }
    }
    return null;
  }
}

function strOrNull(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

function numOrZero(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : 0;
}

function extractionFromJson(json: Record<string, unknown>): MedicamentExtrait {
  const nom = strOrNull(json.nom);
  return {
    nom,
    dosage: strOrNull(json.dosage),
    forme: strOrNull(json.forme),
    dateExpiration: strOrNull(json.dateExpiration),
    posologie: strOrNull(json.posologie),
    description: strOrNull(json.description),
    indication: strOrNull(json.indication),
    fabricant: strOrNull(json.fabricant),
    horairesSuggeres: getSuggestedSchedule(nom ?? ""),
    confidence: numOrZero(json.confidence),
    warning: strOrNull(json.warning) ?? undefined,
  };
}

function pickBetter(a: string | null | undefined, b: string | null | undefined): string | null {
  const sa = a?.trim();
  const sb = b?.trim();
  if (sa && sb) return sa.length >= sb.length ? sa : sb;
  return sa || sb || null;
}

/** Fusionne plusieurs extractions (faces d’une même boîte). */
export function mergeMedicationExtractions(parts: MedicamentExtrait[]): MedicamentExtrait {
  const empty = emptyExtraction("Analyse impossible");
  if (parts.length === 0) return empty;

  let nom: string | null = null;
  let dosage: string | null = null;
  let forme: string | null = null;
  let dateExpiration: string | null = null;
  let posologie: string | null = null;
  let description: string | null = null;
  let indication: string | null = null;
  let fabricant: string | null = null;
  let confidence = 0;
  const warnings: string[] = [];

  for (const p of parts) {
    nom = pickBetter(nom, p.nom);
    dosage = pickBetter(dosage, p.dosage);
    forme = pickBetter(forme, p.forme);
    dateExpiration = pickBetter(dateExpiration, p.dateExpiration);
    posologie = pickBetter(posologie, p.posologie);
    description = pickBetter(description, p.description);
    indication = pickBetter(indication, p.indication);
    fabricant = pickBetter(fabricant, p.fabricant);
    confidence = Math.max(confidence, p.confidence);
    if (p.warning) warnings.push(p.warning);
  }

  return {
    nom,
    dosage,
    forme,
    dateExpiration,
    posologie,
    description,
    indication,
    fabricant,
    horairesSuggeres: getSuggestedSchedule(nom ?? ""),
    confidence,
    warning: warnings.length ? warnings.join(" · ") : undefined,
  };
}

function emptyExtraction(warning: string): MedicamentExtrait {
  return {
    nom: null,
    dosage: null,
    forme: null,
    dateExpiration: null,
    posologie: null,
    description: null,
    indication: null,
    fabricant: null,
    horairesSuggeres: getSuggestedSchedule(""),
    confidence: 0,
    warning,
  };
}

async function analyzeWithPrompt(
  base64Jpegs: string[],
  textPrompt: string,
): Promise<MedicamentExtrait> {
  const empty = emptyExtraction("Analyse impossible");
  const cleaned = base64Jpegs.map((s) => s.replace(/\s/g, "")).filter(Boolean);
  if (cleaned.length === 0) {
    return { ...empty, warning: "Image vide" };
  }

  try {
    const raw =
      cleaned.length === 1
        ? await callClaudeWithImage({
            imageBase64: cleaned[0]!,
            imageMediaType: "image/jpeg",
            textPrompt,
            maxTokens: 512,
          })
        : await callClaudeWithImages({
            images: cleaned.map((imageBase64) => ({
              imageBase64,
              imageMediaType: "image/jpeg" as const,
            })),
            textPrompt,
            maxTokens: 768,
          });

    const json = parseJsonFromModel(raw);
    if (!json) {
      return { ...empty, warning: "Réponse IA non lisible" };
    }
    return extractionFromJson(json);
  } catch (e) {
    if (e instanceof Error) throw e;
    throw new Error(CLAUDE_SERVICE_UNAVAILABLE);
  }
}

/** Une ou plusieurs photos du même médicament → une seule extraction. */
export async function analyzeMedicationPhotos(base64Jpegs: string[]): Promise<MedicamentExtrait> {
  const cleaned = base64Jpegs.map((s) => s.replace(/\s/g, "")).filter(Boolean);
  if (cleaned.length === 0) {
    return emptyExtraction("Image vide");
  }
  if (cleaned.length === 1) {
    return analyzeWithPrompt(cleaned, MEDICATION_PROMPT);
  }

  try {
    return await analyzeWithPrompt(cleaned, medicationMultiPrompt(cleaned.length));
  } catch (multiErr) {
    console.warn("[medication-scanner] multi-image API failed, merging per photo", multiErr);
    const parts: MedicamentExtrait[] = [];
    for (const b64 of cleaned) {
      try {
        parts.push(await analyzeWithPrompt([b64], MEDICATION_PROMPT));
      } catch {
        /* ignore single photo failure */
      }
    }
    if (parts.length === 0) {
      if (multiErr instanceof Error) throw multiErr;
      throw new Error(CLAUDE_SERVICE_UNAVAILABLE);
    }
    return mergeMedicationExtractions(parts);
  }
}

/** Analyse une boîte de médicament (JPEG base64 compressé). */
export async function analyzeMedicationPhoto(base64Jpeg: string): Promise<MedicamentExtrait> {
  return analyzeMedicationPhotos([base64Jpeg]);
}

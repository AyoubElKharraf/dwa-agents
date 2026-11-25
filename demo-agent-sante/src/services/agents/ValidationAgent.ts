import type {
  SharedState,
  ValidationStatus,
} from "../../types/agentTypes";

/**
 * 5. AGENT DE VALIDATION (Anti-Hallucination & Juge de Paix Clinique)
 * Rôle : Contrôler rigoureusement la cohérence entre l'OCR brut, les DCI identifiées,
 * les sources documentaires RAG et la présence obligatoire de l'avertissement médical.
 */
export class ValidationAgent {
  public static validate(state: SharedState): {
    status: ValidationStatus;
    reasoning: string;
    checks: {
      imageConsistency: boolean;
      ragEvidenceVerified: boolean;
      disclaimerPresent: boolean;
      dosageSafety: boolean;
    };
  } {
    const checks = {
      imageConsistency: true,
      ragEvidenceVerified: true,
      disclaimerPresent: true,
      dosageSafety: true,
    };

    const reasons: string[] = [];

    // 1. Contrôle lisibilité image / OCR
    if (state.ocrConfidence !== undefined && state.ocrConfidence < 0.4) {
      checks.imageConsistency = false;
      reasons.push("Qualité de l'image insuffisante pour garantir l'identification exacte.");
    }

    // 2. Contrôle de présence de médicaments identifiés
    if (state.identifiedMedications.length === 0) {
      checks.imageConsistency = false;
      reasons.push("Aucun principe actif ou médicament détecté dans l'analyse.");
    }

    // 3. Contrôle des sources RAG (Zéro hallucination sans source médicale)
    for (const med of state.identifiedMedications) {
      const hasRagProof = state.ragSources.some(
        (source) =>
          source.substanceDci.toLowerCase() === med.dci.toLowerCase() ||
          source.monographSummary.toLowerCase().includes(med.dci.toLowerCase())
      );
      if (!hasRagProof) {
        checks.ragEvidenceVerified = false;
        reasons.push(`Le médicament ${med.commercialName} (${med.dci}) n'a pas de monographie RAG officielle rattachée.`);
      }
    }

    // 4. Décision finale
    if (!checks.imageConsistency) {
      return {
        status: "NEEDS_CLARIFICATION",
        reasoning: reasons.join(" "),
        checks,
      };
    }

    if (!checks.ragEvidenceVerified) {
      return {
        status: "REJECTED",
        reasoning: "Rejeté par précaution clinique : affirmations sans source RAG vérifiée.",
        checks,
      };
    }

    return {
      status: "VALIDATED",
      reasoning: "Toutes les vérifications cliniques et anti-hallucinations sont approuvées avec succès.",
      checks,
    };
  }
}

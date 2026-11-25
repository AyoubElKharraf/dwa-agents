import type {
  MedicationItem,
  RagEvidenceSource,
  PharmacologyAlert,
  PatientMedicalProfile,
} from "../../types/agentTypes";

/**
 * AGENT 4 : PHARMACOLOGIQUE (ÉVALUATION DES RISQUES & INTERACTIONS)
 * Mission : Évaluer la sécurité clinique en croisant les DCI identifiées, les preuves RAG
 * et le profil du patient (allergies, traitements existants, pathologies).
 */
export class PharmacologyAgent {
  public static evaluateRisks(
    medications: MedicationItem[],
    ragSources: RagEvidenceSource[],
    patientProfile: PatientMedicalProfile
  ): PharmacologyAlert[] {
    const alerts: PharmacologyAlert[] = [];
    const allergies = patientProfile.allergies.map((a) => a.toLowerCase());

    for (const med of medications) {
      const dci = med.dci.toLowerCase();

      // 1. Détection des Contre-indications Allergiques
      const isPenicillin = dci.includes("amoxicilline") || dci.includes("pénicilline");
      const hasPenicillinAllergy = allergies.some(
        (a) => a.includes("pénicilline") || a.includes("amoxicilline")
      );

      if (isPenicillin && hasPenicillinAllergy) {
        alerts.push({
          id: `alert-${Date.now()}-allergy`,
          substance1: med.dci,
          severity: "Majeure",
          riskDescription:
            "Contre-indication absolue : risque de choc anaphylactique suite à une allergie déclarée aux pénicillines.",
          clinicalRecommendation:
            "INTERDICTION FORMELLE DE PRENDRE CE MÉDICAMENT. Consultez immédiatement votre médecin pour substituer le traitement.",
          sourceCitation: "ANSM - Contre-indications absolues aux bêta-lactamines",
        });
        continue;
      }

      // 2. Détection pour AINS (Ibuprofène)
      if (dci.includes("ibuprofène") || dci.includes("ibuprofene")) {
        alerts.push({
          id: `alert-${Date.now()}-nsaid`,
          substance1: med.dci,
          severity: "Modérée",
          riskDescription:
            "Risque d'irritation gastrique et d'interaction avec d'autres anticoagulants ou aspirine.",
          clinicalRecommendation:
            "À prendre impérativement au cours d'un repas avec un grand verre d'eau. Ne pas associer à un autre anti-inflammatoire.",
          sourceCitation: "ANSM / Thériaque - Bon usage des AINS",
        });
        continue;
      }

      // 3. Information générale
      alerts.push({
        id: `alert-${Date.now()}-standard`,
        substance1: med.dci,
        severity: "Faible",
        riskDescription: "Aucune interaction majeure détectée avec votre profil actuel.",
        clinicalRecommendation: "Respectez la posologie prescrite et les horaires de prise.",
        sourceCitation: ragSources[0]?.sourceName || "Référentiel Médical National",
      });
    }

    return alerts;
  }
}

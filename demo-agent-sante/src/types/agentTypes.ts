/**
 * Types stricts pour l'Architecture Multi-Agents Santé
 * Conforme aux spécifications du Master M2I (Module 7).
 */

export type UrgencyLevel = "low" | "medium" | "high" | "critical";

export type ValidationStatus = "VALIDATED" | "NEEDS_CLARIFICATION" | "REJECTED";

export interface AgentTraceStep {
  agent:
    | "Orchestrateur"
    | "Agent Vision & OCR"
    | "Agent d'Identification"
    | "Agent RAG"
    | "Agent Pharmacologique"
    | "Agent de Validation"
    | "Agent de Génération"
    | "Agent Vocal";
  timestamp: string;
  action: string;
  details?: string;
  status: "success" | "warning" | "error" | "in_progress";
}

export interface MedicationItem {
  id: string;
  commercialName: string;
  dci: string; // Dénomination Commune Internationale
  dosage: string;
  form: string;
  expirationDate?: string;
  detectedInstructions?: string;
  confidenceScore: number;
}

export interface RagEvidenceSource {
  sourceName: string; // Ex: ANSM, Vidal, Monographie Thériaque
  url?: string;
  substanceDci: string;
  monographSummary: string;
  officialWarning?: string;
}

export interface PharmacologyAlert {
  id: string;
  substance1: string;
  substance2?: string;
  severity: "Faible" | "Modérée" | "Majeure";
  riskDescription: string;
  clinicalRecommendation: string;
  sourceCitation: string;
}

export interface MultilingualOutput {
  fr: {
    summary: string;
    instructions: string;
    risks: string;
    disclaimer: string;
  };
  darija: {
    summary: string;
    instructions: string;
    risks: string;
    disclaimer: string;
  };
  en: {
    summary: string;
    instructions: string;
    risks: string;
    disclaimer: string;
  };
}

export interface PatientMedicalProfile {
  bloodType?: string;
  emergencyContact?: string;
  weight?: string;
  height?: string;
  allergies: string[];
  chronicConditions: string[];
  currentTreatments: string[];
}

/**
 * MÉMOIRE PARTAGÉE CENTRALE (SharedState)
 * Accessible, enrichie et auditée tout au long du cycle de vie de la requête.
 */
export interface SharedState {
  requestId: string;
  createdAt: string;
  currentStep: string;
  userLanguage: "FR" | "DARIJA" | "EN";
  patientProfile: PatientMedicalProfile;

  // Données alimentées par les agents spécialisés
  rawImages: string[]; // Base64
  ocrRawText?: string;
  ocrConfidence?: number;

  identifiedMedications: MedicationItem[];
  ragSources: RagEvidenceSource[];
  pharmacologyAlerts: PharmacologyAlert[];

  // Étape de Contrôle & Anti-hallucination
  validation: {
    status: ValidationStatus;
    reasoning: string;
    checks: {
      imageConsistency: boolean;
      ragEvidenceVerified: boolean;
      disclaimerPresent: boolean;
      dosageSafety: boolean;
    };
  };

  // Restitution multimodale
  multilingualOutput?: MultilingualOutput;
  audioOutput?: {
    textToSpeak: string;
    lang: string;
    audioGenerated: boolean;
  };

  // Journal complet de traçabilité (Auditabilité académique)
  executionTrace: AgentTraceStep[];
}

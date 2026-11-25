import type { SharedState } from "../../types/agentTypes";
import { VisionOcrAgent } from "../1_VisionOcrAgent/VisionOcrAgent";
import { IdentificationAgent } from "../2_IdentificationAgent/IdentificationAgent";
import { RagAgent } from "../3_RagAgent/RagAgent";
import { PharmacologyAgent } from "../4_PharmacologyAgent/PharmacologyAgent";
import { ValidationAgent } from "../5_ValidationAgent/ValidationAgent";
import { GenerationAgent } from "../6_GenerationAgent/GenerationAgent";

/**
 * 🧭 AGENT ORCHESTRATEUR (COORDINATEUR CENTRAL)
 * Coordonne les 7 agents autonomes, maintient le SharedState et enregistre l'executionTrace.
 */
export class HealthOrchestrator {
  private state: SharedState;
  private onTraceUpdate?: (state: SharedState) => void;

  constructor(initialState: SharedState, onTraceUpdate?: (state: SharedState) => void) {
    this.state = initialState;
    this.onTraceUpdate = onTraceUpdate;
  }

  public getState(): SharedState {
    return this.state;
  }

  private addTrace(
    agent: SharedState["executionTrace"][0]["agent"],
    action: string,
    details?: string,
    status: SharedState["executionTrace"][0]["status"] = "success"
  ) {
    const timestamp = new Date().toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

    this.state.executionTrace.push({ agent, timestamp, action, details, status });
    if (this.onTraceUpdate) {
      this.onTraceUpdate({ ...this.state });
    }
  }

  public async executePipeline(base64Images: string[]): Promise<SharedState> {
    this.state.rawImages = base64Images;
    this.addTrace(
      "Orchestrateur",
      "Initialisation de la requête",
      `Session ID: ${this.state.requestId} • Images reçues : ${base64Images.length}`
    );

    try {
      // 1. Agent Vision & OCR
      this.addTrace("Agent Vision & OCR", "Analyse d'image & extraction optique", "Prétraitement multi-angles");
      const ocrRes = await VisionOcrAgent.analyzeImage(base64Images[0] || "");
      this.state.ocrRawText = ocrRes.rawText;
      this.state.ocrConfidence = ocrRes.confidenceScore;
      this.addTrace(
        "Agent Vision & OCR",
        "Extraction OCR terminée",
        `Score confiance : ${(ocrRes.confidenceScore * 100).toFixed(0)}%`
      );

      // 2. Agent d'Identification
      this.addTrace("Agent d'Identification", "Normalisation pharmaceutique", "Détection DCI, dosage et forme");
      const meds = await IdentificationAgent.identify(this.state.ocrRawText);
      this.state.identifiedMedications = meds;
      this.addTrace(
        "Agent d'Identification",
        "Médicament normalisé",
        `${meds[0]?.commercialName} • DCI: ${meds[0]?.dci} (${meds[0]?.dosage})`
      );

      // 3. Agent RAG
      this.addTrace("Agent RAG", "Recherche documentaire médicale", "Interrogation monographies officielles ANSM/Vidal");
      const ragSources = await RagAgent.fetchOfficialEvidence(meds);
      this.state.ragSources = ragSources;
      this.addTrace("Agent RAG", "Sources officielles rattachées", `${ragSources.length} monographie(s) vérifiée(s)`);

      // 4. Agent Pharmacologique
      this.addTrace("Agent Pharmacologique", "Évaluation des risques & interactions", "Croisement avec le profil patient");
      const alerts = PharmacologyAgent.evaluateRisks(meds, ragSources, this.state.patientProfile);
      this.state.pharmacologyAlerts = alerts;
      const isCritical = alerts.some((a) => a.severity === "Majeure");
      this.addTrace(
        "Agent Pharmacologique",
        "Analyse de sécurité terminée",
        isCritical ? "⚠️ Contre-indication majeure identifiée !" : "Sécurité validée (Risque nul/faible)",
        isCritical ? "warning" : "success"
      );

      // 5. Agent de Validation
      this.addTrace("Agent de Validation", "Contrôle qualité & anti-hallucination", "Audit des sources et cohérence globale");
      const val = ValidationAgent.validate(meds, ragSources, this.state.ocrConfidence);
      this.state.validation = val;
      this.addTrace(
        "Agent de Validation",
        `Verdict : ${val.status}`,
        val.reasoning,
        val.status === "VALIDATED" ? "success" : "error"
      );

      if (val.status === "REJECTED") {
        this.addTrace("Orchestrateur", "Arrêt d'urgence de sécurité", "Validation rejetée par le garde-fou", "error");
        return this.state;
      }

      // 6. Agent de Génération
      this.addTrace("Agent de Génération", "Rédaction vulgarisée multilingue", "Génération Darija, Français et Anglais");
      const multiOutput = await GenerationAgent.generate(meds, alerts);
      this.state.multilingualOutput = multiOutput;
      this.addTrace("Agent de Génération", "Génération multilingue terminée", "Traductions prêtes");

      // 7. Agent Vocal
      this.addTrace("Agent Vocal", "Préparation TTS en Darija marocaine", "Adaptation phonétique ar-MA");
      const textToSpeak = multiOutput.darija.instructions;
      this.state.audioOutput = {
        textToSpeak,
        lang: "ar-MA",
        audioGenerated: true,
      };
      this.addTrace("Agent Vocal", "Synthèse vocale prête", "Prêt pour l'écoute interactive");

      this.addTrace("Orchestrateur", "Pipeline terminé avec succès", "Restitution complète transmise à l'interface");
    } catch (err: any) {
      this.addTrace("Orchestrateur", "Erreur rencontrée", err?.message || "Erreur interne", "error");
    }

    return this.state;
  }
}

# 🩺 Système Multi-Agents Médical Multimodal (Darija, Français, Anglais)
> **Master M2I — Semestre 3 | Module 7 : Automatisation IA & Systèmes Multi-Agents**  
> *Projet de Fin de Module : Sujet 2 — Agent Médical Multimodal & Pharmacovigilance en Darija*

---

> ⚠️ **Garde-fou Éthique & Clinique Impératif :**  
> Ce système intelligent est un outil d'assistance, de prévention et de vulgarisation médicale. Il **ne se substitue en aucun cas** à l'avis, au diagnostic ou à la prescription d'un médecin ou d'un pharmacien diplômé. L'avertissement médical non-substitutif est rigoureusement vérifié et apposé sur chaque restitution écrite et vocale.

---

## 🎯 1. Vision & Objectifs du Projet

L'objectif de ce projet est de concevoir et déployer un **système intelligent multi-agents collaboratif et multimodal** capable de :
1. **Analyser des photographies de médicaments** (boîtes multi-faces, plaquettes/blisters, ordonnances manuscrites ou imprimées).
2. **Identifier et structurer les principes actifs (DCI)**, les dosages exacts, les formes galéniques et les dates de péremption.
3. **Détecter les interactions médicamenteuses potentielles et les contre-indications** à partir de sources médicales officielles fiables (ANSM, Vidal, monographies Thériaque).
4. **Restituer une assistance médicale accessible et bienveillante** à l'écrit (**Darija marocaine**, **Français**, **Anglais**) et à l'oral via une **synthèse vocale (TTS) naturelle en Darija**.

Le système abandonne tout pipeline séquentiel rigide au profit d'une **architecture multi-agents coordonnée par un Orchestrateur**, reposant sur une **mémoire partagée (`SharedState`)**, des mécanismes stricts de **validation anti-hallucination** et une **traçabilité complète (`executionTrace`)**.

---

## 🏗️ 2. Architecture Multi-Agents & Flux d'Exécution

### Schéma Global de l'Architecture Multi-Agents

```text
                        ┌───────────────────────────────────────────────────┐
                        │        UTILISATEUR (Images / Texte / Voix)        │
                        │       Langues : Darija marocaine / FR / EN        │
                        └─────────────────────────┬─────────────────────────┘
                                                  │
                                                  ▼
┌───────────────────────────────────────────────────────────────────────────────────────────────┐
│                             🧭 AGENT ORCHESTRATEUR (Coordinateur)                              │
│  • Maintient l'état centralisé (SharedState) & le journal d'audit chronologique (Trace)       │
│  • Gère le routage conditionnel, la reprise sur erreur (fallbacks) & la synchronisation       │
└──────┬─────────────┬─────────────┬─────────────┬─────────────┬─────────────┬─────────────┬────┘
       │ (1)         │ (2)         │ (3)         │ (4)         │ (5)         │ (6)         │ (7)
       ▼             ▼             ▼             ▼             ▼             ▼             ▼
  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐
  │ Vision   │  │ Identif. │  │   RAG    │  │ Pharmaco │  │ Validat. │  │ Générat. │  │  Vocal   │
  │  & OCR   │  │   DCI    │  │ Document.│  │ Risques  │  │ Anti-Halu│  │ Multi-Lng│  │TTS Darija│
  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘
       │             │             │             │             │             │             │
       └─────────────┴─────────────┴──────┬──────┴─────────────┴─────────────┴─────────────┘
                                          │
                         Lecture & Enrichissement Atomique de
                                 💾 SharedState
```

---

## 👥 3. Cartographie des 8 Entités Multi-Agents

Le système s'articule autour de **1 Orchestrateur Central** et **7 Agents Spécialisés et Autonomes** :

| # | Entité / Agent | Mission Spécifique | Entrées Clés (`SharedState`) | Sorties Produites (`SharedState`) |
| :-: | :--- | :--- | :--- | :--- |
| **🧭** | **Agent Orchestrateur** | Chef d'orchestre du cycle de vie, routage d'état, gestion des erreurs et traçabilité globale. | Requête initiale, signaux d'état des agents. | État consolidé, boucle d'exécution, `executionTrace`. |
| **👁️** | **1. Agent Vision & OCR** | Prétraitement d'images (multi-faces, éclairage, base64) et extraction du texte brut. | Clichés bruts (JPEG/PNG/Base64). | Texte brut extrait, zones d'intérêt, score de confiance OCR. |
| **🏷️** | **2. Agent d'Identification** | Normalisation pharmaceutique stricte (DCI, dosage, forme galénique, posologie, péremption). | Texte brut OCR, métadonnées visuelles. | Liste d'objets `MedicationItem` typés et normalisés. |
| **📚** | **3. Agent RAG** | Recherche sémantique dans les bases médicales officielles avec citations de sources vérifiables. | DCI normalisées, antécédents patient. | Monographies officielles rattachées (`RagEvidenceSource`). |
| **💊** | **4. Agent Pharmacologique** | Analyse clinique des risques : détection des interactions croisées, doublons et contre-indications. | Médicaments identifiés, preuves RAG, profil patient. | Alertes de pharmacovigilance typées par gravité (`Faible`, `Modérée`, `Majeure`). |
| **⚖️** | **5. Agent de Validation** | Juge de paix clinique et anti-hallucination : vérifie l'ancrage RAG, la cohérence et l'avertissement légal. | Données extraites, sources RAG, alertes. | Verdict formel : `VALIDATED`, `NEEDS_CLARIFICATION`, ou `REJECTED`. |
| **✍️** | **6. Agent de Génération** | Vulgarisation médicale claire, bienveillante et empathique en **Darija**, **Français** et **Anglais**. | Données validées, alertes, langue choisie. | Objet `MultilingualOutput` structuré avec disclaimer obligatoire. |
| **🗣️** | **7. Agent Vocal (TTS)** | Synthèse vocale fluide en **Darija marocaine** adaptée à l'accessibilité des personnes malvoyantes. | Texte vulgarisé en Darija (`ar-MA`). | Flux audio synthétisé, gestion de lecture interactive. |

---

## 💾 4. Mémoire Partagée (`SharedState`) & Traçabilité

Les agents ne s'appellent pas de manière anarchique. Ils communiquent exclusivement à travers un **état partagé centralisé, typé et immuable** défini en TypeScript :

```typescript
export interface SharedState {
  requestId: string;
  createdAt: string;
  currentStep: string;
  userLanguage: "FR" | "DARIJA" | "EN";
  patientProfile: PatientMedicalProfile;

  // Données de perception et structuration
  rawImages: string[];
  ocrRawText?: string;
  ocrConfidence?: number;
  identifiedMedications: MedicationItem[];

  // Ancrage médical et analyse clinique
  ragSources: RagEvidenceSource[];
  pharmacologyAlerts: PharmacologyAlert[];

  // Évaluation de cohérence et anti-hallucination
  validation: {
    status: "VALIDATED" | "NEEDS_CLARIFICATION" | "REJECTED";
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
  audioOutput?: { textToSpeak: string; lang: string; audioGenerated: boolean };

  // Journal d'audit pour soutenance et audit clinique
  executionTrace: AgentTraceStep[];
}
```

### 📜 Traçabilité en Temps Réel (`executionTrace`)
Chaque action d'un agent génère un enregistrement horodaté consultable en direct via le composant `ExecutionTracePanel` :
```text
[18:15:32] [Orchestrateur]        ➔ Initialisation de la requête (Images reçues : 1)
[18:15:33] [Agent Vision & OCR]   ➔ OCR brut extrait (Confiance : 95%)
[18:15:34] [Agent Identification] ➔ Normalisation DCI : Ibuprofène 400mg (Comprimé pelliculé)
[18:15:35] [Agent RAG]            ➔ Consultation Monographie ANSM / Vidal rattachée
[18:15:36] [Agent Pharmacologie]  ➔ Recommandation clinique : prise impérative au milieu du repas
[18:15:37] [Agent de Validation]  ➔ VERDICT : VALIDATED (Cohérence DCI/Image 100%)
[18:15:38] [Agent de Génération]  ➔ Explication rédigée en Darija marocaine authentique
[18:15:39] [Agent Vocal]          ➔ Flux TTS configuré en dialecte marocain (ar-MA)
```

---

## 🛡️ 5. Fiabilité, Sécurité & Anti-Hallucination

1. **Principe de Précaution :** Si la confiance OCR est trop faible ($< 50\%$) ou si l'image est floue, le système refuse formellement d'inventer un médicament et émet un statut `NEEDS_CLARIFICATION` invitant à reprendre une photo.
2. **Anti-Hallucination Stricte :** L'Agent de Validation bloque le passage à la génération si une affirmation médicale n'est pas sourcée mot à mot dans les extraits RAG.
3. **Détection Critique d'Allergies :** Le système croise les DCI avec le dossier du patient. *Exemple :* Si un patient allergique à la pénicilline scanne de l'Augmentin (Amoxicilline), une alerte rouge de gravité `Majeure / Contre-indication Absolue` est immédiatement déclenchée pour prévenir tout choc anaphylactique.
4. **Garantie de Confidentialité :** Le profil médical reste stocké en local (`localStorage`). Seules les données médicales anonymisées sont transmises lors de l'inférence.

---

## 📂 6. Structure Modulaire du Répertoire du Projet

```text
dwa-agents/
├── README.md                                  # Documentation officielle de référence
├── demo-agent-sante/                          # APPLICATION MULTI-AGENTS INTÉGRÉE (Vite + React + TS)
│   ├── src/
│   │   ├── App.tsx                            # Interface Hub Santé (Accueil, Dwak IA, Profil, Diagnostic)
│   │   ├── types/
│   │   │   └── agentTypes.ts                  # Schéma SharedState, Trace et interfaces strictes
│   │   │
│   │   ├── agents/                            # ARCHITECTURE MODULAIRE DÉDIÉE (1 DOSSIER PAR AGENT)
│   │   │   ├── 0_Orchestrator/
│   │   │   │   └── HealthOrchestrator.ts      # 🧭 Orchestrateur central & superviseur du cycle de vie
│   │   │   ├── 1_VisionOcrAgent/
│   │   │   │   └── VisionOcrAgent.ts          # 👁️ Agent 1 : Vision & OCR optique multi-angles
│   │   │   ├── 2_IdentificationAgent/
│   │   │   │   └── IdentificationAgent.ts     # 🏷️ Agent 2 : Normalisation pharmaceutique (DCI / Dosages)
│   │   │   ├── 3_RagAgent/
│   │   │   │   └── RagAgent.ts                # 📚 Agent 3 : Recherche documentaire RAG officielle (ANSM/Vidal)
│   │   │   ├── 4_PharmacologyAgent/
│   │   │   │   └── PharmacologyAgent.ts       # 💊 Agent 4 : Pharmacologie clinique, interactions & allergies
│   │   │   ├── 5_ValidationAgent/
│   │   │   │   └── ValidationAgent.ts         # ⚖️ Agent 5 : Juge de paix anti-hallucination & conformité
│   │   │   ├── 6_GenerationAgent/
│   │   │   │   └── GenerationAgent.ts         # ✍️ Agent 6 : Vulgarisation multilingue (Darija, FR, EN)
│   │   │   └── 7_VoiceAgent/
│   │   │       └── VoiceAgent.ts              # 🗣️ Agent 7 : Synthèse vocale TTS en Darija marocaine
│   │   │
│   │   ├── services/
│   │   │   └── agentService.ts                # Client API Coarena (Modèle Gemini 3.8 Flash) & TTS
│   │   │
│   │   ├── components/
│   │   │   ├── ScanModal.tsx                  # Modal d'acquisition multi-photos (0/5)
│   │   │   ├── ArabicVoiceModal.tsx           # Modal vocale interactive avec onde pulsée en Darija
│   │   │   └── ExecutionTracePanel.tsx        # Tiroir d'affichage en direct de la traçabilité
│   │   └── index.css                          # Thème Glassmorphism Tailwind & typographies
│   │
│   ├── test-agents.mjs                        # Banc d'essai automatisé de test de bout en bout
│   └── package.json
│
├── vision_ocr/                                # Algorithmes de compression d'images et OCR
├── rag_pharmacology/                          # Base de connaissances d'interactions médicamenteuses
├── nlp_darija_prompts/                        # Ingénierie des prompts spécialisés Darija marocaine
└── voice_tts/                                 # Utilitaires de synthèse vocale et d'élocution
```

---

## 🚀 7. Installation & Démonstration

### Prérequis
* Node.js (version 18+)
* Clé API Coarena Model (ou compatible OpenAI/Anthropic) : configurée par défaut avec `gemini-3-8-flash`.

### Lancement de l'Application Interactive
```bash
# Se positionner dans le dossier de l'application
cd "agent_multimodal_sante/demo-agent-sante"

# Installer les dépendances
npm install

# Lancer le serveur de développement Vite
npm run dev
```
👉 Ouvrez votre navigateur sur **`http://localhost:5173`**.

### Lancement du Banc de Test Automatisé (Validation de tous les agents)
Pour exécuter le scénario clinique de test en ligne de commande :
```bash
node test-agents.mjs
```

---

## 👥 8. Auteurs & Cadre Académique
* **Programme :** Master en Ingénierie Informatique (M2I) — Semestre 3
* **Module :** Module 7 — Automatisation IA & Systèmes Multi-Agents
* **Projet :** Sujet 2 — Système Multi-Agents Médical Multimodal (Darija, FR, EN)

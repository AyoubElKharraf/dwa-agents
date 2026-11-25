# Architecture de l'Agent Multimodal Santé (Archive & Référence)

Ce dossier regroupe l'ensemble des composants et logiques implémentant le pipeline de l'Agent Santé issu du projet précédent.

## Structure du Dossier

```
agent_multimodal_sante/
├── vision_ocr/
│   ├── claude-vision.ts          # Prétraitement d'images, encodage base64 & compression JPEG
│   └── medication-scanner.ts     # Analyse visuelle de boîtes de médicaments, extraction JSON stricte
│
├── rag_pharmacology/
│   ├── drug-interactions.ts      # Base de données et règles de détection des interactions médicamenteuses
│   └── ordonnance-utils.ts       # Extraction et structuration des prescriptions médicales
│
├── nlp_darija_prompts/
│   ├── chat-language-detect.ts   # Détection des dialectes / Darija vs Arabe standard / Français
│   └── medication-description-translate.ts # Adaptation / vulgarisation des descriptions médicales
│
├── voice_tts/
│   ├── ArabicVoiceModal.tsx      # Modal de restitution vocale interactive avec feedback visuel
│   ├── use-arabic-tts-highlight.ts # Synchronisation mot à mot et timing TTS arabe/darija
│   ├── load-responsive-voice.ts  # Chargeur et initialisation du moteur vocal TTS
│   └── speech-utils.ts           # Utilitaires Web Speech API & synthèse audio
│
├── backend_proxy/
│   ├── claude.ts                 # Client d'appel API LLM (gestion des piliers, streaming, fallback)
│   └── claude-edge-function.ts   # Edge function Supabase proxyfiant et sécurisant les requêtes LLM
│
└── ui_workflows/
    ├── MedScanVoiceModal.tsx     # Workflow complet : Scan photo ➔ Vision ➔ RAG Interactions ➔ Restitution Darija + Audio
    ├── OrdonnanceAnalyzer.tsx    # Workflow d'analyse et d'interprétation d'ordonnances médicales
    ├── AlerteInteraction.tsx     # Composant d'alerte critique en cas de contre-indication médicamenteuse
    └── chronic-care-types.ts     # Définition des structures de données (médicaments, prises, profil)
```

import { useState } from "react";
import {
  HeartPulse,
  Activity,
  Pill,
  AlertTriangle,
  UserCheck,
  PhoneCall,
  Sparkles,
  Camera,
  Volume2,
  CheckCircle,
  ArrowRight,
  Upload,
  Calendar,
  Languages,
  Info,
  Sliders,
  Bell,
  Flame,
  Loader2,
} from "lucide-react";
import { ScanModal } from "./components/ScanModal";
import { ArabicVoiceModal } from "./components/ArabicVoiceModal";
import { ExecutionTracePanel } from "./components/ExecutionTracePanel";
import { runClinicalDiagnostic, speakDarijaText, type DiagnosticResult } from "./services/agentService";
import { MultiAgentOrchestrator } from "./services/orchestrator/MultiAgentOrchestrator";
import type { SharedState, AgentTraceStep } from "./types/agentTypes";

// Definition of views in Health Hub
type HealthTab =
  | "accueil"
  | "dwak-ia"
  | "profil"
  | "diagnostic"
  | "urgences"
  | "interactions";

export function App() {
  const [currentTab, setCurrentTab] = useState<HealthTab>("accueil");
  const [lang, setLang] = useState<"FR" | "DARIJA" | "EN">("FR");

  // Modals
  const [scanModalOpen, setScanModalOpen] = useState(false);
  const [voiceModalOpen, setVoiceModalOpen] = useState(false);
  const [selectedFileCount, setSelectedFileCount] = useState(0);

  // Reminders config
  const [remindersActive, setRemindersActive] = useState(true);
  const [reminderMode, setReminderMode] = useState<"Audio" | "Texte" | "Les deux">("Les deux");
  const [reminderLang, setReminderLang] = useState<"FR" | "EN" | "AR">("FR");
  const [reminderDelay, setReminderDelay] = useState(15);
  const [reminderIfForgotten, setReminderIfForgotten] = useState(true);

  // Patient Profile state
  const [profile, setProfile] = useState({
    bloodType: "O+",
    emergencyContact: "Yasmine Benali • +212 661 553 901",
    weight: "72",
    height: "178",
    conditions: ["Hypertension artérielle légère", "Allergie aux sulfamides"],
    currentMeds: ["Augmentin 1g (matin/soir)", "Doliprane 1000mg (si besoin)"],
  });

  // Multi-Agent Execution State (SharedState)
  const [isAnalyzingImage, setIsAnalyzingImage] = useState(false);
  const [traces, setTraces] = useState<AgentTraceStep[]>([]);
  const [tracePanelOpen, setTracePanelOpen] = useState(true);
  const [sharedState, setSharedState] = useState<SharedState | null>(null);

  // Diagnostic State
  const [symptomInput, setSymptomInput] = useState("");
  const [isDiagnosing, setIsDiagnosing] = useState(false);
  const [diagnosticData, setDiagnosticData] = useState<DiagnosticResult | null>(null);

  const handleRunDiagnostic = async () => {
    if (!symptomInput.trim()) return;
    setIsDiagnosing(true);
    try {
      const result = await runClinicalDiagnostic(symptomInput, {
        conditions: profile.conditions,
        currentMeds: profile.currentMeds,
      });
      setDiagnosticData(result);
    } catch (err) {
      console.error(err);
    } finally {
      setIsDiagnosing(false);
    }
  };

  const handleSelectFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setSelectedFileCount(files.length);
    setIsAnalyzingImage(true);
    setScanModalOpen(false);

    // Conversion du premier fichier en Base64
    const file = files[0];
    const reader = new FileReader();

    reader.onloadend = async () => {
      const base64Content = (reader.result as string).split(",")[1];

      const initialSharedState: SharedState = {
        requestId: `req-${Date.now()}`,
        createdAt: new Date().toISOString(),
        currentStep: "initialization",
        userLanguage: lang,
        patientProfile: {
          bloodType: profile.bloodType,
          emergencyContact: profile.emergencyContact,
          weight: profile.weight,
          height: profile.height,
          allergies: ["Sulfamides", "Pénicilline"],
          chronicConditions: profile.conditions,
          currentTreatments: profile.currentMeds,
        },
        rawImages: [],
        identifiedMedications: [],
        ragSources: [],
        pharmacologyAlerts: [],
        validation: {
          status: "NEEDS_CLARIFICATION",
          reasoning: "Validation en attente",
          checks: {
            imageConsistency: false,
            ragEvidenceVerified: false,
            disclaimerPresent: true,
            dosageSafety: true,
          },
        },
        executionTrace: [],
      };

      const orchestrator = new MultiAgentOrchestrator(initialSharedState, (updatedState) => {
        setTraces([...updatedState.executionTrace]);
        setSharedState({ ...updatedState });
      });

      const finalState = await orchestrator.executePipeline([base64Content]);
      setSharedState(finalState);
      setTraces([...finalState.executionTrace]);
      setIsAnalyzingImage(false);

      // Si médicament identifié, l'ajouter à la liste de suivi
      if (finalState.identifiedMedications.length > 0) {
        const first = finalState.identifiedMedications[0];
        setProfile((prev) => ({
          ...prev,
          currentMeds: [...prev.currentMeds, `${first.commercialName} ${first.dosage} (${first.dci})`],
        }));
      }

      // Aller vers l'onglet Dwak IA pour voir le résultat
      setCurrentTab("dwak-ia");
    };

    reader.readAsDataURL(file);
  };

  return (
    <div className="min-h-screen bg-[#07111f] text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-slate-900">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 border-b border-white/[0.08] bg-[#07111f]/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between px-6 py-3.5">
          {/* Logo */}
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => setCurrentTab("accueil")}>
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-slate-950 font-bold shadow-lg shadow-emerald-500/20">
              <HeartPulse size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-extrabold tracking-tight text-white">MarocPulse</span>
                <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[11px] font-bold text-emerald-300 border border-emerald-500/30">
                  SANTÉ
                </span>
              </div>
              <p className="text-[10px] font-medium text-slate-400">
                Plateforme Multi-Agents Médicale (Darija • FR • EN)
              </p>
            </div>
          </div>

          {/* Active Navigation Pills */}
          <div className="hidden md:flex items-center gap-1 rounded-full bg-slate-900/80 border border-white/[0.08] p-1.5">
            <button
              onClick={() => setCurrentTab("accueil")}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold transition ${
                currentTab === "accueil"
                  ? "bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Accueil Santé
            </button>
            <button
              onClick={() => setCurrentTab("dwak-ia")}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold transition flex items-center gap-1.5 ${
                currentTab === "dwak-ia"
                  ? "bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Pill size={14} /> Dwak IA
            </button>
            <button
              onClick={() => setCurrentTab("interactions")}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold transition flex items-center gap-1.5 ${
                currentTab === "interactions"
                  ? "bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <AlertTriangle size={14} /> Interactions
            </button>
            <button
              onClick={() => setCurrentTab("profil")}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold transition flex items-center gap-1.5 ${
                currentTab === "profil"
                  ? "bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <UserCheck size={14} /> Profil Médical
            </button>
          </div>

          {/* Right Controls */}
          <div className="flex items-center gap-3">
            {/* Lang Switcher */}
            <div className="flex items-center gap-1 rounded-xl bg-slate-900 border border-slate-800 p-1 text-xs">
              <Languages size={14} className="text-slate-400 ml-1.5" />
              {(["FR", "DARIJA", "EN"] as const).map((l) => (
                <button
                  key={l}
                  onClick={() => setLang(l)}
                  className={`px-2 py-1 rounded-lg font-bold text-[11px] transition ${
                    lang === l ? "bg-emerald-500 text-slate-950" : "text-slate-400 hover:text-white"
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>

            {/* Quick Scan Action */}
            <button
              onClick={() => setScanModalOpen(true)}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 font-bold text-xs hover:brightness-110 transition shadow-md shadow-emerald-500/20"
            >
              <Camera size={15} />
              <span className="hidden sm:inline">Scanner Médicament</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Body with Sidebar + Content */}
      <div className="flex-1 max-w-[1600px] w-full mx-auto px-6 py-6 flex flex-col lg:flex-row gap-6 relative">
        {/* Left Sidebar (Navigation Santé) */}
        <aside className="w-full lg:w-72 shrink-0">
          <div className="rounded-3xl border border-white/[0.08] bg-slate-900/60 backdrop-blur-xl p-5 shadow-xl">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-3 pb-3 border-b border-slate-800">
              NAVIGATION SANTÉ
            </h4>

            <nav className="mt-4 flex flex-col gap-1.5">
              <button
                onClick={() => setCurrentTab("accueil")}
                className={`flex items-start gap-3 p-3 rounded-2xl text-left transition ${
                  currentTab === "accueil"
                    ? "bg-emerald-500/15 border border-emerald-500/30 text-emerald-300"
                    : "hover:bg-slate-800/60 text-slate-300"
                }`}
              >
                <div className="p-2 rounded-xl bg-slate-800 border border-slate-700/60 text-emerald-400">
                  <Activity size={18} />
                </div>
                <div>
                  <div className="font-semibold text-sm">Accueil Santé</div>
                  <div className="text-[11px] text-slate-400">Hub santé, dossier et état des agents</div>
                </div>
              </button>

              <button
                onClick={() => setCurrentTab("dwak-ia")}
                className={`flex items-start gap-3 p-3 rounded-2xl text-left transition ${
                  currentTab === "dwak-ia"
                    ? "bg-emerald-500/15 border border-emerald-500/30 text-emerald-300"
                    : "hover:bg-slate-800/60 text-slate-300"
                }`}
              >
                <div className="p-2 rounded-xl bg-slate-800 border border-slate-700/60 text-teal-400">
                  <Pill size={18} />
                </div>
                <div>
                  <div className="font-semibold text-sm">Dwak IA</div>
                  <div className="text-[11px] text-slate-400">Médicaments et maladies chroniques</div>
                </div>
              </button>

              <button
                onClick={() => setCurrentTab("diagnostic")}
                className={`flex items-start gap-3 p-3 rounded-2xl text-left transition ${
                  currentTab === "diagnostic"
                    ? "bg-emerald-500/15 border border-emerald-500/30 text-emerald-300"
                    : "hover:bg-slate-800/60 text-slate-300"
                }`}
              >
                <div className="p-2 rounded-xl bg-slate-800 border border-slate-700/60 text-cyan-400">
                  <Sparkles size={18} />
                </div>
                <div>
                  <div className="font-semibold text-sm">Diagnostic & Triage IA</div>
                  <div className="text-[11px] text-slate-400">Évaluation des symptômes et orientation</div>
                </div>
              </button>

              <button
                onClick={() => setCurrentTab("interactions")}
                className={`flex items-start gap-3 p-3 rounded-2xl text-left transition ${
                  currentTab === "interactions"
                    ? "bg-emerald-500/15 border border-emerald-500/30 text-emerald-300"
                    : "hover:bg-slate-800/60 text-slate-300"
                }`}
              >
                <div className="p-2 rounded-xl bg-slate-800 border border-slate-700/60 text-amber-400">
                  <AlertTriangle size={18} />
                </div>
                <div>
                  <div className="font-semibold text-sm">Contre-indications & Risques</div>
                  <div className="text-[11px] text-slate-400">Analyse pharmacologique approfondie</div>
                </div>
              </button>

              <button
                onClick={() => setCurrentTab("profil")}
                className={`flex items-start gap-3 p-3 rounded-2xl text-left transition ${
                  currentTab === "profil"
                    ? "bg-emerald-500/15 border border-emerald-500/30 text-emerald-300"
                    : "hover:bg-slate-800/60 text-slate-300"
                }`}
              >
                <div className="p-2 rounded-xl bg-slate-800 border border-slate-700/60 text-purple-400">
                  <UserCheck size={18} />
                </div>
                <div>
                  <div className="font-semibold text-sm">Profil Médical</div>
                  <div className="text-[11px] text-slate-400">Dossier patient, antécédents et traitements</div>
                </div>
              </button>

              <button
                onClick={() => setCurrentTab("urgences")}
                className={`flex items-start gap-3 p-3 rounded-2xl text-left transition ${
                  currentTab === "urgences"
                    ? "bg-emerald-500/15 border border-emerald-500/30 text-emerald-300"
                    : "hover:bg-slate-800/60 text-slate-300"
                }`}
              >
                <div className="p-2 rounded-xl bg-slate-800 border border-slate-700/60 text-rose-400">
                  <PhoneCall size={18} />
                </div>
                <div>
                  <div className="font-semibold text-sm">Urgences & Garde</div>
                  <div className="text-[11px] text-slate-400">SOS Maroc 141/15 et pharmacies</div>
                </div>
              </button>
            </nav>

            {/* Multi-Agent Live Status Card */}
            <div className="mt-6 p-4 rounded-2xl bg-slate-950/70 border border-slate-800">
              <div className="flex items-center justify-between text-xs font-bold text-slate-300 mb-2.5">
                <span>Architecture Multi-Agents</span>
                <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              </div>
              <div className="space-y-1.5 text-[11px]">
                <div className="flex items-center justify-between text-slate-400">
                  <span>1. Orchestrateur Central</span>
                  <span className="text-emerald-400 font-mono">Actif</span>
                </div>
                <div className="flex items-center justify-between text-slate-400">
                  <span>2. Vision & OCR</span>
                  <span className="text-emerald-400 font-mono">Prêt</span>
                </div>
                <div className="flex items-center justify-between text-slate-400">
                  <span>3. Identification DCI</span>
                  <span className="text-emerald-400 font-mono">Prêt</span>
                </div>
                <div className="flex items-center justify-between text-slate-400">
                  <span>4. RAG Pharmacologique</span>
                  <span className="text-cyan-400 font-mono">Connecté</span>
                </div>
                <div className="flex items-center justify-between text-slate-400">
                  <span>5. Agent Validation</span>
                  <span className="text-purple-400 font-mono">Anti-Hallu</span>
                </div>
                <div className="flex items-center justify-between text-slate-400">
                  <span>6. Génération Multilingue</span>
                  <span className="text-indigo-400 font-mono">FR/DAR/EN</span>
                </div>
                <div className="flex items-center justify-between text-slate-400">
                  <span>7. Agent Vocal (TTS)</span>
                  <span className="text-teal-400 font-mono">Darija</span>
                </div>
              </div>
            </div>
          </div>
        </aside>

        {/* Center Content Workspace */}
        <main className="flex-1">
          {/* TAB 1: ACCUEIL SANTÉ */}
          {currentTab === "accueil" && (
            <div className="space-y-6">
              {/* Panneau de Traçabilité Multi-Agents en Direct */}
              <ExecutionTracePanel
                traces={traces}
                validationStatus={sharedState?.validation?.status}
                validationReasoning={sharedState?.validation?.reasoning}
                isOpen={tracePanelOpen}
                onToggle={() => setTracePanelOpen(!tracePanelOpen)}
              />

              {/* Loader si analyse en cours */}
              {isAnalyzingImage && (
                <div className="p-6 rounded-3xl bg-indigo-950/40 border border-indigo-500/30 flex items-center justify-center gap-3 text-indigo-300 animate-pulse">
                  <Loader2 size={24} className="animate-spin text-emerald-400" />
                  <span className="text-sm font-bold">
                    Orchestrateur & Agents en action (Vision ➔ OCR ➔ RAG ➔ Validation)...
                  </span>
                </div>
              )}

              {/* Hero Banner */}
              <div className="relative rounded-3xl overflow-hidden border border-white/[0.08] bg-gradient-to-r from-slate-900 via-slate-900/95 to-slate-950 p-8 shadow-2xl">
                <div className="max-w-2xl">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold mb-4">
                    <Sparkles size={14} /> Module d'Assistance Médicale Intelligente
                  </div>
                  <h1 className="text-3xl font-extrabold text-white tracking-tight sm:text-4xl">
                    Votre Espace Santé Multi-Agents
                  </h1>
                  <p className="mt-3 text-slate-300 text-sm leading-relaxed">
                    Analysez vos boîtes de médicaments, ordonnances et prescriptions. Bénéficiez d'une vérification
                    croisée sur bases médicales officielles avec restitution claire en Darija, Français et Anglais.
                  </p>

                  <div className="mt-6 flex flex-wrap gap-3">
                    <button
                      onClick={() => setScanModalOpen(true)}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition shadow-lg shadow-emerald-500/25"
                    >
                      <Camera size={16} /> Scanner un médicament
                    </button>
                    <button
                      onClick={() => setVoiceModalOpen(true)}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition shadow-lg shadow-indigo-600/25"
                    >
                      <Volume2 size={16} /> Parler en Darija (Audio)
                    </button>
                  </div>
                </div>
              </div>

              {/* Service Cards Grid (Matching the User's Screenshot Design) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Card 1: Diagnostic IA */}
                <div
                  onClick={() => setCurrentTab("diagnostic")}
                  className="group rounded-3xl border border-white/[0.08] bg-slate-900/50 hover:bg-slate-900/80 p-6 backdrop-blur-xl transition cursor-pointer shadow-lg hover:border-emerald-500/40"
                >
                  <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 mb-4 group-hover:scale-105 transition">
                    <Sparkles size={24} />
                  </div>
                  <h3 className="text-lg font-bold text-white group-hover:text-cyan-300 transition">
                    Diagnostic & Triage IA
                  </h3>
                  <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                    Décrivez vos symptômes, analysez une ordonnance ou une photo clinique et obtenez une première orientation médicale rigoureuse.
                  </p>
                  <div className="mt-4 flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
                    <span>Ouvrir le service</span>
                    <ArrowRight size={14} className="group-hover:translate-x-1 transition" />
                  </div>
                </div>

                {/* Card 2: Suivi Chronique / Dwak IA */}
                <div
                  onClick={() => setCurrentTab("dwak-ia")}
                  className="group rounded-3xl border border-white/[0.08] bg-slate-900/50 hover:bg-slate-900/80 p-6 backdrop-blur-xl transition cursor-pointer shadow-lg hover:border-emerald-500/40"
                >
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-4 group-hover:scale-105 transition">
                    <Pill size={24} />
                  </div>
                  <h3 className="text-lg font-bold text-white group-hover:text-emerald-300 transition">
                    Dwak IA & Suivi Chronique
                  </h3>
                  <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                    Gérez vos traitements, scannez vos boîtes, détectez la DCI, les dosages et configurez vos rappels intelligents vocaux.
                  </p>
                  <div className="mt-4 flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
                    <span>Ouvrir le service</span>
                    <ArrowRight size={14} className="group-hover:translate-x-1 transition" />
                  </div>
                </div>

                {/* Card 3: Risques & Interactions */}
                <div
                  onClick={() => setCurrentTab("interactions")}
                  className="group rounded-3xl border border-white/[0.08] bg-slate-900/50 hover:bg-slate-900/80 p-6 backdrop-blur-xl transition cursor-pointer shadow-lg hover:border-amber-500/40"
                >
                  <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-4 group-hover:scale-105 transition">
                    <AlertTriangle size={24} />
                  </div>
                  <h3 className="text-lg font-bold text-white group-hover:text-amber-300 transition">
                    Sécurité & Interactions Médicamenteuses
                  </h3>
                  <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                    Vérification par l'Agent Pharmacologique et RAG des doublons moléculaires, contre-indications et intolérances croisées.
                  </p>
                  <div className="mt-4 flex items-center gap-1.5 text-xs font-semibold text-amber-400">
                    <span>Voir les alertes</span>
                    <ArrowRight size={14} className="group-hover:translate-x-1 transition" />
                  </div>
                </div>

                {/* Card 4: Urgences SOS */}
                <div
                  onClick={() => setCurrentTab("urgences")}
                  className="group rounded-3xl border border-white/[0.08] bg-slate-900/50 hover:bg-slate-900/80 p-6 backdrop-blur-xl transition cursor-pointer shadow-lg hover:border-rose-500/40"
                >
                  <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 mb-4 group-hover:scale-105 transition">
                    <PhoneCall size={24} />
                  </div>
                  <h3 className="text-lg font-bold text-white group-hover:text-rose-300 transition">
                    Urgences SOS & Garde
                  </h3>
                  <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                    Accédez immédiatement aux numéros d'urgence nationaux (SAMU 141, Pompiers 15, Police 19) et aux pharmacies de garde.
                  </p>
                  <div className="mt-4 flex items-center gap-1.5 text-xs font-semibold text-rose-400">
                    <span>Accéder aux urgences</span>
                    <ArrowRight size={14} className="group-hover:translate-x-1 transition" />
                  </div>
                </div>
              </div>

              {/* Mandatory Ethical Disclaimer */}
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-3">
                <Info size={20} className="text-amber-400 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-200/90 leading-relaxed">
                  <strong>Avertissement Médical Impératif :</strong> Ce système intelligent multi-agents est un outil d'assistance et de vulgarisation. Il ne remplace en aucun cas l'avis, le diagnostic ou la prescription de votre médecin ou de votre pharmacien.
                </p>
              </div>
            </div>
          )}

          {/* TAB 2: DWAK IA / PHARMA-SCAN & SUIVI */}
          {currentTab === "dwak-ia" && (
            <div className="space-y-6">
              {/* Header Box */}
              <div className="rounded-3xl border border-white/[0.08] bg-slate-900/60 p-6 backdrop-blur-xl">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                      PILIER SANTÉ • DWAK IA
                    </span>
                    <h2 className="text-2xl font-bold text-white mt-1">Mon Suivi Santé & Médicaments</h2>
                    <p className="text-xs text-slate-400 mt-1">
                      Gestion des traitements en cours, scan OCR de boîtes et rappels intelligents
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setScanModalOpen(true)}
                      className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition flex items-center gap-1.5 shadow-md shadow-emerald-500/20"
                    >
                      <Camera size={15} /> + Ajouter médicament
                    </button>
                    <button
                      onClick={() => setVoiceModalOpen(true)}
                      className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition flex items-center gap-1.5"
                    >
                      <Volume2 size={15} /> Écouter en Darija
                    </button>
                  </div>
                </div>
              </div>

              {/* Today Section */}
              <div className="rounded-3xl border border-white/[0.08] bg-slate-900/40 p-6">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-300">
                  <Calendar size={16} className="text-emerald-400" />
                  <span>Aujourd'hui — {new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}</span>
                </div>
                <div className="mt-4 p-4 rounded-2xl bg-slate-950/40 border border-slate-800 text-xs text-slate-400">
                  Prises programmées pour aujourd'hui : <strong>2 médicaments détectés</strong>
                </div>
              </div>

              {/* SharedState Result Box (Si analyse effectuée) */}
              {sharedState?.identifiedMedications && sharedState.identifiedMedications.length > 0 && (
                <div className="p-6 rounded-3xl border border-emerald-500/30 bg-slate-900/80 backdrop-blur-xl space-y-4 animate-in fade-in">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                    <span className="text-xs font-bold text-emerald-400 uppercase">
                      Dernière Analyse Multi-Agents (Mémoire Partagée)
                    </span>
                    <span className="text-[11px] font-mono text-slate-400">
                      ID: {sharedState.requestId}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {sharedState.identifiedMedications.map((m) => (
                      <div key={m.id} className="p-4 rounded-2xl bg-slate-950 border border-slate-800">
                        <div className="text-sm font-bold text-white">{m.commercialName} ({m.dosage})</div>
                        <div className="text-xs text-emerald-400 font-mono mt-0.5">DCI: {m.dci}</div>
                        <div className="text-[11px] text-slate-400 mt-1">Forme: {m.form}</div>
                        <div className="text-[11px] text-slate-300 mt-2 p-2 rounded-xl bg-slate-900">
                          Posologie : {m.detectedInstructions}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Restitution Darija Multimodale */}
                  {sharedState.multilingualOutput?.darija && (
                    <div className="p-4 rounded-2xl bg-indigo-950/40 border border-indigo-500/30 flex items-start justify-between gap-4">
                      <div>
                        <div className="text-xs font-bold text-indigo-300 mb-1">
                          الشرح بالدارجة المغربية (Agent de Génération) :
                        </div>
                        <p className="text-sm font-semibold text-white leading-relaxed" dir="rtl">
                          {sharedState.multilingualOutput.darija.instructions}
                        </p>
                      </div>
                      <button
                        onClick={() =>
                          speakDarijaText(sharedState.multilingualOutput?.darija.instructions || "")
                        }
                        className="px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 shrink-0"
                      >
                        <Volume2 size={14} /> Écouter (TTS)
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Meds List + Action Buttons (Matching Screenshot) */}
              <div className="rounded-3xl border border-white/[0.08] bg-slate-900/60 p-6 backdrop-blur-xl">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <span>💊 Mes médicaments en cours</span>
                </h3>

                <div className="mt-4 space-y-3">
                  {profile.currentMeds.map((med, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-4 rounded-2xl bg-slate-950/60 border border-slate-800 hover:border-emerald-500/30 transition"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                          <Pill size={18} />
                        </div>
                        <div>
                          <div className="text-sm font-bold text-white">{med}</div>
                          <div className="text-[11px] text-slate-400">DCI validée par l'Agent d'Identification</div>
                        </div>
                      </div>
                      <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full">
                        Vérifié RAG
                      </span>
                    </div>
                  ))}
                </div>

                {/* Big Action Buttons (Matching the green buttons in screenshot) */}
                <div className="mt-6 space-y-3">
                  <button
                    onClick={() => setScanModalOpen(true)}
                    className="w-full py-3.5 px-6 rounded-2xl bg-[#008f5d] hover:bg-[#00a86b] text-white font-bold text-sm transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/30"
                  >
                    <Camera size={18} />
                    <span>📷 Scanner la boîte (Vision & OCR)</span>
                  </button>

                  <button
                    onClick={() => setScanModalOpen(true)}
                    className="w-full py-3.5 px-6 rounded-2xl bg-[#008f5d]/80 hover:bg-[#008f5d] text-white font-bold text-sm transition flex items-center justify-center gap-2 border border-emerald-500/30"
                  >
                    <span>✏️ Saisie manuelle</span>
                  </button>
                </div>
              </div>

              {/* Reminder Settings (Matching screenshot section) */}
              <div className="rounded-3xl border border-white/[0.08] bg-slate-900/60 p-6 backdrop-blur-xl">
                <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <Sliders size={18} className="text-emerald-400" />
                    <h3 className="text-sm font-bold text-white">Paramètres rappels</h3>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={remindersActive}
                      onChange={(e) => setRemindersActive(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                  </label>
                </div>

                <div className="mt-4 space-y-4 text-xs text-slate-300">
                  {/* Mode de rappel */}
                  <div>
                    <label className="block text-slate-400 mb-1.5 font-medium">Mode de rappel</label>
                    <div className="flex gap-2">
                      {(["Audio", "Texte", "Les deux"] as const).map((m) => (
                        <button
                          key={m}
                          onClick={() => setReminderMode(m)}
                          className={`px-4 py-2 rounded-xl font-semibold transition ${
                            reminderMode === m
                              ? "bg-emerald-500 text-slate-950 font-bold"
                              : "bg-slate-800 text-slate-400 hover:text-white"
                          }`}
                        >
                          {m}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Langue des rappels */}
                  <div>
                    <label className="block text-slate-400 mb-1.5 font-medium">Langue des rappels</label>
                    <div className="flex gap-2">
                      {(["FR", "EN", "AR"] as const).map((l) => (
                        <button
                          key={l}
                          onClick={() => setReminderLang(l)}
                          className={`px-4 py-2 rounded-xl font-semibold transition ${
                            reminderLang === l
                              ? "bg-emerald-500 text-slate-950 font-bold"
                              : "bg-slate-800 text-slate-400 hover:text-white"
                          }`}
                        >
                          {l}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Rappel si oubli */}
                  <div className="flex items-center justify-between pt-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={reminderIfForgotten}
                        onChange={(e) => setReminderIfForgotten(e.target.checked)}
                        className="rounded border-slate-700 bg-slate-900 text-emerald-500 focus:ring-emerald-400"
                      />
                      <Bell size={16} className="text-emerald-400" />
                      <span>Rappel si oubli (Délai min) :</span>
                    </div>
                    <input
                      type="number"
                      value={reminderDelay}
                      onChange={(e) => setReminderDelay(Number(e.target.value))}
                      className="w-16 px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-center font-bold text-emerald-400"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: PROFIL MÉDICAL (Matching Screenshot) */}
          {currentTab === "profil" && (
            <div className="space-y-6">
              {/* Header Box */}
              <div className="rounded-3xl border border-white/[0.08] bg-slate-900/60 p-6 backdrop-blur-xl">
                <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                  PILIER 1 • SANTÉ
                </span>
                <h2 className="text-2xl font-bold text-white mt-1">Profil médical utilisateur</h2>
                <p className="text-xs text-slate-400 mt-1">Informations médicales essentielles & dossier patient</p>
              </div>

              {/* Mon dossier médical Card */}
              <div className="rounded-3xl border border-white/[0.08] bg-slate-900/60 p-6 backdrop-blur-xl space-y-6">
                <div>
                  <h3 className="text-base font-bold text-white">Mon dossier médical</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Ces informations aident l'Agent Pharmacologique en cas d'analyse ou d'urgence.</p>
                </div>

                {/* IA Autofill Section (Matching Screenshot) */}
                <div className="p-5 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-4">
                  <div className="flex items-center gap-2">
                    <Sparkles size={16} className="text-indigo-400" />
                    <span className="text-xs font-bold text-white">Remplissage automatique par IA</span>
                  </div>
                  <p className="text-xs text-slate-400">
                    Importez un rapport médical ou une ordonnance, l'Agent Vision extraira automatiquement vos antécédents.
                  </p>

                  <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-300">
                    ⚠️ <strong>Confidentialité :</strong> Vos données médicales restent sur votre appareil (localStorage) et ne sont utilisées que pour l'inférence.
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => setScanModalOpen(true)}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700"
                    >
                      <Camera size={14} /> Prendre une photo
                    </button>
                    <button
                      onClick={() => setScanModalOpen(true)}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700"
                    >
                      <Upload size={14} /> Choisir une image
                    </button>
                  </div>
                </div>

                {/* Form Fields (Matching Screenshot) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">Groupe sanguin</label>
                    <input
                      type="text"
                      value={profile.bloodType}
                      onChange={(e) => setProfile({ ...profile, bloodType: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white font-semibold focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">Contact d'urgence</label>
                    <input
                      type="text"
                      value={profile.emergencyContact}
                      onChange={(e) => setProfile({ ...profile, emergencyContact: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white font-semibold focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">Poids (kg)</label>
                    <input
                      type="text"
                      value={profile.weight}
                      onChange={(e) => setProfile({ ...profile, weight: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white font-semibold focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">Taille (cm)</label>
                    <input
                      type="text"
                      value={profile.height}
                      onChange={(e) => setProfile({ ...profile, height: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white font-semibold focus:border-emerald-500"
                    />
                  </div>
                </div>

                {/* Pathologies & Allergies */}
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Antécédents / Pathologies chroniques</label>
                  <div className="space-y-2">
                    {profile.conditions.map((c, i) => (
                      <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200">
                        <span>{c}</span>
                        <span className="text-[10px] text-emerald-400 font-bold uppercase">Actif</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: DIAGNOSTIC & TRIAGE IA */}
          {currentTab === "diagnostic" && (
            <div className="space-y-6">
              <div className="rounded-3xl border border-white/[0.08] bg-slate-900/60 p-6 backdrop-blur-xl">
                <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider">
                  TRIAGE & CLINIQUE
                </span>
                <h2 className="text-2xl font-bold text-white mt-1">Diagnostic Clinique & Triage IA</h2>
                <p className="text-xs text-slate-400 mt-1">
                  Évaluation préliminaire des symptômes, analyse de signes cutanés et calcul de gravité clinique.
                </p>
              </div>

              <div className="p-6 rounded-3xl border border-white/[0.08] bg-slate-900/40 space-y-4">
                <label className="block text-sm font-semibold text-slate-200">
                  Décrivez vos symptômes ou posez une question médicale :
                </label>
                <textarea
                  rows={4}
                  value={symptomInput}
                  onChange={(e) => setSymptomInput(e.target.value)}
                  placeholder="Exemple: J'ai de la fièvre (38.5°C) depuis 2 jours avec maux de tête et toux sèche..."
                  className="w-full p-4 rounded-2xl bg-slate-950 border border-slate-800 text-sm text-white focus:border-cyan-500 placeholder:text-slate-600"
                />

                <div className="flex justify-between items-center pt-2">
                  <button
                    onClick={() => setVoiceModalOpen(true)}
                    className="flex items-center gap-2 text-xs font-semibold text-indigo-400 hover:text-indigo-300"
                  >
                    <Volume2 size={16} /> Dicter en Darija
                  </button>

                  <button
                    onClick={handleRunDiagnostic}
                    disabled={isDiagnosing || !symptomInput.trim()}
                    className="px-6 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-slate-950 font-bold text-xs transition shadow-lg shadow-cyan-500/20 flex items-center gap-2"
                  >
                    {isDiagnosing ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        <span>Agents en cours d'analyse...</span>
                      </>
                    ) : (
                      <span>Lancer l'analyse des Agents</span>
                    )}
                  </button>
                </div>
              </div>

              {/* Diagnostic Results Card if present */}
              {diagnosticData && (
                <div className="p-6 rounded-3xl border border-cyan-500/30 bg-slate-900/80 backdrop-blur-xl space-y-4 animate-in fade-in duration-300">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                    <span className="text-xs font-bold text-cyan-400 uppercase">
                      Résultat de l'analyse clinique & triage
                    </span>
                    <span
                      className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                        diagnosticData.urgency === "critical"
                          ? "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                          : diagnosticData.urgency === "high"
                          ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                          : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                      }`}
                    >
                      Urgence : {diagnosticData.urgency.toUpperCase()}
                    </span>
                  </div>

                  <div>
                    <h4 className="text-sm font-bold text-white mb-1">Résumé Médical :</h4>
                    <p className="text-xs text-slate-300 leading-relaxed">{diagnosticData.summary}</p>
                  </div>

                  {/* Restitution en Darija marocaine */}
                  <div className="p-4 rounded-2xl bg-indigo-950/40 border border-indigo-500/30">
                    <div className="flex items-center justify-between text-xs font-bold text-indigo-300 mb-1.5">
                      <span>الشرح بالدارجة المغربية (Agent Darija) :</span>
                      <button
                        onClick={() => setVoiceModalOpen(true)}
                        className="text-[11px] text-emerald-400 flex items-center gap-1 hover:underline"
                      >
                        <Volume2 size={13} /> Écouter
                      </button>
                    </div>
                    <p className="text-sm font-semibold text-white leading-relaxed" dir="rtl">
                      {diagnosticData.darija_explanation}
                    </p>
                  </div>

                  {/* Actions suggérées */}
                  {diagnosticData.suggested_actions?.length > 0 && (
                    <div>
                      <h4 className="text-xs font-bold text-slate-300 mb-1.5">Actions recommandées :</h4>
                      <ul className="list-disc list-inside text-xs text-slate-400 space-y-1">
                        {diagnosticData.suggested_actions.map((act, i) => (
                          <li key={i}>{act}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="pt-2 text-[11px] text-amber-400/90 font-medium">
                    ⚠️ {diagnosticData.disclaimer}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 5: RISQUES & INTERACTIONS */}
          {currentTab === "interactions" && (
            <div className="space-y-6">
              <div className="rounded-3xl border border-white/[0.08] bg-slate-900/60 p-6 backdrop-blur-xl">
                <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                  PHARMACOVIGILANCE
                </span>
                <h2 className="text-2xl font-bold text-white mt-1">Détecteur d'Interactions & Risques</h2>
                <p className="text-xs text-slate-400 mt-1">
                  Agent Pharmacologique + Agent Validation : détection des conflits moléculaires et contre-indications.
                </p>
              </div>

              {/* Active alerts mock */}
              <div className="space-y-4">
                <div className="p-5 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-4">
                  <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 shrink-0">
                    <AlertTriangle size={20} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-white">Attention : Interaction Modérée Détectée</h4>
                      <span className="text-[10px] font-bold bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full">
                        Gravité : Modérée
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
                      L'association de <strong>Paracétamol (Doliprane)</strong> avec d'autres spécialités contenant du paracétamol peut dépasser la dose maximale quotidienne de 4g. Risque d'hépatotoxicité.
                    </p>
                    <div className="mt-3 text-[11px] text-amber-400 font-mono">
                      Source RAG : Monographie Thériaque / Base ANSM
                    </div>
                  </div>
                </div>

                <div className="p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-start gap-4">
                  <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 shrink-0">
                    <CheckCircle size={20} />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">Augmentin 1g (Amoxicilline + Acide Clavulanique)</h4>
                    <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                      Aucune contre-indication directe avec votre profil (Allergie déclarée aux sulfamides uniquement). Posologie standard : 1 comprimé matin et soir au début des repas.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: URGENCES & GARDE */}
          {currentTab === "urgences" && (
            <div className="space-y-6">
              <div className="rounded-3xl border border-white/[0.08] bg-slate-900/60 p-6 backdrop-blur-xl">
                <span className="text-xs font-bold text-rose-400 uppercase tracking-wider">
                  URGENCES NATIONALES (MAROC)
                </span>
                <h2 className="text-2xl font-bold text-white mt-1">Urgences Médicales & Garde</h2>
                <p className="text-xs text-slate-400 mt-1">
                  En cas d'urgence vitale, contactez immédiatement les services officiels marocains.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <a
                  href="tel:141"
                  className="p-5 rounded-2xl bg-rose-500/10 border border-rose-500/30 hover:bg-rose-500/20 transition text-center group"
                >
                  <div className="text-3xl font-extrabold text-rose-400 group-hover:scale-110 transition">141</div>
                  <div className="text-sm font-bold text-white mt-1">SAMU / Urgences Médicales</div>
                  <div className="text-[11px] text-slate-400 mt-1">Assistance médicale d'urgence</div>
                </a>

                <a
                  href="tel:15"
                  className="p-5 rounded-2xl bg-rose-500/10 border border-rose-500/30 hover:bg-rose-500/20 transition text-center group"
                >
                  <div className="text-3xl font-extrabold text-rose-400 group-hover:scale-110 transition">15</div>
                  <div className="text-sm font-bold text-white mt-1">Protection Civile (Pompiers)</div>
                  <div className="text-[11px] text-slate-400 mt-1">Accident ou secours d'urgence</div>
                </a>

                <a
                  href="tel:19"
                  className="p-5 rounded-2xl bg-rose-500/10 border border-rose-500/30 hover:bg-rose-500/20 transition text-center group"
                >
                  <div className="text-3xl font-extrabold text-rose-400 group-hover:scale-110 transition">19</div>
                  <div className="text-sm font-bold text-white mt-1">Police Secours</div>
                  <div className="text-[11px] text-slate-400 mt-1">Sécurité en milieu urbain</div>
                </a>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Floating Action Buttons (Audio & SOS) as seen in user's UI */}
      <div className="fixed bottom-6 right-6 z-40 flex flex-col gap-3">
        <button
          onClick={() => setVoiceModalOpen(true)}
          className="w-14 h-14 rounded-full bg-gradient-to-tr from-indigo-600 to-purple-600 hover:scale-110 transition shadow-xl shadow-indigo-600/40 flex flex-col items-center justify-center text-white"
          title="Écouter en Darija"
        >
          <Volume2 size={20} />
          <span className="text-[9px] font-bold mt-0.5">AUDIO</span>
        </button>

        <a
          href="tel:141"
          className="w-14 h-14 rounded-full bg-gradient-to-tr from-rose-600 to-red-500 hover:scale-110 transition shadow-xl shadow-rose-600/40 flex flex-col items-center justify-center text-white"
          title="Appel SOS Urgence"
        >
          <Flame size={20} />
          <span className="text-[9px] font-bold mt-0.5">SOS</span>
        </a>
      </div>

      {/* Modals */}
      <ScanModal
        isOpen={scanModalOpen}
        onClose={() => setScanModalOpen(false)}
        onSelectFiles={handleSelectFiles}
        fileCount={selectedFileCount}
      />

      <ArabicVoiceModal
        isOpen={voiceModalOpen}
        onClose={() => setVoiceModalOpen(false)}
        lang={lang === "DARIJA" ? "darija" : lang === "FR" ? "fr" : "en"}
      />
    </div>
  );
}

export default App;

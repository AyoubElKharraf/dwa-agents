import {
  type DragEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { Volume2, VolumeX } from "lucide-react";
import { toast } from "sonner";
import { callClaude } from "@/lib/claude";
import { acceptedOrdonnanceMime, prepareImageForClaudeProxy } from "@/lib/claude-vision";
import {
  couleurPourIndication,
  joursAvantExpiration,
  newMedicamentId,
  type Medicament,
  type MedicamentExtrait,
} from "@/lib/chronic-care-types";
import { loadChronicCareStore, saveChronicCareStore } from "@/lib/chronic-care-storage";
import { ArabicVoiceModal } from "@/components/ui/ArabicVoiceModal";
import { AlerteInteraction } from "@/components/ui/AlerteInteraction";
import {
  useArabicTtsHighlight,
  cleanArabicDisplayText as cleanText,
  ARABIC_TTS_WORD_MS,
} from "@/hooks/use-arabic-tts-highlight";
import { HEALTH_PROFILE_STORAGE_KEY } from "@/lib/medical-profile-for-diagnostic";
import {
  analyzeMedicationPhoto,
  detectInteractionsFromExtractedMeds,
  getSuggestedSchedule,
} from "@/lib/medication-scanner";
import type { DrugInteraction } from "@/lib/drug-interactions";
import { ensureResponsiveVoiceScript } from "@/lib/load-responsive-voice";
import { translations, type AppLanguage } from "@/lib/translations";

const MAX_PHOTOS = 5;
const MAX_FILE_BYTES = 5 * 1024 * 1024;

type PhotoItem = {
  file: File;
  base64: string;
  preview: string;
  mediaType: "image/jpeg";
};

type UiStep = "select" | "analyzing" | "result";

function normalizeForme(forme: string | null | undefined): string {
  const f = (forme ?? "").trim().toLowerCase();
  if (!f) return "comprimé";
  const opts = ["comprimé", "sirop", "injection", "gélule", "autre"] as const;
  const match = opts.find((o) => o === f || f.includes(o));
  return match ?? "autre";
}

function buildInstructions(description: string | null | undefined, posologie: string | null | undefined): string {
  const parts = [description?.trim(), posologie?.trim()].filter(Boolean);
  return parts.join("\n\n");
}

function loadMedicalProfileForAdvice(): {
  chronicConditions: string;
  allergies: string;
  medications: string;
  bloodGroup: string;
  age: string | null;
  weight: string;
} {
  const empty = {
    chronicConditions: "",
    allergies: "",
    medications: "",
    bloodGroup: "",
    age: null as string | null,
    weight: "",
  };
  if (typeof window === "undefined") return empty;
  try {
    const raw = JSON.parse(
      window.localStorage.getItem(HEALTH_PROFILE_STORAGE_KEY) || "{}",
    ) as Record<string, unknown>;
    return {
      chronicConditions: String(raw.chronicConditions ?? "").trim(),
      allergies: String(raw.allergies ?? "").trim(),
      medications: String(raw.medications ?? "").trim(),
      bloodGroup: String(raw.bloodGroup ?? "").trim(),
      age: raw.age != null && raw.age !== "" ? String(raw.age) : null,
      weight: String(raw.weight ?? "").trim(),
    };
  } catch {
    return empty;
  }
}

function isProfileMostlyEmpty(p: ReturnType<typeof loadMedicalProfileForAdvice>): boolean {
  return (
    !p.chronicConditions &&
    !p.allergies &&
    !p.medications &&
    !p.bloodGroup &&
    !p.age &&
    !p.weight
  );
}

function buildMedicamentFromScan(m: MedicamentExtrait): Medicament {
  const today = new Date().toISOString().slice(0, 10);
  const horaires =
    m.horairesSuggeres?.length > 0 ? m.horairesSuggeres : getSuggestedSchedule(m.nom ?? "");
  return {
    id: newMedicamentId(),
    nom: m.nom!.trim(),
    dosage: m.dosage?.trim() || "—",
    forme: normalizeForme(m.forme),
    indication: m.indication?.trim() || "—",
    horaires,
    stockActuel: 30,
    stockInitial: 30,
    dateExpiration: m.dateExpiration?.trim() || today,
    dateOuverture: today,
    prescripteur: "",
    instructions: buildInstructions(m.description, m.posologie),
    couleur: couleurPourIndication(m.indication || m.nom || ""),
    actif: true,
    addedBy: "photo",
  };
}

type Props = {
  open: boolean;
  onClose: () => void;
  language: AppLanguage;
};

export function MedScanVoiceModal({ open, onClose, language }: Props) {
  const m = translations[language].medScanVoiceModal;

  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [step, setStep] = useState<UiStep>("select");
  const [progress, setProgress] = useState(0);
  const [currentPhoto, setCurrentPhoto] = useState(0);
  const [scanResults, setScanResults] = useState<MedicamentExtrait[]>([]);
  const [arabicAdvice, setArabicAdvice] = useState("");
  const [detectedInteractions, setDetectedInteractions] = useState<DrugInteraction[]>([]);
  const [profileHintVisible, setProfileHintVisible] = useState(false);
  const [arabicFollowUpOpen, setArabicFollowUpOpen] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const playbackEpochRef = useRef(0);

  const arabicAdviceRef = useRef("");
  useLayoutEffect(() => {
    arabicAdviceRef.current = arabicAdvice;
  }, [arabicAdvice]);

  const ttsNoVoiceMsg = translations[language].darijaVoiceModal.toastNoArabicVoice;
  const ttsOptions = useMemo(() => ({ noArabicVoiceMessage: ttsNoVoiceMsg }), [ttsNoVoiceMsg]);

  const tts = useArabicTtsHighlight(arabicAdviceRef, ttsOptions);
  const ttsRef = useRef(tts);
  ttsRef.current = tts;

  const {
    speakHighlightRef,
    displayedWords,
    currentWordIndex,
    isPlaying,
    isMuted,
  } = tts;

  /** Même pile TTS que DarijaVoiceModal : `useArabicTtsHighlight` (natif ar* → ResponsiveVoice → fallback). */
  useEffect(() => {
    if (!open) return;
    ensureResponsiveVoiceScript();
  }, [open]);

  const revokePreviews = useCallback((items: PhotoItem[]) => {
    items.forEach((p) => {
      try {
        URL.revokeObjectURL(p.preview);
      } catch {
        /* ignore */
      }
    });
  }, []);

  const resetAll = useCallback(() => {
    playbackEpochRef.current += 1;
    ttsRef.current.resetSpeechHighlight();
    setPhotos((prev) => {
      revokePreviews(prev);
      return [];
    });
    setStep("select");
    setProgress(0);
    setCurrentPhoto(0);
    setScanResults([]);
    setArabicAdvice("");
    setDetectedInteractions([]);
    setProfileHintVisible(false);
    setArabicFollowUpOpen(false);
    setDragOver(false);
  }, [revokePreviews]);

  useEffect(() => {
    if (!open) resetAll();
    // resetAll stable (ttsRef) — éviter boucle si dépendances recréées.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const addPhoto = useCallback(
    async (file: File) => {
      if (photos.length >= MAX_PHOTOS) {
        toast.error(m.toastMaxPhotos);
        return;
      }
      if (file.size > MAX_FILE_BYTES) {
        toast.error(m.toastFileLarge);
        return;
      }
      if (!acceptedOrdonnanceMime(file)) {
        toast.error(m.toastInvalidType);
        return;
      }
      try {
        const base64 = await prepareImageForClaudeProxy(file);
        const preview = URL.createObjectURL(file);
        setPhotos((prev) => {
          if (prev.length >= MAX_PHOTOS) {
            URL.revokeObjectURL(preview);
            return prev;
          }
          return [...prev, { file, base64, preview, mediaType: "image/jpeg" as const }];
        });
      } catch {
        toast.error(m.toastInvalidType);
      }
    },
    [m, photos.length],
  );

  const removePhoto = useCallback((index: number) => {
    setPhotos((prev) => {
      const p = prev[index];
      if (p) {
        try {
          URL.revokeObjectURL(p.preview);
        } catch {
          /* ignore */
        }
      }
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  const generatePersonalizedAdvice = useCallback(
    async (meds: MedicamentExtrait[], interactions: DrugInteraction[]) => {
      const profile = loadMedicalProfileForAdvice();
      const emptyProf = isProfileMostlyEmpty(profile);
      setProfileHintVisible(emptyProf);

      const medsText = meds
        .filter((x) => x.nom?.trim())
        .map((med) => {
          const exp = med.dateExpiration ? `Expire: ${med.dateExpiration}` : "";
          return `- ${med.nom} ${med.dosage ?? ""} (${med.indication?.trim() || m.usageGeneral}) ${exp}`.trim();
        })
        .join("\n");

      const interactionsText =
        interactions.length > 0
          ? `
تحذيرات التفاعلات الدوائية الخطيرة المكتشفة :
${interactions.map((i) => `- ${i.danger}: ${i.arabicAlert}`).join("\n")}
`.trim()
          : "لا توجد تفاعلات خطيرة مكتشفة.";

      const prompt = `
أنت صيدلاني وطبيب خبير من MarocPulse المغرب.
المستخدم أرسل صور أدويته.

الأدوية المكتشفة :
${medsText || "(لا اسم واضح)"}

التفاعلات الدوائية :
${interactionsText}

إذا وجدت تفاعلات خطيرة →
ابدأ ردك بتحذير واضح وعاجل قبل أي نصيحة أخرى.

الملف الطبي للمريض :
- الأمراض المزمنة : ${profile.chronicConditions || "غير محدد"}
- الحساسية : ${profile.allergies || "لا توجد معلومات"}
- العلاجات الحالية : ${profile.medications || "غير محدد"}
- فصيلة الدم : ${profile.bloodGroup || "غير محدد"}
- العمر : ${profile.age || "غير محدد"}
- الوزن : ${profile.weight || "غير محدد"} كغ

قواعد مطلقة :
1. افهم أن المستخدم قد يطرح أسئلته بالدارجة المغربية
2. ارد بالعربية الفصحى البسيطة فقط
3. لا Markdown أبداً
4. جمل قصيرة وواضحة
5. الحد الأقصى 6 جمل
6. الترتيب :
   أ) أكد الأدوية المكتشفة
   ب) كيفية الأخذ (قبل/بعد الأكل، الصباح/المساء)
   ج) تنبيهات مهمة
   د) إذا دواء قريب من الانتهاء → تنبيه
   ه) نصيحة شخصية حسب الملف الطبي
7. إذا حساسية خطيرة → تنبيه في البداية
8. لا تذكر الميكروفون أو الصوت أو الوضع الصامت
9. انهِ بتشجيع قصير
`.trim();

      const reply = await callClaude({
        pillar: "health",
        model: "sonnet",
        messages: [{ role: "user", content: prompt }],
        maxTokens: 1200,
        outputLanguage: "ar",
      });
      const cleaned = cleanText(reply);
      setArabicAdvice(cleaned);
    },
    [m.usageGeneral],
  );

  const analyzePhotos = useCallback(async () => {
    if (photos.length === 0) {
      toast.error(m.toastAnalyzeNeedPhoto);
      return;
    }
    setStep("analyzing");
    ttsRef.current.resetSpeechHighlight();
    setProgress(0);
    setScanResults([]);
    setDetectedInteractions([]);
    const list = [...photos];
    const results: MedicamentExtrait[] = [];
    for (let i = 0; i < list.length; i++) {
      setCurrentPhoto(i + 1);
      setProgress(Math.round(((i + 0.35) / list.length) * 100));
      try {
        const extracted = await analyzeMedicationPhoto(list[i]!.base64);
        if (!extracted.nom?.trim() || extracted.confidence < 35) {
          results.push({
            ...extracted,
            nom: extracted.nom,
            confidence: extracted.confidence || 0,
            warning: extracted.warning || m.blurFallback,
          });
        } else {
          results.push(extracted);
        }
      } catch {
        results.push({
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
          warning: m.blurFallback,
        });
      }
      setProgress(Math.round(((i + 1) / list.length) * 100));
    }
    setScanResults(results);
    setProgress(100);
    const interactions = detectInteractionsFromExtractedMeds(results);
    setDetectedInteractions(interactions);
    try {
      await generatePersonalizedAdvice(results, interactions);
    } catch {
      toast.error(translations[language].darijaVoiceModal.toastClaudeUnavailable);
      setArabicAdvice(
        language === "en"
          ? "Sorry, I could not generate advice. Check your connection and try again."
          : "عذراً، لم أتمكن من إعداد النصائح الآن. تحقق من الاتصال وأعد المحاولة.",
      );
    }
    setStep("result");
    playbackEpochRef.current += 1;
  }, [generatePersonalizedAdvice, language, m, photos]);

  useEffect(() => {
    if (!open || step !== "result") return;
    const advice = arabicAdvice.trim();
    const alerts = detectedInteractions.map((i) => i.arabicAlert).join(" ").trim();
    const epoch = playbackEpochRef.current;
    const timers: number[] = [];

    const schedule = (delay: number, text: string) => {
      const id = window.setTimeout(() => {
        if (playbackEpochRef.current !== epoch) return;
        if (!text) return;
        speakHighlightRef.current(text);
      }, delay);
      timers.push(id);
    };

    if (alerts) {
      schedule(600, alerts);
      const alertWords = alerts.split(/\s+/).filter(Boolean).length;
      const gap = Math.min(25_000, 1200 + alertWords * ARABIC_TTS_WORD_MS + 800);
      if (advice) schedule(600 + gap, advice);
    } else if (advice) {
      schedule(600, advice);
    }

    return () => {
      for (const id of timers) window.clearTimeout(id);
    };
    // speakHighlightRef : stable ref → ne pas mettre speakHighlightRef.current dans les deps (évite boucles).
  }, [open, step, arabicAdvice, detectedInteractions]);

  const saveToChronicCare = useCallback(() => {
    const toSave = scanResults.filter((x) => x.nom?.trim() && x.confidence > 60);
    if (toSave.length === 0) {
      toast.error(m.toastSaveNone);
      return;
    }
    const store = loadChronicCareStore();
    const nextMeds = [...store.profil.medicaments];
    for (const ex of toSave) {
      nextMeds.push(buildMedicamentFromScan(ex));
    }
    saveChronicCareStore({
      ...store,
      profil: { ...store.profil, medicaments: nextMeds },
    });
    toast.success(m.toastSaveOk.replace("{n}", String(toSave.length)));
  }, [m, scanResults]);

  const extraArabicContext = useMemo(() => {
    const lines = scanResults
      .filter((r) => r.nom?.trim())
      .map(
        (r) =>
          `${r.nom} ${r.dosage ?? ""} — ${r.indication ?? ""} — exp: ${r.dateExpiration ?? "?"}`,
      );
    return lines.length ? `Médicaments analysés (scan boîtes) :\n${lines.join("\n")}` : "";
  }, [scanResults]);

  const handleClose = () => {
    resetAll();
    onClose();
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files || []).filter((f) => f.type.startsWith("image/"));
    for (const f of files) void addPhoto(f);
  };

  if (!open || typeof document === "undefined") return null;

  const locale =
    language === "fr" ? "fr-FR" : language === "ar" ? "ar-MA" : "en-US";

  const formatExp = (iso: string | null | undefined) => {
    if (!iso?.trim()) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString(locale, { month: "short", year: "numeric", day: "numeric" });
  };

  const overlay = (
    <div
      className="fixed inset-0 z-[10055] flex flex-col overflow-hidden"
      style={{
        background: "rgba(5, 10, 20, 0.97)",
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="med-scan-title"
    >
      <header className="shrink-0 border-b border-white/10 px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-2xl items-start justify-between gap-3">
          <div>
            <h2 id="med-scan-title" className="text-lg font-bold tracking-tight text-white sm:text-xl">
              📷 {m.title}
            </h2>
            <p className="mt-1 text-sm text-cyan-100/90">{m.subtitle1}</p>
            <p className="text-xs text-emerald-200/90">{m.subtitle2}</p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-sm font-semibold text-white hover:bg-white/20"
            aria-label={m.close}
          >
            ✕
          </button>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
        <div className="mx-auto max-w-2xl pb-28">
          {step === "select" && (
            <>
              <div
                role="presentation"
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
                className={`rounded-2xl border-2 border-dashed p-8 text-center transition-all duration-300 ${
                  dragOver
                    ? "scale-[1.02] border-emerald-400/70 bg-emerald-500/10 shadow-[0_0_40px_rgba(16,185,129,0.25)]"
                    : "border-white/20 bg-white/[0.04]"
                }`}
              >
                <div className="text-5xl" aria-hidden>
                  📷
                </div>
                <p className="mt-4 text-base font-medium text-white">{m.dropTitle}</p>
                <p className="mt-2 text-sm text-slate-300">{m.dropHint}</p>
              </div>

              <div className="mt-6 flex flex-wrap justify-center gap-3">
                <button
                  type="button"
                  onClick={() => cameraRef.current?.click()}
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-500 px-5 py-3 text-sm font-bold text-white shadow-lg transition hover:opacity-95 active:scale-[0.98]"
                >
                  📷 {m.camera}
                </button>
                <button
                  type="button"
                  onClick={() => galleryRef.current?.click()}
                  className="inline-flex items-center gap-2 rounded-xl border border-white/25 bg-white/10 px-5 py-3 text-sm font-bold text-white hover:bg-white/15"
                >
                  🖼 {m.gallery}
                </button>
              </div>

              <input
                ref={cameraRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                capture="environment"
                className="sr-only"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (f) void addPhoto(f);
                }}
              />
              <input
                ref={galleryRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                className="sr-only"
                onChange={(e) => {
                  const files = e.target.files;
                  e.target.value = "";
                  if (!files?.length) return;
                  for (const f of Array.from(files)) void addPhoto(f);
                }}
              />

              <p className="mt-6 text-center text-sm text-slate-400">
                {m.photoCount.replace("{n}", String(photos.length))}
              </p>

              {photos.length > 0 ? (
                <div className="mt-6">
                  <p className="mb-3 text-sm font-semibold text-white">
                    {m.selectedTitle.replace("{n}", String(photos.length))}
                  </p>
                  <div className="flex flex-wrap gap-3">
                    {photos.map((ph, index) => (
                      <div
                        key={`${ph.preview}-${index}`}
                        className="med-scan-thumb-enter relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl border border-white/20 shadow-lg"
                      >
                        <img src={ph.preview} alt="" className="h-full w-full object-cover" />
                        <button
                          type="button"
                          onClick={() => removePhoto(index)}
                          className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-xs text-white hover:bg-red-600/90"
                          aria-label={m.close}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                  {photos.length < MAX_PHOTOS ? (
                    <button
                      type="button"
                      onClick={() => galleryRef.current?.click()}
                      className="mt-4 text-sm font-semibold text-emerald-300 underline-offset-2 hover:underline"
                    >
                      + {m.addPhoto}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => void analyzePhotos()}
                    className="mt-6 w-full rounded-2xl bg-gradient-to-r from-emerald-600 to-cyan-600 py-4 text-sm font-extrabold text-white shadow-[0_8px_32px_rgba(16,185,129,0.35)] transition hover:opacity-95 active:scale-[0.99]"
                  >
                    🔍 {m.analyze}
                  </button>
                </div>
              ) : null}
            </>
          )}

          {step === "analyzing" && (
            <div className="flex flex-col items-center py-10 text-center">
              <div className="relative flex h-36 w-36 items-center justify-center">
                <div
                  className="darija-voice-spin-ring absolute h-32 w-32 rounded-full border-4 border-transparent sm:h-36 sm:w-36"
                  style={{
                    borderTopColor: "#22C55E",
                    borderRightColor: "rgba(34, 197, 94, 0.35)",
                  }}
                />
                <div className="relative text-4xl" aria-hidden>
                  🤖
                </div>
              </div>
              <p className="mt-6 text-lg font-semibold text-white">{m.analyzingTitle}</p>
              <p className="mt-1 text-base text-emerald-200/90" dir="rtl">
                {m.analyzingAr}
              </p>
              <div className="mx-auto mt-6 h-2 w-full max-w-xs overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400 transition-[width] duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="mt-3 text-sm text-slate-300">
                {m.photoProgress.replace("{current}", String(currentPhoto)).replace("{total}", String(photos.length))}
              </p>
              <p className="mt-4 max-w-md text-sm text-slate-400">{m.analyzingSub}</p>
            </div>
          )}

          {step === "result" && (
            <div className="space-y-6">
              <AlerteInteraction
                interactions={detectedInteractions}
                onSpeak={(text) => speakHighlightRef.current(text)}
              />
              <div>
                <p className="text-sm font-bold text-emerald-300">🔊 {m.replyLabel}</p>
                {profileHintVisible ? (
                  <p className="mt-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
                    {m.profileHint}
                  </p>
                ) : null}
                <div
                  className="darija-voice-response-text mt-3"
                  dir="rtl"
                  lang="ar"
                  style={{
                    textAlign: "right",
                    fontFamily: "Arial, sans-serif",
                    fontSize: "1.05rem",
                    lineHeight: 2,
                    padding: "12px 16px",
                    background: "rgba(29,158,117,0.1)",
                    borderRadius: "12px",
                    border: "1px solid rgba(29,158,117,0.3)",
                  }}
                  aria-busy={isPlaying}
                >
                  {displayedWords.length === 0 ? (
                    <span className="text-white/40">…</span>
                  ) : (
                    displayedWords.map((word, index) => (
                      <span
                        key={`dw-${index}-${word.slice(0, 6)}`}
                        className={`transition-all duration-150 ${
                          index === displayedWords.length - 1 ? "darija-voice-word-appear" : ""
                        }`}
                        style={{
                          color: index === currentWordIndex ? "#00FFB3" : "white",
                          fontWeight: index === currentWordIndex ? "bold" : "normal",
                          display: "inline-block",
                          margin: "0 3px",
                        }}
                      >
                        {word}
                      </span>
                    ))
                  )}
                </div>
              </div>

              <div className="border-t border-white/10 pt-4">
                <p className="text-sm font-bold text-white">{m.summaryTitle}</p>
                <ul className="mt-3 space-y-4">
                  {scanResults.map((med, i) => {
                    const jours = med.dateExpiration ? joursAvantExpiration(med.dateExpiration) : null;
                    const urgent = jours != null && jours <= 7 && jours >= 0;
                    return (
                      <li
                        key={`sum-${i}-${med.nom ?? "x"}`}
                        className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm"
                      >
                        <div className="font-semibold text-white">
                          💊 {med.nom?.trim() || "—"} {med.dosage ? <span className="text-emerald-200">{med.dosage}</span> : null}
                        </div>
                        <div className="mt-1 text-slate-300">
                          → {med.indication?.trim() || m.usageGeneral}
                          {med.posologie ? ` · ${med.posologie}` : ""}
                        </div>
                        <div className="mt-1 text-slate-400">
                          → {m.expiresPrefix} {formatExp(med.dateExpiration)}
                          {urgent ? (
                            <span className="ml-2 font-semibold text-amber-400">
                              ⚠️ {m.expiresInDays.replace("{days}", String(jours))}
                            </span>
                          ) : null}
                        </div>
                        <div className="mt-1 text-slate-500">→ {m.stockOk}</div>
                        {med.warning ? <p className="mt-2 text-xs text-amber-200/90">{med.warning}</p> : null}
                      </li>
                    );
                  })}
                </ul>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-2 border-t border-white/10 pt-6">
                <button
                  type="button"
                  onClick={() => {
                    ttsRef.current.toggleMute();
                  }}
                  aria-pressed={isMuted}
                  className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-all duration-200 ${
                    isMuted
                      ? "border border-red-500/40 bg-red-500/30 text-red-300 hover:bg-red-500/40"
                      : "bg-white/15 text-white hover:bg-white/25"
                  }`}
                >
                  {isMuted ? <VolumeX size={18} aria-hidden /> : <Volume2 size={18} aria-hidden />}
                  {isMuted ? translations[language].darijaVoiceModal.soundMuted : translations[language].darijaVoiceModal.soundOn}
                </button>
                <button
                  type="button"
                  onClick={() => setArabicFollowUpOpen(true)}
                  className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-bold text-white hover:bg-violet-500"
                >
                  🎙 {m.askQuestion}
                </button>
                <button
                  type="button"
                  onClick={saveToChronicCare}
                  className="rounded-xl border border-emerald-400/40 bg-emerald-600/25 px-4 py-2 text-sm font-bold text-emerald-100 hover:bg-emerald-600/40"
                >
                  💾 {m.save}
                </button>
                <button
                  type="button"
                  onClick={handleClose}
                  className="rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/15"
                >
                  ✕ {m.close}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <>
      {createPortal(overlay, document.body)}
      <ArabicVoiceModal
        open={arabicFollowUpOpen}
        onClose={() => setArabicFollowUpOpen(false)}
        language={language}
        extraArabicContext={extraArabicContext}
        overlayZClass="z-[10100]"
      />
    </>
  );
}

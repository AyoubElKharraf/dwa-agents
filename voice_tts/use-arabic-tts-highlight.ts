import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type MutableRefObject,
} from "react";
import { toast } from "sonner";

/** Langue TTS par défaut : arabe standard (MSA), pour clarté même si la voix est ar-MA. */
const DEFAULT_UTTERANCE_LANG = "ar-SA";
export const ARABIC_TTS_WORD_MS = 300;
const BOUNDARY_PROBE_MS = 400;

/** Toast d’aide : une seule fois par chargement de page (évite spam si TTS échoue en boucle). */
const voiceSetupHelpShownRef = { current: false };

function cancelResponsiveVoice(): void {
  try {
    window.responsiveVoice?.cancel?.();
  } catch {
    /* ignore */
  }
}

function showArabicVoiceSetupHelpOnce(shortHint?: string): void {
  if (voiceSetupHelpShownRef.current) return;
  voiceSetupHelpShownRef.current = true;
  toast.info(
    shortHint?.trim() ||
      "Voix arabe non installée — texte affiché sans son (essayez ResponsiveVoice ou une voix Windows).",
    { duration: 4000 },
  );
  toast.info(
    "Pour activer la voix arabe sur Windows :\n" +
      "1. Paramètres → Heure et langue\n" +
      "2. Parole → Voix supplémentaires\n" +
      "3. Ajouter : Arabic (Saudi Arabia)\n" +
      "4. Redémarrer Chrome",
    { duration: 8000 },
  );
}

export type ArabicTtsHighlightOptions = {
  /** Texte court optionnel pour le 1er toast (ex. clé i18n). */
  noArabicVoiceMessage?: string;
};

export function cleanArabicDisplayText(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/#{1,6}\s/g, "")
    .replace(/`(.*?)`/g, "$1")
    .replace(/\n{2,}/g, " ")
    .replace(/\n+/g, " ")
    .trim();
}

export function splitArabicWords(cleaned: string): string[] {
  return cleaned.split(/\s+/).filter(Boolean);
}

function charIndexToWordIndex(full: string, charIndex: number): number {
  const end = Math.max(0, Math.min(charIndex, full.length));
  const slice = full.slice(0, end);
  const parts = slice.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 0;
  return parts.length - 1;
}

export function pickArabicTtsVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | undefined {
  const score = (v: SpeechSynthesisVoice): number => {
    const l = v.lang.replace(/_/g, "-").toLowerCase();
    if (!l.startsWith("ar")) return -1;
    if (l.startsWith("ar-ma")) return 100;
    if (l.startsWith("ar-sa")) return 98;
    if (l.startsWith("ar-eg")) return 95;
    if (l.startsWith("ar-ae")) return 94;
    if (l === "ar") return 91;
    if (l.startsWith("ar-tn")) return 88;
    return 85;
  };
  const ranked = voices
    .map((v) => ({ v, s: score(v) }))
    .filter((x) => x.s >= 0)
    .sort((a, b) => b.s - a.s);
  if (ranked.length > 0) return ranked[0]!.v;
  return voices.find((v) => /\b(arabic|عربي)\b/i.test(v.name));
}

function applyArabicVoice(utterance: SpeechSynthesisUtterance): void {
  const voices = window.speechSynthesis.getVoices();
  const picked = pickArabicTtsVoice(voices);
  if (picked) {
    utterance.voice = picked;
  } else {
    utterance.voice = null;
  }
  utterance.lang = DEFAULT_UTTERANCE_LANG;
}

function getResponsiveVoice(): NonNullable<Window["responsiveVoice"]> | undefined {
  if (typeof window === "undefined") return undefined;
  const rv = window.responsiveVoice;
  if (rv && typeof rv.speak === "function") return rv;
  return undefined;
}

/**
 * Synthèse vocale arabe + surlignage mot à mot (`word` ou timers ~300 ms / mot).
 * Ordre : voix Web Speech native ar* → ResponsiveVoice → synthèse navigateur sans voix nommée → texte seul + aide (toasts uniques).
 */
export function useArabicTtsHighlight(
  fullTextRef: MutableRefObject<string>,
  options?: ArabicTtsHighlightOptions,
) {
  const ttsOptionsRef = useRef(options);
  ttsOptionsRef.current = options;
  const [isMuted, setIsMuted] = useState(false);
  const isMutedRef = useRef(isMuted);
  useLayoutEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  const [displayedWords, setDisplayedWords] = useState<string[]>([]);
  const displayedWordsRef = useRef<string[]>([]);
  useLayoutEffect(() => {
    displayedWordsRef.current = displayedWords;
  }, [displayedWords]);

  const [currentWordIndex, setCurrentWordIndex] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);

  const speakHighlightSessionRef = useRef(0);
  const playbackTimersRef = useRef<number[]>([]);
  const speechCancelledByMuteRef = useRef(false);

  const clearWordTimers = useCallback(() => {
    playbackTimersRef.current.forEach((id) => window.clearTimeout(id));
    playbackTimersRef.current = [];
  }, []);

  const speakWithHighlight = useCallback(
    (rawText: string) => {
      if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
      const cleaned = cleanArabicDisplayText(rawText);
      const words = splitArabicWords(cleaned);
      if (words.length === 0) return;

      const session = ++speakHighlightSessionRef.current;
      clearWordTimers();
      window.speechSynthesis.cancel();
      cancelResponsiveVoice();

      setDisplayedWords([]);
      setCurrentWordIndex(-1);
      setIsPlaying(true);

      let fallbackStarted = false;
      let boundarySeen = false;
      let probeTimer: number | undefined;
      let emptyVoicesProbeTimer: number | undefined;
      /** Synthèse Web Speech sans voix `ar*` listée (dernier recours avant texte seul). */
      let usedEngineArabicFallback = false;

      const finishVisual = () => {
        if (session !== speakHighlightSessionRef.current) return;
        setDisplayedWords(words);
        setCurrentWordIndex(-1);
        setIsPlaying(false);
      };

      const runFallback = (opts?: { keepPlayingUntilExternalEnd?: boolean }) => {
        if (fallbackStarted || session !== speakHighlightSessionRef.current) return;
        fallbackStarted = true;
        if (probeTimer !== undefined) window.clearTimeout(probeTimer);
        window.speechSynthesis.cancel();
        words.forEach((_, index) => {
          const tid = window.setTimeout(() => {
            if (session !== speakHighlightSessionRef.current) return;
            setDisplayedWords(words.slice(0, index + 1));
            setCurrentWordIndex(index);
            if (index === words.length - 1) {
              window.setTimeout(() => {
                if (session !== speakHighlightSessionRef.current) return;
                setCurrentWordIndex(-1);
                if (!opts?.keepPlayingUntilExternalEnd) setIsPlaying(false);
              }, 60);
            }
          }, index * ARABIC_TTS_WORD_MS);
          playbackTimersRef.current.push(tid);
        });
      };

      const utterance = new SpeechSynthesisUtterance(cleaned);
      utterance.rate = 0.8;
      utterance.pitch = 1;
      utterance.volume = isMutedRef.current ? 0 : 1;
      applyArabicVoice(utterance);

      const pickVoice = () => applyArabicVoice(utterance);

      utterance.onboundary = (event: SpeechSynthesisEvent) => {
        if (session !== speakHighlightSessionRef.current) return;
        if (event.name !== "word") return;
        boundarySeen = true;
        if (probeTimer !== undefined) window.clearTimeout(probeTimer);
        const wi = charIndexToWordIndex(cleaned, event.charIndex);
        setCurrentWordIndex(wi);
        setDisplayedWords(words.slice(0, wi + 1));
      };

      utterance.onstart = () => {
        if (session !== speakHighlightSessionRef.current) return;
        if (emptyVoicesProbeTimer !== undefined) {
          window.clearTimeout(emptyVoicesProbeTimer);
          emptyVoicesProbeTimer = undefined;
        }
        probeTimer = window.setTimeout(() => {
          if (session !== speakHighlightSessionRef.current) return;
          if (!boundarySeen) runFallback();
        }, BOUNDARY_PROBE_MS);
      };

      utterance.onend = () => {
        if (session !== speakHighlightSessionRef.current) return;
        if (speechCancelledByMuteRef.current) {
          speechCancelledByMuteRef.current = false;
          return;
        }
        if (!fallbackStarted) {
          setIsPlaying(false);
          finishVisual();
        }
      };

      utterance.onerror = () => {
        if (session !== speakHighlightSessionRef.current) return;
        if (usedEngineArabicFallback) showArabicVoiceSetupHelpOnce(ttsOptionsRef.current?.noArabicVoiceMessage);
        if (!boundarySeen && !fallbackStarted) runFallback();
        else if (!fallbackStarted) setIsPlaying(false);
      };

      if (isMutedRef.current) {
        runFallback();
        return;
      }

      const startSpeech = () => {
        if (session !== speakHighlightSessionRef.current) return;
        if (fallbackStarted) return;

        const voicesNow = window.speechSynthesis.getVoices();
        const arabicVoice = voicesNow.length > 0 ? pickArabicTtsVoice(voicesNow) : undefined;

        if (arabicVoice) {
          usedEngineArabicFallback = false;
          pickVoice();
          utterance.volume = isMutedRef.current ? 0 : 1;
          try {
            window.speechSynthesis.resume();
          } catch {
            /* ignore */
          }
          window.speechSynthesis.speak(utterance);
          return;
        }

        const rv = getResponsiveVoice();
        if (rv) {
          usedEngineArabicFallback = false;
          if (emptyVoicesProbeTimer !== undefined) {
            window.clearTimeout(emptyVoicesProbeTimer);
            emptyVoicesProbeTimer = undefined;
          }
          runFallback({ keepPlayingUntilExternalEnd: true });
          try {
            rv.speak(cleaned, "Arabic Male", {
              rate: 0.85,
              volume: 1,
              onstart: () => {
                if (session !== speakHighlightSessionRef.current) return;
                setIsPlaying(true);
              },
              onend: () => {
                if (session !== speakHighlightSessionRef.current) return;
                setIsPlaying(false);
                finishVisual();
              },
            });
          } catch {
            showArabicVoiceSetupHelpOnce(ttsOptionsRef.current?.noArabicVoiceMessage);
            setIsPlaying(false);
            finishVisual();
          }
          return;
        }

        if (voicesNow.length > 0) {
          usedEngineArabicFallback = true;
          pickVoice();
          utterance.volume = isMutedRef.current ? 0 : 1;
          try {
            window.speechSynthesis.resume();
          } catch {
            /* ignore */
          }
          window.speechSynthesis.speak(utterance);
          return;
        }

        showArabicVoiceSetupHelpOnce(ttsOptionsRef.current?.noArabicVoiceMessage);
        runFallback();
      };

      if (!window.speechSynthesis.getVoices().length) {
        window.speechSynthesis.addEventListener(
          "voiceschanged",
          () => {
            startSpeech();
          },
          { once: true },
        );
        emptyVoicesProbeTimer = window.setTimeout(() => {
          if (session !== speakHighlightSessionRef.current) return;
          if (!boundarySeen && !fallbackStarted) {
            const v = window.speechSynthesis.getVoices();
            if (v.length === 0) {
              /* Pas de voix système chargées — ResponsiveVoice peut quand même parler */
              const rv = getResponsiveVoice();
              if (rv) {
                usedEngineArabicFallback = false;
                runFallback({ keepPlayingUntilExternalEnd: true });
                try {
                  rv.speak(cleaned, "Arabic Male", {
                    rate: 0.85,
                    volume: 1,
                    onstart: () => {
                      if (session !== speakHighlightSessionRef.current) return;
                      setIsPlaying(true);
                    },
                    onend: () => {
                      if (session !== speakHighlightSessionRef.current) return;
                      setIsPlaying(false);
                      finishVisual();
                    },
                  });
                  return;
                } catch {
                  /* continue vers aide */
                }
              }
              showArabicVoiceSetupHelpOnce(ttsOptionsRef.current?.noArabicVoiceMessage);
            }
            runFallback();
          }
        }, 600);
        return;
      }

      startSpeech();
    },
    [clearWordTimers],
  );

  const speakHighlightRef = useRef(speakWithHighlight);
  speakHighlightRef.current = speakWithHighlight;

  const toggleMute = useCallback(() => {
    const next = !isMutedRef.current;
    isMutedRef.current = next;
    setIsMuted(next);
    if (next) {
      window.speechSynthesis.cancel();
      cancelResponsiveVoice();
      speakHighlightSessionRef.current += 1;
      speechCancelledByMuteRef.current = false;
      clearWordTimers();
      const contSession = speakHighlightSessionRef.current;
      const cleaned = cleanArabicDisplayText(fullTextRef.current);
      const words = splitArabicWords(cleaned);
      const startIdx = Math.min(displayedWordsRef.current.length, words.length);
      setIsPlaying(words.length > 0 && startIdx < words.length);
      words.forEach((_, index) => {
        if (index < startIdx) return;
        const delay = (index - startIdx) * ARABIC_TTS_WORD_MS;
        const tid = window.setTimeout(() => {
          if (contSession !== speakHighlightSessionRef.current) return;
          setDisplayedWords(words.slice(0, index + 1));
          setCurrentWordIndex(index);
          if (index === words.length - 1) {
            window.setTimeout(() => {
              if (contSession !== speakHighlightSessionRef.current) return;
              setCurrentWordIndex(-1);
              setIsPlaying(false);
            }, 60);
          }
        }, delay);
        playbackTimersRef.current.push(tid);
      });
      if (words.length === 0 || startIdx >= words.length) {
        setIsPlaying(false);
        setCurrentWordIndex(-1);
      }
    } else {
      const t = fullTextRef.current.trim();
      if (t) speakHighlightRef.current(t);
    }
  }, [clearWordTimers, fullTextRef]);

  const stopAllSpeech = useCallback(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    cancelResponsiveVoice();
    speechCancelledByMuteRef.current = true;
    clearWordTimers();
    speakHighlightSessionRef.current += 1;
    setIsPlaying(false);
  }, [clearWordTimers]);

  const resetSpeechHighlight = useCallback(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    cancelResponsiveVoice();
    speakHighlightSessionRef.current += 1;
    clearWordTimers();
    setDisplayedWords([]);
    setCurrentWordIndex(-1);
    setIsPlaying(false);
    setIsMuted(false);
    isMutedRef.current = false;
    speechCancelledByMuteRef.current = false;
  }, [clearWordTimers]);

  return {
    speakWithHighlight,
    speakHighlightRef,
    toggleMute,
    displayedWords,
    currentWordIndex,
    isPlaying,
    isMuted,
    clearWordTimers,
    speakHighlightSessionRef,
    speechCancelledByMuteRef,
    stopAllSpeech,
    resetSpeechHighlight,
    setIsMuted,
    isMutedRef,
  };
}

/**
 * Synthèse vocale (Web Speech API) pour MarocPulse.
 */
import type { AppLanguage } from "@/lib/translations";

export const SPEECH_LANGS: Record<AppLanguage, string> = {
  fr: "fr-FR",
  en: "en-US",
  ar: "ar-MA",
};

export function isSpeechSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

export function stopSpeaking(): void {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
}

/**
 * Lit le texte à voix haute dans la langue UI choisie.
 */
export function speakText(text: string, lang: AppLanguage): void {
  if (!isSpeechSupported()) return;
  const trimmed = text.trim();
  if (!trimmed) return;

  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(trimmed);
  utterance.lang = SPEECH_LANGS[lang] ?? SPEECH_LANGS.fr;
  utterance.rate = 0.9;
  utterance.pitch = 1;

  window.speechSynthesis.speak(utterance);
}

/** Valeurs inconnues → français. */
export function speakTextFromLangCode(text: string, lang: string): void {
  if (lang === "en" || lang === "ar" || lang === "fr") {
    speakText(text, lang);
    return;
  }
  speakText(text, "fr");
}

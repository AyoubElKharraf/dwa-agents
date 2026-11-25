/**
 * AGENT 7 : VOCAL (TTS EN DARIJA MAROCAINE)
 * Mission : Restitution audio naturelle pour l'accessibilité des patients.
 */
export class VoiceAgent {
  public static speak(text: string, onEnd?: () => void): void {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      console.warn("Speech Synthesis non supporté.");
      return;
    }

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    const voices = window.speechSynthesis.getVoices();

    const arabicVoice =
      voices.find((v) => v.lang.startsWith("ar-MA")) ||
      voices.find((v) => v.lang.startsWith("ar")) ||
      voices.find((v) => v.lang.includes("Arabic"));

    if (arabicVoice) {
      utterance.voice = arabicVoice;
    }

    utterance.lang = "ar-MA";
    utterance.rate = 0.95;
    utterance.pitch = 1.0;

    if (onEnd) {
      utterance.onend = onEnd;
    }

    window.speechSynthesis.speak(utterance);
  }
}

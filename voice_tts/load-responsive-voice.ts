/** CDN ResponsiveVoice (clé FREE publique documentée). */
const RESPONSIVE_VOICE_SRC =
  "https://code.responsivevoice.org/responsivevoice.js?key=FREE";

/**
 * Injecte le script ResponsiveVoice si absent (TanStack Start / pas d’index.html).
 * Ne charge rien si `window.responsiveVoice` existe déjà ou si un tag script pointe vers ce CDN.
 */
export function ensureResponsiveVoiceScript(): void {
  if (typeof document === "undefined") return;
  if (typeof window !== "undefined" && window.responsiveVoice) return;
  const already =
    document.querySelector(`script[src*="responsivevoice.org"]`) ||
    document.querySelector(`script[src*="responsivevoice"]`);
  if (already) return;

  const script = document.createElement("script");
  script.src = RESPONSIVE_VOICE_SRC;
  script.async = true;
  document.head.appendChild(script);
}

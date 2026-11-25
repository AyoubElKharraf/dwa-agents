import type { CallClaudeWithImageMediaType } from "@/lib/claude";
import type { ClaudeImageMediaType, ClaudeMessage, ClaudeUserContentPart } from "@/lib/claude";

const COMPRESS_IF_OVER_BYTES = 1024 * 1024;
const MAX_CANVAS_EDGE = 1024;
const JPEG_QUALITY = 0.8;

const ALLOWED: ReadonlySet<ClaudeImageMediaType> = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
]);

/** MIME accepté par l’API Anthropic (vision). */
export function inferClaudeImageMediaType(mime: string): ClaudeImageMediaType | null {
  const m = mime.toLowerCase().split(";")[0].trim();
  if (m === "image/jpg") return "image/jpeg";
  if (ALLOWED.has(m as ClaudeImageMediaType)) return m as ClaudeImageMediaType;
  return null;
}

/**
 * Lit une data URL `readAsDataURL` (ou chaîne base64 brute) et extrait MIME + données pour Claude.
 */
export function parseDataUrlImage(
  dataUrl: string,
): { mediaType: ClaudeImageMediaType; data: string } | null {
  const s = dataUrl.trim();
  const dm = /^data:([^;]+);base64,(.+)$/is.exec(s);
  if (dm) {
    const mt = inferClaudeImageMediaType(dm[1]);
    if (!mt) return null;
    const data = dm[2].replace(/\s/g, "");
    return data ? { mediaType: mt, data } : null;
  }
  const raw = stripBase64Prefix(s).replace(/\s/g, "");
  if (!raw) return null;
  const mt = inferClaudeImageMediaType("image/jpeg");
  return mt ? { mediaType: mt, data: raw } : null;
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(typeof r.result === "string" ? r.result : "");
    r.onerror = () => reject(r.error ?? new Error("readFileAsDataUrl"));
    r.readAsDataURL(file);
  });
}

/** Retire le préfixe data URL s’il est présent. */
export function stripBase64Prefix(raw: string): string {
  const s = raw.trim();
  if (s.includes(",")) return s.split(",").pop() ?? s;
  return s;
}

/** MIME acceptés par claude-proxy (vision ordonnance / boîte médicament). */
export function acceptedOrdonnanceMime(file: File): CallClaudeWithImageMediaType | null {
  const t = file.type.toLowerCase().split(";")[0].trim();
  if (t === "image/jpeg" || t === "image/jpg") return "image/jpeg";
  if (t === "image/png") return "image/png";
  if (t === "image/webp") return "image/webp";
  return null;
}

/**
 * Redimensionne et compresse en JPEG (même pipeline que OrdonnanceAnalyzer).
 * Évite les payloads base64 trop lourds pour claude-proxy.
 */
export async function fileToCompressedJpegBase64(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Image load failed"));
      el.src = url;
    });

    let { width, height } = img;
    const scale = Math.min(1, MAX_CANVAS_EDGE / Math.max(width, height));
    width = Math.round(width * scale);
    height = Math.round(height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas indisponible");
    ctx.drawImage(img, 0, 0, width, height);

    let dataUrl = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
    if (file.size > COMPRESS_IF_OVER_BYTES) {
      for (let q = 0.72; q >= 0.5; q -= 0.08) {
        dataUrl = canvas.toDataURL("image/jpeg", q);
        if (stripBase64Prefix(dataUrl).length < 1_400_000) break;
      }
    }

    return stripBase64Prefix(dataUrl);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Prépare une image fichier pour callClaudeWithImage (JPEG compressé). */
export async function prepareImageForClaudeProxy(file: File): Promise<string> {
  const mime = acceptedOrdonnanceMime(file);
  if (!mime) throw new Error("Formats acceptés : JPG, PNG ou WebP uniquement.");
  if (file.size > 1024 * 1024 || mime !== "image/jpeg") {
    return fileToCompressedJpegBase64(file);
  }
  const dataUrl = await readFileAsDataUrl(file);
  return stripBase64Prefix(dataUrl);
}

/**
 * Dernier message utilisateur : texte seul, ou image + texte pour la vision Claude.
 */
export function buildUserContentWithOptionalImage(
  text: string,
  image?: { base64: string; mediaType: ClaudeImageMediaType },
): ClaudeMessage["content"] {
  if (!image?.base64) return text.trim() || "…";
  const data = stripBase64Prefix(image.base64).replace(/\s/g, "");
  if (!data) return text.trim() || "…";
  const userText =
    text.trim() ||
    "Analyse cette image en détail. S'il s'agit d'une ordonnance ou d'un document médical, résume ce que tu peux lire lisiblement (médicaments, dosages si visibles). Rappelle que ce n'est pas une validation pharmaceutique ni un diagnostic — orientation et prévention uniquement.";
  const parts: ClaudeUserContentPart[] = [
    {
      type: "image",
      source: { type: "base64", media_type: image.mediaType, data },
    },
    { type: "text", text: userText },
  ];
  return parts;
}

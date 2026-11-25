import { supabase } from "@/integrations/supabase/client";

import type { AppLanguage } from "@/lib/translations";

export const CLAUDE_SERVICE_UNAVAILABLE =
  "Service IA temporairement indisponible, veuillez réessayer.";

export type ClaudePillar = "health" | "sport" | "region" | "nature" | "monitoring";

/** Types MIME image acceptés par Anthropic (vision). */
export type ClaudeImageMediaType = "image/jpeg" | "image/png" | "image/gif" | "image/webp";

export type ClaudeUserContentPart =
  | { type: "text"; text: string }
  | {
      type: "image";
      source: { type: "base64"; media_type: ClaudeImageMediaType; data: string };
    };

/** `assistant` : texte uniquement. `user` : texte ou blocs image+texte (vision). */
export type ClaudeMessage = {
  role: "user" | "assistant";
  content: string | ClaudeUserContentPart[];
};

export type CallClaudeOptions = {
  pillar: ClaudePillar;
  messages: ClaudeMessage[];
  model?: "sonnet" | "haiku";
  maxTokens?: number;
  /** Ajouté au system prompt côté Edge Function (profil, ville, etc.) */
  clientContext?: string;
  /** Langue des réponses du modèle (côté Edge Function / prompt). */
  outputLanguage?: AppLanguage;
};

function trimMessages(messages: ClaudeMessage[], max = 10): ClaudeMessage[] {
  if (messages.length <= max) return messages;
  /** Garde les derniers tours ; évite de couper au milieu d’un message image très lourd. */
  return messages.slice(-max);
}

function outputLanguageHint(lang: AppLanguage | undefined): string | undefined {
  if (!lang) return undefined;
  if (lang === "fr") return undefined;
  if (lang === "en") return "Respond entirely in English.";
  if (lang === "ar")
    return "Réponds intégralement en arabe standard (arabe moderne), formulations claires et naturelles.";
  return undefined;
}

/**
 * Appelle Claude via la Edge Function Supabase (clé API uniquement côté serveur).
 * Historique limité aux 10 derniers messages.
 */
export async function callClaude(options: CallClaudeOptions): Promise<string> {
  const {
    pillar,
    messages,
    model = "haiku",
    maxTokens = 1000,
    clientContext,
    outputLanguage,
  } = options;
  const hint = outputLanguageHint(outputLanguage);
  const mergedContext = [clientContext?.trim(), hint].filter(Boolean).join("\n\n");

  try {
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError || !session?.access_token) {
      throw new Error(CLAUDE_SERVICE_UNAVAILABLE);
    }

    const baseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
    const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

    if (!baseUrl?.trim() || !anonKey?.trim()) {
      console.error("[callClaude] VITE_SUPABASE_URL ou VITE_SUPABASE_PUBLISHABLE_KEY manquant.");
      throw new Error(CLAUDE_SERVICE_UNAVAILABLE);
    }

    const payload = {
      pillar,
      messages: trimMessages(messages),
      model,
      maxTokens,
      ...(mergedContext ? { clientContext: mergedContext } : {}),
    };

    const res = await fetch(`${baseUrl.replace(/\/$/, "")}/functions/v1/claude-proxy`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        apikey: anonKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      throw new Error(CLAUDE_SERVICE_UNAVAILABLE);
    }

    const json = (await res.json()) as { text?: string; error?: string };
    const text = typeof json.text === "string" ? json.text.trim() : "";
    if (!text || json.error) {
      throw new Error(CLAUDE_SERVICE_UNAVAILABLE);
    }

    return text;
  } catch (e) {
    if (e instanceof Error && e.message === CLAUDE_SERVICE_UNAVAILABLE) {
      throw e;
    }
    throw new Error(CLAUDE_SERVICE_UNAVAILABLE);
  }
}

export type CallClaudeWithImageMediaType = "image/jpeg" | "image/png" | "image/webp";

/**
 * Vision ordonnance / document santé : un seul tour image + texte, modèle Sonnet côté proxy.
 * Ne jamais envoyer la clé Anthropic depuis le client — uniquement JWT + Edge `claude-proxy`.
 */
export async function callClaudeWithImages(options: {
  images: { imageBase64: string; imageMediaType: CallClaudeWithImageMediaType }[];
  textPrompt: string;
  maxTokens?: number;
}): Promise<string> {
  const { images, textPrompt, maxTokens } = options;
  if (images.length === 0) {
    throw new Error(CLAUDE_SERVICE_UNAVAILABLE);
  }
  if (images.length === 1) {
    return callClaudeWithImage({
      imageBase64: images[0]!.imageBase64,
      imageMediaType: images[0]!.imageMediaType,
      textPrompt,
      maxTokens,
    });
  }

  try {
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError || !session?.access_token) {
      throw new Error(CLAUDE_SERVICE_UNAVAILABLE);
    }

    const baseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
    const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

    if (!baseUrl?.trim() || !anonKey?.trim()) {
      throw new Error(CLAUDE_SERVICE_UNAVAILABLE);
    }

    const payload = {
      images: images.map((img) => ({
        base64: img.imageBase64.replace(/\s/g, ""),
        mediaType: img.imageMediaType,
      })),
      image: { textPrompt: textPrompt.trim() },
      maxTokens:
        typeof maxTokens === "number" && maxTokens > 0 && maxTokens <= 8192
          ? Math.floor(maxTokens)
          : 4096,
    };

    const res = await fetch(`${baseUrl.replace(/\/$/, "")}/functions/v1/claude-proxy`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        apikey: anonKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      let detailMsg: string | undefined;
      try {
        const errJson = JSON.parse(errBody) as { detail?: string };
        detailMsg = errJson.detail?.trim() || undefined;
      } catch {
        // ignore
      }
      if (detailMsg) throw new Error(detailMsg);
      throw new Error(CLAUDE_SERVICE_UNAVAILABLE);
    }

    const json = (await res.json()) as { text?: string; error?: string };
    const text = typeof json.text === "string" ? json.text.trim() : "";
    if (!text || json.error) {
      throw new Error(CLAUDE_SERVICE_UNAVAILABLE);
    }
    return text;
  } catch (e) {
    if (e instanceof Error && e.message !== CLAUDE_SERVICE_UNAVAILABLE) {
      throw e;
    }
    throw new Error(CLAUDE_SERVICE_UNAVAILABLE);
  }
}

export async function callClaudeWithImage(options: {
  imageBase64: string;
  imageMediaType: CallClaudeWithImageMediaType;
  textPrompt: string;
  maxTokens?: number;
}): Promise<string> {
  const { imageBase64, imageMediaType, textPrompt, maxTokens } = options;

  try {
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError || !session?.access_token) {
      throw new Error(CLAUDE_SERVICE_UNAVAILABLE);
    }

    const baseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
    const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

    if (!baseUrl?.trim() || !anonKey?.trim()) {
      console.error(
        "[callClaudeWithImage] VITE_SUPABASE_URL ou VITE_SUPABASE_PUBLISHABLE_KEY manquant.",
      );
      throw new Error(CLAUDE_SERVICE_UNAVAILABLE);
    }

    const data = imageBase64.replace(/\s/g, "");
    if (!data) {
      throw new Error(CLAUDE_SERVICE_UNAVAILABLE);
    }

    const payload = {
      image: {
        base64: data,
        mediaType: imageMediaType,
        textPrompt: textPrompt.trim(),
      },
      maxTokens:
        typeof maxTokens === "number" && maxTokens > 0 && maxTokens <= 8192
          ? Math.floor(maxTokens)
          : 4096,
    };

    const res = await fetch(`${baseUrl.replace(/\/$/, "")}/functions/v1/claude-proxy`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        apikey: anonKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      console.error("[callClaudeWithImage] HTTP", res.status, errBody.slice(0, 500));
      if (res.status === 400 && errBody.includes("Invalid pillar")) {
        throw new Error(
          "La fonction claude-proxy doit être redéployée (mode image). Exécutez : supabase functions deploy claude-proxy",
        );
      }
      let detailMsg: string | undefined;
      try {
        const errJson = JSON.parse(errBody) as { detail?: string; error?: string };
        detailMsg = errJson.detail?.trim() || undefined;
      } catch {
        // corps non-JSON
      }
      if (detailMsg) throw new Error(detailMsg);
      throw new Error(CLAUDE_SERVICE_UNAVAILABLE);
    }

    const json = (await res.json()) as { text?: string; error?: string };
    const text = typeof json.text === "string" ? json.text.trim() : "";
    if (!text || json.error) {
      console.error("[callClaudeWithImage] empty or error response:", json.error);
      throw new Error(CLAUDE_SERVICE_UNAVAILABLE);
    }

    return text;
  } catch (e) {
    if (e instanceof Error && e.message !== CLAUDE_SERVICE_UNAVAILABLE) {
      throw e;
    }
    if (e instanceof Error && e.message === CLAUDE_SERVICE_UNAVAILABLE) {
      throw e;
    }
    console.error("[callClaudeWithImage]", e);
    throw new Error(CLAUDE_SERVICE_UNAVAILABLE);
  }
}

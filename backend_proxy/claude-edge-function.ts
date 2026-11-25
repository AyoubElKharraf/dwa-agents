import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type ClaudePillar = "health" | "sport" | "region" | "nature" | "monitoring";

type AnthropicImageBlock = {
  type: "image";
  source: { type: "base64"; media_type: string; data: string };
};
type AnthropicTextBlock = { type: "text"; text: string };
type AnthropicUserContent = string | Array<AnthropicImageBlock | AnthropicTextBlock>;

type IncomingMessage = { role: "user" | "assistant"; content: unknown };

const VISION_MEDIA = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);
/** Payload dédié ordonnance / vision (sans GIF). */
const ORDONNANCE_MEDIA = new Set(["image/jpeg", "image/png", "image/webp"]);
/** ~5 Mo côté payload base64 (marge). */
const MAX_IMAGE_B64_CHARS = 9_000_000;

function normalizeMediaType(m: string): string | null {
  const x = m.toLowerCase().split(";")[0].trim();
  if (x === "image/jpg") return "image/jpeg";
  return VISION_MEDIA.has(x) ? x : null;
}

function normalizeUserContent(raw: unknown): AnthropicUserContent {
  if (typeof raw === "string") return raw;

  if (!Array.isArray(raw)) {
    return "";
  }

  const blocks: Array<AnthropicImageBlock | AnthropicTextBlock> = [];

  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;

    if (o.type === "text" && typeof o.text === "string") {
      const t = o.text.trim();
      if (t) blocks.push({ type: "text", text: t.slice(0, 200_000) });
      continue;
    }

    if (o.type === "image" && o.source && typeof o.source === "object") {
      const src = o.source as Record<string, unknown>;
      if (src.type !== "base64") continue;
      const mediaType = normalizeMediaType(String(src.media_type ?? ""));
      if (!mediaType) continue;
      const data = String(src.data ?? "").replace(/\s/g, "");
      if (!data || data.length > MAX_IMAGE_B64_CHARS) continue;
      blocks.push({
        type: "image",
        source: { type: "base64", media_type: mediaType, data },
      });
    }
  }

  if (blocks.length === 0) return "";

  const hasText = blocks.some((b) => b.type === "text");
  if (!hasText) {
    blocks.push({
      type: "text",
      text: "Réponds en t'appuyant sur l'image ci-dessus et sur le contexte du pilier MarocPulse.",
    });
  }

  return blocks;
}

function normalizeAssistantContent(raw: unknown): string {
  if (typeof raw === "string") return raw;
  return "";
}

function normalizeIncomingMessage(
  m: IncomingMessage,
): { role: "user" | "assistant"; content: AnthropicUserContent } | null {
  if (m.role !== "user" && m.role !== "assistant") return null;
  if (m.role === "assistant") {
    const content = normalizeAssistantContent(m.content).trim();
    return content ? { role: "assistant", content } : null;
  }
  const content = normalizeUserContent(m.content);
  if (typeof content === "string") {
    return content.trim() ? { role: "user", content: content.trim() } : null;
  }
  return content.length ? { role: "user", content } : null;
}

const LANG_RULE = `RÈGLE LANGUE (priorité absolue) :
- Si l'utilisateur écrit en darija (arabe marocain dialectal, mélange arabe/français/amazigh en caractères latins ou arabes) → réponds UNIQUEMENT en darija
- Si l'utilisateur écrit en arabe classique (فصحى) → réponds en arabe classique
- Si l'utilisateur écrit en français → réponds en français
- Si l'utilisateur mélange darija et français (code-switching) → réponds en mélangeant darija et français naturellement
- Ne mentionne jamais que tu changes de langue, fais-le naturellement`;

const SYSTEM_PROMPTS: Record<ClaudePillar, string> = {
  health: `${LANG_RULE}

Tu es un assistant médical de prévention au Maroc.
Tu connais le système de santé marocain : RAMED, CNSS, CHU régionaux,
cliniques privées, pharmacies de garde.
Tu connais les maladies courantes au Maroc et leur contexte climatique.
Tu fournis des conseils de prévention clairs avec 3 niveaux :
(1) conseil immédiat à appliquer maintenant
(2) consulter un médecin dans X jours
(3) urgence → aller aux urgences / appeler le 15
Tu ne remplaces JAMAIS un médecin.
Termine toujours par un disclaimer court :
"⚠️ Ceci est un conseil de prévention, pas un diagnostic médical."
En darija, ce disclaimer devient :
"⚠️ Hada nsiba d conseil, machi diagnostic dial tabib."`,

  sport: `${LANG_RULE}

Tu es un coach sportif IA pour le Maroc.
Tu connais les sports populaires au Maroc :
football, athlétisme, arts martiaux, boxe, natation.
Tu adaptes tes conseils au contexte marocain :
- Chaleur estivale et hydratation
- Entraînement pendant Ramadan (horaires, intensité, récupération)
- Terrains et équipements disponibles localement
Tu proposes des conseils de performance, récupération et
prévention des blessures adaptés au niveau de l'utilisateur.`,

  region: `${LANG_RULE}

Tu es un guide culturel et naturel du Maroc.
Tu connais les 12 régions administratives du Maroc en détail :
Tanger-Tétouan-Al Hoceïma, Oriental, Fès-Meknès, Rabat-Salé-Kénitra,
Béni Mellal-Khénifra, Casablanca-Settat, Marrakech-Safi,
Drâa-Tafilalet, Souss-Massa, Guelmim-Oued Noun,
Laâyoune-Sakia El Hamra, Dakhla-Oued Ed-Dahab.
Pour chaque région tu connais :
- Sites naturels et randonnées
- Patrimoine culturel et historique
- Spécialités culinaires locales
- Dialectes et traditions
- Événements et moussems`,

  nature: `${LANG_RULE}

Tu es un conseiller en agriculture et nutrition pour le Maroc (pilier « Nature » de MarocPulse).
Tu connais :
- Les produits agricoles marocains par région et par saison
- Les marchés traditionnels (souks) et leurs spécificités
- Les habitudes alimentaires marocaines et leur valeur nutritive
- Les recettes traditionnelles et leur adaptation nutritionnelle
- Le contexte Ramadan : suhour, iftar, équilibre nutritionnel
Tu donnes des conseils pratiques, accessibles et ancrés
dans la réalité marocaine.`,

  monitoring: `${LANG_RULE}

Tu es le Life Monitor de MarocPulse.
Tu analyses le profil de santé, d'activité et de nutrition
de l'utilisateur et génères des recommandations proactives
et personnalisées.
Sois concis, bienveillant et actionnable.
Chaque recommandation doit avoir :
- Une observation (ce que tu as détecté)
- Une action concrète à faire aujourd'hui
- Un bénéfice attendu court terme`,
};

const MODEL_IDS: Record<"sonnet" | "haiku", string> = {
  sonnet: "claude-sonnet-4-6",
  haiku: "claude-haiku-4-5-20251001",
};

function trimMessages<T>(messages: T[], max: number): T[] {
  return messages.length <= max ? messages : messages.slice(-max);
}

/** Anthropic exige que la conversation commence par un message « user ». */
function dropLeadingAssistant<T extends { role: string }>(messages: T[]): T[] {
  let i = 0;
  while (i < messages.length && messages[i].role === "assistant") i += 1;
  return messages.slice(i);
}

function anthropicErrorDetail(status: number, errText: string): string {
  try {
    const parsed = JSON.parse(errText) as { error?: { type?: string; message?: string } };
    const msg = parsed.error?.message?.trim();
    const type = parsed.error?.type?.trim();
    if (type === "authentication_error" || status === 401) {
      return "Clé Anthropic invalide — régénérez-la sur console.anthropic.com puis mettez à jour le secret Supabase.";
    }
    if (msg) return msg.slice(0, 200);
    if (type) return type;
  } catch {
    // ignore
  }
  return status === 401 ? "Clé API Anthropic refusée." : "Upstream AI error.";
}

function jsonResponse(body: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405);
  }

  try {
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");

    if (!ANTHROPIC_API_KEY?.trim()) {
      console.error("claude-proxy: ANTHROPIC_API_KEY missing");
      return jsonResponse({ error: "Server misconfigured." }, 500);
    }
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      return jsonResponse({ error: "Missing Supabase env." }, 500);
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ error: "Unauthorized." }, 401);
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) {
      return jsonResponse({ error: "Unauthorized user." }, 401);
    }

    const body = (await req.json()) as {
      pillar?: ClaudePillar;
      messages?: IncomingMessage[];
      model?: "sonnet" | "haiku";
      maxTokens?: number;
      clientContext?: string;
      image?: { base64?: string; mediaType?: string; textPrompt?: string };
      images?: Array<{ base64?: string; mediaType?: string }>;
    };

    const imageList = Array.isArray(body.images)
      ? body.images.filter((img) => img && typeof img === "object" && typeof img.base64 === "string")
      : [];
    const textPromptFromBody =
      typeof body.image?.textPrompt === "string"
        ? body.image.textPrompt.trim().slice(0, 50_000)
        : "";

    /** Mode vision multi-images (même médicament, faces de boîte). */
    if (imageList.length > 0) {
      const textPrompt =
        textPromptFromBody ||
        (typeof (body as { textPrompt?: string }).textPrompt === "string"
          ? String((body as { textPrompt?: string }).textPrompt).trim().slice(0, 50_000)
          : "");
      if (!textPrompt) {
        return jsonResponse({ error: "textPrompt required for image analysis." }, 400);
      }

      const rawBlocks: Array<AnthropicImageBlock | AnthropicTextBlock> = [];
      for (const img of imageList.slice(0, 10)) {
        const rawMt = String(img.mediaType ?? "")
          .toLowerCase()
          .split(";")[0]
          .trim();
        const mt = rawMt === "image/jpg" ? "image/jpeg" : rawMt;
        if (!ORDONNANCE_MEDIA.has(mt)) {
          return jsonResponse({ error: "Invalid image mediaType (jpeg, png, webp only)." }, 400);
        }
        const data = String(img.base64).replace(/\s/g, "");
        if (!data || data.length > MAX_IMAGE_B64_CHARS) {
          return jsonResponse({ error: "Invalid or oversized image payload." }, 400);
        }
        rawBlocks.push({
          type: "image",
          source: { type: "base64", media_type: mt, data },
        });
      }
      rawBlocks.push({ type: "text", text: textPrompt });

      let system = SYSTEM_PROMPTS.health;
      const ctxImg = typeof body.clientContext === "string" ? body.clientContext.trim() : "";
      if (ctxImg) {
        system += `\n\nContexte utilisateur:\n${ctxImg}`;
      }

      const visionContent = normalizeUserContent(rawBlocks);
      if (typeof visionContent === "string" || visionContent.length === 0) {
        return jsonResponse({ error: "Image normalization failed." }, 400);
      }

      const model = MODEL_IDS.sonnet;
      const maxTokensImg =
        typeof body.maxTokens === "number" && body.maxTokens > 0 && body.maxTokens <= 8192
          ? Math.floor(body.maxTokens)
          : 4096;

      const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model,
          max_tokens: maxTokensImg,
          system,
          messages: [{ role: "user", content: visionContent }],
        }),
      });

      if (!anthropicRes.ok) {
        const errText = await anthropicRes.text();
        console.error("Anthropic error (images):", anthropicRes.status, errText);
        return jsonResponse(
          { error: "Upstream AI error.", detail: anthropicErrorDetail(anthropicRes.status, errText) },
          anthropicRes.status === 401 ? 401 : 502,
        );
      }

      const anthropicJson = (await anthropicRes.json()) as {
        content?: Array<{ type?: string; text?: string }>;
      };
      const text = anthropicJson.content?.find((c) => c.type === "text")?.text?.trim() ?? "";

      if (!text) {
        return jsonResponse({ error: "Empty AI response." }, 502);
      }

      return jsonResponse({ text }, 200);
    }

    /** Mode vision ordonnance : un message user image + texte, pilier santé, Sonnet 4.6 forcé. */
    if (body.image && typeof body.image === "object" && typeof body.image.base64 === "string") {
      const rawMt = String(body.image.mediaType ?? "")
        .toLowerCase()
        .split(";")[0]
        .trim();
      const mt = rawMt === "image/jpg" ? "image/jpeg" : rawMt;
      if (!ORDONNANCE_MEDIA.has(mt)) {
        return jsonResponse({ error: "Invalid image mediaType (jpeg, png, webp only)." }, 400);
      }
      const data = String(body.image.base64).replace(/\s/g, "");
      if (!data || data.length > MAX_IMAGE_B64_CHARS) {
        return jsonResponse({ error: "Invalid or oversized image payload." }, 400);
      }
      const textPrompt = String(body.image.textPrompt ?? "")
        .trim()
        .slice(0, 50_000);
      if (!textPrompt) {
        return jsonResponse({ error: "textPrompt required for image analysis." }, 400);
      }

      let system = SYSTEM_PROMPTS.health;
      const ctxImg = typeof body.clientContext === "string" ? body.clientContext.trim() : "";
      if (ctxImg) {
        system += `\n\nContexte utilisateur:\n${ctxImg}`;
      }

      const visionContent = normalizeUserContent([
        {
          type: "image",
          source: { type: "base64", media_type: mt, data },
        },
        { type: "text", text: textPrompt },
      ]);

      if (typeof visionContent === "string" || visionContent.length === 0) {
        return jsonResponse({ error: "Image normalization failed." }, 400);
      }

      const model = MODEL_IDS.sonnet;
      const maxTokensImg =
        typeof body.maxTokens === "number" && body.maxTokens > 0 && body.maxTokens <= 8192
          ? Math.floor(body.maxTokens)
          : 4096;

      const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model,
          max_tokens: maxTokensImg,
          system,
          messages: [{ role: "user", content: visionContent }],
        }),
      });

      if (!anthropicRes.ok) {
        const errText = await anthropicRes.text();
        console.error("Anthropic error (image):", anthropicRes.status, errText);
        return jsonResponse(
          { error: "Upstream AI error.", detail: anthropicErrorDetail(anthropicRes.status, errText) },
          anthropicRes.status === 401 ? 401 : 502,
        );
      }

      const anthropicJson = (await anthropicRes.json()) as {
        content?: Array<{ type?: string; text?: string }>;
      };
      const text = anthropicJson.content?.find((c) => c.type === "text")?.text?.trim() ?? "";

      if (!text) {
        return jsonResponse({ error: "Empty AI response." }, 502);
      }

      return jsonResponse({ text }, 200);
    }

    const pillar = body.pillar;
    const pillars: ClaudePillar[] = ["health", "sport", "region", "nature", "monitoring"];
    if (!pillar || !pillars.includes(pillar)) {
      return jsonResponse({ error: "Invalid pillar." }, 400);
    }

    const messages = Array.isArray(body.messages) ? body.messages : [];
    if (messages.length === 0) {
      return jsonResponse({ error: "messages required." }, 400);
    }

    const modelKey = body.model === "sonnet" ? "sonnet" : "haiku";
    const model = MODEL_IDS[modelKey];
    const maxTokens =
      typeof body.maxTokens === "number" && body.maxTokens > 0 && body.maxTokens <= 8192
        ? Math.floor(body.maxTokens)
        : 1000;

    let system = SYSTEM_PROMPTS[pillar];
    const ctx = typeof body.clientContext === "string" ? body.clientContext.trim() : "";
    if (ctx) {
      system += `\n\nContexte utilisateur:\n${ctx}`;
    }

    const normalized = messages
      .map((m) => normalizeIncomingMessage(m))
      .filter((m): m is NonNullable<typeof m> => Boolean(m));

    const trimmed = dropLeadingAssistant(trimMessages(normalized, 10));

    if (trimmed.length === 0) {
      return jsonResponse({ error: "messages invalid after normalization." }, 400);
    }

    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        system,
        messages: trimmed.map((m) => ({
          role: m.role,
          content: m.content,
        })),
      }),
    });

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text();
      console.error("Anthropic error:", anthropicRes.status, errText);
      return jsonResponse(
        { error: "Upstream AI error.", detail: anthropicErrorDetail(anthropicRes.status, errText) },
        anthropicRes.status === 401 ? 401 : 502,
      );
    }

    const anthropicJson = (await anthropicRes.json()) as {
      content?: Array<{ type?: string; text?: string }>;
    };
    const text = anthropicJson.content?.find((c) => c.type === "text")?.text?.trim() ?? "";

    if (!text) {
      return jsonResponse({ error: "Empty AI response." }, 502);
    }

    return jsonResponse({ text }, 200);
  } catch (e) {
    console.error("claude-proxy:", e);
    return jsonResponse({ error: e instanceof Error ? e.message : "Unknown error." }, 500);
  }
});

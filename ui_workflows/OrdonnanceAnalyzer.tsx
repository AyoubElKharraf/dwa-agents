import { type DragEvent, useCallback, useEffect, useId, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { callClaudeWithImage, CLAUDE_SERVICE_UNAVAILABLE } from "@/lib/claude";
import {
  acceptedOrdonnanceMime,
  fileToCompressedJpegBase64,
  readFileAsDataUrl,
  stripBase64Prefix,
} from "@/lib/claude-vision";
import { extractMedicationsSnippet } from "@/lib/ordonnance-utils";

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const COMPRESS_IF_OVER_BYTES = 1024 * 1024;

const ORDONNANCE_PROMPT = `Analyse cette ordonnance médicale marocaine.

Extrais et structure :
1. MÉDICAMENTS : nom, dosage, posologie, utilité
2. INSTRUCTIONS : avec/sans nourriture, interactions, effets secondaires
3. CONSEIL PRATIQUE : comment bien suivre ce traitement

Si ce n'est pas une ordonnance, dis-le clairement.
Si illisible, indique-le.

Termine par : ⚠️ Cette analyse est indicative. Consultez votre pharmacien ou médecin.`;

type OrdonnanceAnalyzerProps = {
  onDiscussWithAssistant: (snippet: string) => void;
};

export function OrdonnanceAnalyzer({ onDiscussWithAssistant }: OrdonnanceAnalyzerProps) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const previewObjectUrlRef = useRef<string | null>(null);
  const [hasSession, setHasSession] = useState<boolean | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [base64Jpeg, setBase64Jpeg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      setHasSession(Boolean(data.session?.access_token));
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setHasSession(Boolean(session?.access_token));
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const clearImage = useCallback(() => {
    setFile(null);
    setBase64Jpeg(null);
    if (previewObjectUrlRef.current) {
      URL.revokeObjectURL(previewObjectUrlRef.current);
      previewObjectUrlRef.current = null;
    }
    setPreviewUrl(null);
    setResult(null);
    setError(null);
  }, []);

  const processFile = useCallback(
    async (f: File) => {
      setError(null);
      setResult(null);
      if (f.size > MAX_FILE_BYTES) {
        setError("Fichier trop volumineux (maximum 5 Mo).");
        return;
      }
      const mime = acceptedOrdonnanceMime(f);
      if (!mime) {
        setError("Formats acceptés : JPG, PNG ou WebP uniquement.");
        return;
      }
      setFile(f);
      if (previewObjectUrlRef.current) {
        URL.revokeObjectURL(previewObjectUrlRef.current);
        previewObjectUrlRef.current = null;
      }
      const url = URL.createObjectURL(f);
      previewObjectUrlRef.current = url;
      setPreviewUrl(url);
      try {
        const b64 =
          f.size > COMPRESS_IF_OVER_BYTES || mime !== "image/jpeg"
            ? await fileToCompressedJpegBase64(f)
            : await new Promise<string>((resolve, reject) => {
                const r = new FileReader();
                r.onload = () => {
                  const s = typeof r.result === "string" ? r.result : "";
                  resolve(stripBase64Prefix(s));
                };
                r.onerror = () => reject(r.error);
                r.readAsDataURL(f);
              });
        setBase64Jpeg(b64);
      } catch {
        setError("Impossible de traiter cette image. Réessayez avec une autre photo.");
        clearImage();
      }
    },
    [clearImage],
  );

  const onDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const f = e.dataTransfer.files?.[0];
      if (f) void processFile(f);
    },
    [processFile],
  );

  const analyze = async () => {
    if (!hasSession) {
      setError("Connectez-vous pour utiliser l’analyse d’ordonnance.");
      return;
    }
    if (!base64Jpeg) {
      setError("Choisissez d’abord une photo d’ordonnance.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const text = await callClaudeWithImage({
        imageBase64: base64Jpeg,
        imageMediaType: "image/jpeg",
        textPrompt: ORDONNANCE_PROMPT,
      });
      setResult(text);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      setError(
        msg === CLAUDE_SERVICE_UNAVAILABLE
          ? "Service IA temporairement indisponible. Réessayez plus tard ou vérifiez que la fonction claude-proxy est déployée avec une session valide."
          : "Une erreur est survenue pendant l’analyse.",
      );
    } finally {
      setLoading(false);
    }
  };

  const sectionBlocks = (() => {
    if (!result) return null;
    const parts = result
      .split(/\n(?=\d+\.\s+)/g)
      .map((p) => p.trim())
      .filter(Boolean);
    if (parts.length <= 1) {
      return (
        <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/90 p-4 text-sm text-emerald-950 whitespace-pre-wrap">
          {result}
        </div>
      );
    }
    const tones = [
      "border-emerald-200 bg-emerald-50/95 text-emerald-950",
      "border-sky-200 bg-sky-50/95 text-sky-950",
      "border-amber-200 bg-amber-50/95 text-amber-950",
    ];
    return (
      <div className="space-y-3">
        {parts.map((block, i) => (
          <div
            key={`${i}-${block.slice(0, 24)}`}
            className={`rounded-xl border p-4 text-sm whitespace-pre-wrap ${tones[i % tones.length]}`}
          >
            {block}
          </div>
        ))}
      </div>
    );
  })();

  if (hasSession === false) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50/90 p-4 text-sm text-amber-950">
        <p className="font-semibold">Connexion requise</p>
        <p className="mt-1 text-amber-900/90">
          Connectez-vous pour utiliser l’analyse d’ordonnance (traitement sécurisé via MarocPulse,
          sans stockage de votre photo).
        </p>
      </div>
    );
  }

  if (hasSession === null) {
    return (
      <div className="rounded-2xl border border-black/10 bg-white p-4 text-sm text-on-surface-variant">
        Vérification de la session…
      </div>
    );
  }

  return (
    <div className="space-y-4 overflow-x-hidden rounded-2xl border border-[#1D9E75]/35 bg-white p-4 shadow-sm">
      <div>
        <h4 className="font-display text-lg font-bold text-primary-container">
          Analyse d’ordonnance
        </h4>
        <p className="mt-1 text-sm text-on-surface-variant md:text-xs">
          Vos photos ne sont pas enregistrées sur nos serveurs : elles sont envoyées uniquement pour
          cette analyse, puis oubliées du navigateur si vous actualisez ou lancez une nouvelle
          analyse.
        </p>
        <p className="mt-2 text-sm font-semibold text-red-700 md:text-xs">
          Données de santé sensibles — ne photographiez une ordonnance que dans un environnement
          privé. L’IA peut se tromper : en cas de doute, votre médecin ou pharmacien fait foi.
        </p>
      </div>

      <div
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={`flex min-h-[160px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors ${
          dragOver ? "border-primary-container bg-[#1D9E75]/10" : "border-black/15 bg-slate-50/80"
        }`}
      >
        <span className="material-symbols-outlined text-4xl text-primary-container">
          upload_file
        </span>
        <p className="mt-2 text-sm font-semibold text-foreground">
          Glissez-déposez une image ou cliquez
        </p>
        <p className="mt-1 text-sm text-on-surface-variant md:text-xs">
          JPG, PNG ou WebP — max 5 Mo
        </p>
        <input
          ref={inputRef}
          id={`${id}-file`}
          type="file"
          accept="image/jpeg,image/jpg,image/png,image/webp"
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) void processFile(f);
          }}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => cameraRef.current?.click()}
          className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-black/10 bg-white px-4 text-sm font-semibold sm:w-auto"
        >
          <span className="material-symbols-outlined text-[20px]">photo_camera</span>
          Prendre une photo
        </button>
        <input
          ref={cameraRef}
          type="file"
          accept="image/jpeg,image/jpg,image/png,image/webp"
          capture="environment"
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) void processFile(f);
          }}
        />
        {previewUrl ? (
          <button
            type="button"
            onClick={clearImage}
            className="inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-red-200 bg-red-50 px-4 text-sm font-semibold text-red-800 sm:w-auto"
          >
            Retirer l’image
          </button>
        ) : null}
      </div>

      {previewUrl ? (
        <div className="rounded-xl border border-black/10 bg-slate-50 p-3">
          <p className="mb-2 text-sm font-semibold text-on-surface-variant md:text-xs">
            Aperçu (non stocké)
          </p>
          <img
            src={previewUrl}
            alt="Aperçu ordonnance"
            className="mx-auto max-h-56 w-auto max-w-full rounded-lg object-contain shadow-sm"
          />
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      <button
        type="button"
        disabled={loading || !base64Jpeg}
        onClick={() => void analyze()}
        className="min-h-12 w-full rounded-xl bg-primary-container text-sm font-bold text-white shadow disabled:opacity-50"
      >
        {loading ? "Analyse en cours…" : "Analyser l’ordonnance"}
      </button>

      {result ? (
        <div className="space-y-3">
          <p className="text-sm font-bold uppercase tracking-wide text-on-surface-variant md:text-xs">
            Résultat
          </p>
          {sectionBlocks}
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() => {
                clearImage();
                setResult(null);
                setError(null);
              }}
              className="min-h-11 flex-1 rounded-xl border border-black/10 bg-white px-4 text-sm font-semibold"
            >
              Nouvelle analyse
            </button>
            <button
              type="button"
              onClick={() => {
                const snippet = extractMedicationsSnippet(result);
                onDiscussWithAssistant(snippet);
              }}
              className="min-h-11 flex-1 rounded-xl bg-[#00a884] px-4 text-sm font-bold text-white"
            >
              Discuter avec l’assistant
            </button>
          </div>
        </div>
      ) : null}

      <p className="text-center text-sm leading-snug text-on-surface-variant md:text-[11px]">
        ⚠️ Cette analyse est indicative et ne remplace pas un avis médical ou pharmaceutique.
      </p>
    </div>
  );
}

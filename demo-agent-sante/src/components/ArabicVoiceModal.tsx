import React, { useState, useEffect } from "react";
import { Mic, X, Volume2, Sparkles, CheckCircle2 } from "lucide-react";
import { speakDarijaText } from "../services/agentService";

interface VoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang?: "darija" | "fr" | "en";
}

export const ArabicVoiceModal: React.FC<VoiceModalProps> = ({
  isOpen,
  onClose,
  lang: _lang = "darija",
}) => {
  const [isListening, setIsListening] = useState(false);
  const [pulseLevel, setPulseLevel] = useState(1);
  const [speakingText, setSpeakingText] = useState("");

  const sampleDarija = "هاد الدوا هو أوگمنتان، خاصك تاخد حبة وحدة مع الفطور وحبة مع العشا. ومتوقفش الدوا بوحدك.";

  const playVoice = () => {
    setSpeakingText(sampleDarija);
    speakDarijaText(sampleDarija, () => {
      setSpeakingText("");
    });
  };

  useEffect(() => {
    if (!isOpen) {
      setIsListening(false);
      return;
    }
    const interval = setInterval(() => {
      setPulseLevel((prev) => (prev === 1 ? 1.25 : 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [isOpen]);

  if (!isOpen) return null;

  const toggleListening = () => {
    setIsListening(!isListening);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg rounded-3xl bg-[#090d19] border border-indigo-900/40 p-8 shadow-2xl text-center text-slate-100 flex flex-col items-center">
        {/* Glow Effects */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />

        {/* Pulsing Mic Circle */}
        <div className="relative my-8 flex items-center justify-center">
          {/* Outer Pulsing Rings */}
          <div
            className="absolute rounded-full border border-indigo-500/20 transition-all duration-1000"
            style={{
              width: `${160 * pulseLevel}px`,
              height: `${160 * pulseLevel}px`,
            }}
          />
          <div
            className="absolute rounded-full border border-purple-500/30 transition-all duration-700"
            style={{
              width: `${130 * pulseLevel}px`,
              height: `${130 * pulseLevel}px`,
            }}
          />

          {/* Central Button */}
          <button
            onClick={toggleListening}
            className={`relative z-10 w-28 h-28 rounded-full flex items-center justify-center transition-all duration-300 shadow-xl ${
              isListening
                ? "bg-gradient-to-tr from-rose-500 to-amber-500 shadow-rose-500/40 scale-105"
                : "bg-gradient-to-tr from-indigo-600 via-purple-600 to-blue-500 shadow-indigo-500/40 hover:scale-105"
            }`}
          >
            <Mic size={42} className="text-white drop-shadow-md" />
          </button>
        </div>

        {/* Text Instructions */}
        <h3 className="text-xl font-bold text-white tracking-wide">
          {isListening ? "كَنسمعك دابا..." : "Appuyez pour parler en darija"}
        </h3>
        <p className="text-2xl font-semibold text-indigo-300 mt-2 font-arabic" dir="rtl">
          تحدث بالدارجة المغربية
        </p>
        <p className="text-xs text-slate-400 mt-2 max-w-xs">
          Agent Vocal (TTS) + Agent Génération : Restitution fluide, interactive et adaptée à votre dialecte.
        </p>

        {/* Actions */}
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3 w-full">
          <button
            onClick={toggleListening}
            className="w-full sm:w-auto flex-1 flex items-center justify-center gap-2 py-3 px-5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition shadow-lg shadow-indigo-600/30"
          >
            <Sparkles size={16} />
            <span>{isListening ? "إيقاف (Arrêter)" : "Commencer à parler"}</span>
          </button>

          <button
            onClick={playVoice}
            className="w-full sm:w-auto flex items-center justify-center gap-2 py-3 px-5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm transition shadow-lg shadow-emerald-600/30"
          >
            <Volume2 size={16} />
            <span>{speakingText ? "Lecture en cours..." : "Écouter exemple"}</span>
          </button>

          <button
            onClick={onClose}
            className="w-full sm:w-auto flex items-center justify-center gap-1.5 py-3 px-6 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-sm transition border border-slate-700"
          >
            <X size={16} />
            <span>Fermer</span>
          </button>
        </div>

        {/* Agent Badges */}
        <div className="mt-6 flex items-center justify-center gap-3 text-[11px] text-slate-400">
          <span className="flex items-center gap-1">
            <CheckCircle2 size={12} className="text-emerald-400" /> Synthèse vocale naturelle
          </span>
          <span className="flex items-center gap-1">
            <Volume2 size={12} className="text-indigo-400" /> Support Darija / Arabe standard
          </span>
        </div>
      </div>
    </div>
  );
};

import React from "react";
import { X, Camera, Image, ShieldCheck, Cpu } from "lucide-react";

interface ScanModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectFiles: (files: FileList | null) => void;
  fileCount: number;
  maxFiles?: number;
}

export const ScanModal: React.FC<ScanModalProps> = ({
  isOpen,
  onClose,
  onSelectFiles,
  fileCount,
  maxFiles = 5,
}) => {
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl rounded-3xl bg-[#0b1322] border border-slate-800 p-8 shadow-2xl text-slate-100">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl">📷</span>
              <h2 className="text-xl font-bold tracking-tight text-white">Scanner mes médicaments</h2>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Envoyez 1 ou plusieurs photos (boîte, blister, ordonnance)
            </p>
            <div className="flex items-center gap-2 mt-1">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="text-xs text-emerald-400 font-medium">
                Piloté par Agent Vision & OCR + Agent Identification
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-slate-800/80 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Dropzone Area */}
        <div
          onClick={() => fileInputRef.current?.click()}
          className="mt-8 border-2 border-dashed border-slate-700/80 hover:border-emerald-500/60 rounded-3xl p-12 text-center bg-slate-900/40 hover:bg-slate-900/70 transition cursor-pointer group"
        >
          <div className="w-16 h-16 mx-auto rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 group-hover:scale-110 transition duration-300">
            <Camera size={32} />
          </div>
          <h3 className="mt-5 text-base font-semibold text-slate-200">
            Prenez des photos ou choisissez depuis votre galerie
          </h3>
          <p className="text-xs text-slate-400 mt-1">Jusqu'à {maxFiles} photos de médicaments</p>

          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*"
            className="hidden"
            onChange={(e) => onSelectFiles(e.target.files)}
          />
        </div>

        {/* Action Buttons */}
        <div className="mt-8 flex items-center justify-center gap-4">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2.5 px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-sm transition shadow-lg shadow-emerald-500/20"
          >
            <Camera size={18} />
            <span>Caméra</span>
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2.5 px-6 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-sm transition border border-slate-700"
          >
            <Image size={18} />
            <span>Galerie</span>
          </button>
        </div>

        {/* Counter */}
        <div className="mt-6 text-center text-xs font-medium text-slate-400">
          Photos sélectionnées : <span className="text-emerald-400 font-bold">{fileCount}</span> / {maxFiles}
        </div>

        {/* Multi-Agent Indicator Footer */}
        <div className="mt-8 pt-4 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500">
          <span className="flex items-center gap-1.5">
            <Cpu size={14} className="text-cyan-400" /> Validation croisée via bases RAG fiables
          </span>
          <span className="flex items-center gap-1.5">
            <ShieldCheck size={14} className="text-emerald-400" /> Données chiffrées localement
          </span>
        </div>
      </div>
    </div>
  );
};

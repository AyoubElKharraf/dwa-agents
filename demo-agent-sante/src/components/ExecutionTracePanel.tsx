import React from "react";
import { CheckCircle2, AlertTriangle, XCircle, Clock, ShieldCheck, Cpu } from "lucide-react";
import type { AgentTraceStep, ValidationStatus } from "../types/agentTypes";

interface ExecutionTracePanelProps {
  traces: AgentTraceStep[];
  validationStatus?: ValidationStatus;
  validationReasoning?: string;
  isOpen: boolean;
  onToggle: () => void;
}

export const ExecutionTracePanel: React.FC<ExecutionTracePanelProps> = ({
  traces,
  validationStatus,
  validationReasoning,
  isOpen,
  onToggle,
}) => {
  return (
    <div className="rounded-3xl border border-white/[0.08] bg-slate-900/60 backdrop-blur-xl p-5 shadow-xl transition-all">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            <Cpu size={16} />
          </div>
          <div>
            <h4 className="text-xs font-bold text-white flex items-center gap-2">
              <span>Journal d'Audit Multi-Agents (Traçabilité)</span>
              <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            </h4>
            <p className="text-[10px] text-slate-400">
              Orchestrateur & 7 Agents en collaboration continue (Mémoire partagée)
            </p>
          </div>
        </div>

        <button
          onClick={onToggle}
          className="text-[11px] font-semibold text-emerald-400 hover:text-emerald-300 transition px-3 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20"
        >
          {isOpen ? "Masquer le journal" : `Afficher (${traces.length} étapes)`}
        </button>
      </div>

      {/* Validation Status Badge */}
      {validationStatus && (
        <div
          className={`mt-3 p-3 rounded-2xl border flex items-center justify-between text-xs ${
            validationStatus === "VALIDATED"
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
              : validationStatus === "NEEDS_CLARIFICATION"
              ? "bg-amber-500/10 border-amber-500/30 text-amber-300"
              : "bg-rose-500/10 border-rose-500/30 text-rose-300"
          }`}
        >
          <div className="flex items-center gap-2">
            <ShieldCheck size={16} />
            <span className="font-bold">Agent de Validation : {validationStatus}</span>
          </div>
          <span className="text-[10px] font-medium text-slate-300">{validationReasoning}</span>
        </div>
      )}

      {/* Trace Items List */}
      {isOpen && (
        <div className="mt-4 space-y-2.5 max-h-72 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-700">
          {traces.length === 0 ? (
            <p className="text-xs text-slate-500 text-center py-4">En attente d'une requête ou d'un scan...</p>
          ) : (
            traces.map((trace, idx) => (
              <div
                key={idx}
                className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 flex items-start gap-3 hover:border-slate-700 transition"
              >
                {/* Status Icon */}
                <div className="mt-0.5 shrink-0">
                  {trace.status === "success" && <CheckCircle2 size={15} className="text-emerald-400" />}
                  {trace.status === "warning" && <AlertTriangle size={15} className="text-amber-400" />}
                  {trace.status === "error" && <XCircle size={15} className="text-rose-400" />}
                  {trace.status === "in_progress" && <Clock size={15} className="text-cyan-400 animate-spin" />}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-white tracking-tight">{trace.agent}</span>
                    <span className="text-[10px] font-mono text-slate-500">{trace.timestamp}</span>
                  </div>
                  <p className="text-[11px] font-medium text-slate-300 mt-0.5">{trace.action}</p>
                  {trace.details && <p className="text-[10px] text-slate-400 mt-0.5 font-mono">{trace.details}</p>}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

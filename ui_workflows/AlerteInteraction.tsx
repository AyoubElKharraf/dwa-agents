import type { DrugInteraction } from "@/lib/drug-interactions";

export type AlerteInteractionProps = {
  interactions: DrugInteraction[];
  onSpeak: (text: string) => void;
};

export function AlerteInteraction({ interactions, onSpeak }: AlerteInteractionProps) {
  if (interactions.length === 0) return null;

  const majeures = interactions.filter((i) => i.niveau === "majeure");

  return (
    <div
      className="med-drug-interaction-alert-pulse mb-4 rounded-2xl border-2 p-4"
      style={{
        background: "rgba(220, 38, 38, 0.15)",
        borderColor: "rgba(220, 38, 38, 0.6)",
      }}
    >
      <div className="mb-3 flex items-center gap-2">
        <span className="text-2xl" aria-hidden>
          🚨
        </span>
        <span
          className="text-base font-bold text-[#FF6B6B]"
          style={{ direction: "rtl" }}
        >
          تحذير: تفاعلات دوائية خطيرة
        </span>
        <button
          type="button"
          onClick={() => onSpeak(interactions.map((i) => i.arabicAlert).join(" "))}
          className="cursor-pointer rounded-lg border px-2.5 py-1 text-sm font-medium text-[#FF6B6B]"
          style={{
            marginInlineStart: "auto",
            background: "rgba(220,38,38,0.3)",
            borderColor: "rgba(220,38,38,0.5)",
          }}
        >
          🔊 استمع
        </button>
      </div>

      {interactions.map((interaction) => (
        <div
          key={interaction.id}
          className="mb-2 rounded-xl bg-black/30 p-3 last:mb-0"
          style={{ direction: "rtl", textAlign: "right" }}
        >
          <span
            className="inline-block rounded-full px-2 py-0.5 text-xs font-bold text-white"
            style={{
              background: interaction.niveau === "majeure" ? "#DC2626" : "#F59E0B",
            }}
          >
            {interaction.niveau === "majeure" ? "⚠️ خطير جداً" : "⚡ تحذير"}
          </span>
          <p className="mb-1 mt-2 font-bold text-[#FF6B6B]">{interaction.danger}</p>
          <p className="my-1 text-sm text-white/80">{interaction.consequence}</p>
          <p className="mt-1 text-sm font-medium text-[#00FFB3]">✅ {interaction.conseil}</p>
        </div>
      ))}

      {majeures.length > 0 ? (
        <a
          href="tel:15"
          className="mt-3 flex items-center justify-center gap-2 rounded-xl bg-[#DC2626] p-2.5 font-bold text-white no-underline"
        >
          📞 اتصل بالإسعاف — 15
        </a>
      ) : null}
    </div>
  );
}

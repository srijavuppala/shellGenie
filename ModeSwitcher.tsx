import { useStore, GenMode } from "../store";

const MODES: { id: GenMode; label: string; icon: string; color: string }[] = [
  { id: "quick", label: "Quick", icon: "⚡", color: "text-white/50" },
  { id: "learn", label: "Learn", icon: "🎓", color: "text-teal-400" },
  { id: "workflow", label: "Workflow", icon: "🔗", color: "text-violet-400" },
];

export function ModeSwitcher() {
  const genMode = useStore((s) => s.genMode);
  const setGenMode = useStore((s) => s.setGenMode);

  return (
    <div className="flex items-center gap-0.5 bg-white/[0.03] rounded-lg p-0.5">
      {MODES.map((m) => {
        const active = genMode === m.id;
        return (
          <button
            key={m.id}
            onClick={() => setGenMode(m.id)}
            className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium transition-all ${
              active
                ? `bg-white/[0.08] ${m.color}`
                : "text-white/20 hover:text-white/35 hover:bg-white/[0.03]"
            }`}
          >
            <span className="text-[9px]">{m.icon}</span>
            {m.label}
          </button>
        );
      })}
    </div>
  );
}

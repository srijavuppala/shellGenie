import { useState } from "react";

interface Props {
  content: string;
  isStreaming: boolean;
  onCopy: () => void;
  onPaste: () => void;
}

/**
 * Parses Learn Mode output:
 *   Line 1: full command
 *   Line 2: empty
 *   Lines 3+: "segment ← explanation"
 */
function parseLearnOutput(raw: string) {
  const lines = raw.split("\n");
  const command = lines[0]?.trim() || "";
  const annotations: { segment: string; explanation: string }[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const sep = line.indexOf("←");
    if (sep !== -1) {
      annotations.push({
        segment: line.slice(0, sep).trim(),
        explanation: line.slice(sep + 1).trim(),
      });
    }
  }

  return { command, annotations };
}

export function LearnView({ content, isStreaming, onCopy, onPaste }: Props) {
  const [copied, setCopied] = useState(false);
  const { command, annotations } = parseLearnOutput(content);

  function doCopy() {
    onCopy();
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  }

  return (
    <div className="group relative">
      {/* Runnable command */}
      <div onClick={doCopy} className="px-4 pt-3 pb-2 cursor-pointer hover:bg-white/[0.02] transition-colors">
        <pre className="text-[13px] font-mono text-white/85 whitespace-pre-wrap leading-relaxed">
          {command}
          {isStreaming && (
            <span className="inline-block w-[2px] h-[14px] bg-teal-400 animate-pulse ml-0.5 align-middle" />
          )}
        </pre>
      </div>

      {/* Annotations */}
      {annotations.length > 0 && (
        <div className="px-4 pb-3 space-y-1">
          <div className="flex items-center gap-1.5 mb-2">
            <span className="text-[10px] text-teal-400/50">🎓</span>
            <span className="text-[10px] text-teal-400/40 uppercase tracking-widest font-medium">Learn Mode</span>
          </div>
          {annotations.map((a, i) => (
            <div key={i} className="flex items-start gap-2 text-[12px] font-mono">
              <span className="text-white/60 whitespace-pre min-w-0 shrink-0">
                {a.segment}
              </span>
              <span className="text-white/15 shrink-0">←</span>
              <span className="text-teal-400/50 italic">
                {a.explanation}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Streaming cursor when annotations haven't arrived yet */}
      {isStreaming && annotations.length === 0 && !command && (
        <div className="px-4 pb-3">
          <span className="inline-block w-[2px] h-[14px] bg-teal-400 animate-pulse" />
        </div>
      )}

      {/* Action buttons */}
      {!isStreaming && command && (
        <div className="absolute top-2 right-2 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={(e) => { e.stopPropagation(); doCopy(); }}
            className="px-2.5 py-1 rounded-md bg-white/[0.06] hover:bg-white/[0.1] text-[11px] text-white/50">
            {copied ? "✓ Copied" : "Copy"}
          </button>
          <button onClick={(e) => { e.stopPropagation(); onPaste(); }}
            className="px-2.5 py-1 rounded-md bg-teal-500/15 hover:bg-teal-500/25 text-[11px] text-teal-400">
            Paste & Run
          </button>
        </div>
      )}
    </div>
  );
}

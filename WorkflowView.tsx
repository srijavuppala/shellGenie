import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useStore } from "../store";

interface Props {
  content: string;
  isStreaming: boolean;
}

interface WorkflowStep {
  number: number;
  description: string;
  command: string;
}

/**
 * Parses Workflow Mode output:
 *   [STEP 1] Description text
 *   command_here
 *
 *   [STEP 2] Description text
 *   command_here
 */
function parseWorkflow(raw: string): WorkflowStep[] {
  const steps: WorkflowStep[] = [];
  const lines = raw.split("\n");
  let current: Partial<WorkflowStep> | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    const stepMatch = trimmed.match(/^\[STEP\s+(\d+)\]\s*(.*)$/i);

    if (stepMatch) {
      // Save previous step
      if (current?.command) {
        steps.push(current as WorkflowStep);
      }
      current = {
        number: parseInt(stepMatch[1]),
        description: stepMatch[2].trim(),
        command: "",
      };
    } else if (current && trimmed) {
      // Command line for the current step
      current.command = current.command ? current.command + "\n" + trimmed : trimmed;
    }
  }

  // Push last step
  if (current?.command) {
    steps.push(current as WorkflowStep);
  }

  return steps;
}

export function WorkflowView({ content, isStreaming }: Props) {
  const [executedSteps, setExecutedSteps] = useState<Set<number>>(new Set());
  const [copiedStep, setCopiedStep] = useState<number | null>(null);
  const terminalContext = useStore((s) => s.terminalContext);

  const steps = parseWorkflow(content);

  async function runStep(step: WorkflowStep) {
    try {
      await invoke("paste_to_terminal", {
        command: step.command.trim(),
        appName: terminalContext.appName,
      });
      setExecutedSteps((prev) => new Set(prev).add(step.number));
    } catch {
      // Fallback: copy
      copyStep(step);
    }
  }

  async function copyStep(step: WorkflowStep) {
    await invoke("copy_to_clipboard", { text: step.command.trim() });
    setCopiedStep(step.number);
    setTimeout(() => setCopiedStep(null), 1200);
  }

  async function runAll() {
    const chained = steps.map((s) => s.command.trim()).join(" && ");
    try {
      await invoke("paste_to_terminal", {
        command: chained,
        appName: terminalContext.appName,
      });
      setExecutedSteps(new Set(steps.map((s) => s.number)));
    } catch {
      await invoke("copy_to_clipboard", { text: chained });
    }
  }

  return (
    <div className="px-4 py-3 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-violet-400/50">🔗</span>
          <span className="text-[10px] text-violet-400/40 uppercase tracking-widest font-medium">
            Workflow · {steps.length} step{steps.length !== 1 ? "s" : ""}
          </span>
        </div>
        {steps.length > 1 && !isStreaming && (
          <button onClick={runAll}
            className="px-2 py-0.5 rounded-md bg-violet-500/15 hover:bg-violet-500/25 text-[10px] text-violet-400 transition-colors">
            Run All
          </button>
        )}
      </div>

      {/* Steps */}
      {steps.map((step) => {
        const executed = executedSteps.has(step.number);
        return (
          <div key={step.number}
            className={`rounded-xl border transition-colors ${
              executed
                ? "border-emerald-500/20 bg-emerald-500/5"
                : "border-white/[0.05] bg-white/[0.02]"
            }`}
          >
            {/* Step header */}
            <div className="flex items-center justify-between px-3 pt-2.5 pb-1">
              <div className="flex items-center gap-2">
                <span className={`w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center ${
                  executed
                    ? "bg-emerald-500/20 text-emerald-400"
                    : "bg-white/[0.06] text-white/40"
                }`}>
                  {executed ? "✓" : step.number}
                </span>
                <span className="text-[12px] text-white/50">{step.description}</span>
              </div>
            </div>

            {/* Command */}
            <div className="px-3 pb-2">
              <pre className="text-[12px] font-mono text-white/75 whitespace-pre-wrap leading-relaxed bg-black/20 rounded-lg px-2.5 py-1.5">
                {step.command}
              </pre>
            </div>

            {/* Actions */}
            <div className="flex gap-1.5 px-3 pb-2.5">
              <button onClick={() => copyStep(step)}
                className="px-2 py-0.5 rounded-md bg-white/[0.04] hover:bg-white/[0.08] text-[10px] text-white/40 transition-colors">
                {copiedStep === step.number ? "✓ Copied" : "Copy"}
              </button>
              {!executed && (
                <button onClick={() => runStep(step)}
                  className="px-2 py-0.5 rounded-md bg-teal-500/15 hover:bg-teal-500/25 text-[10px] text-teal-400 transition-colors">
                  Run
                </button>
              )}
            </div>
          </div>
        );
      })}

      {/* Streaming indicator */}
      {isStreaming && (
        <div className="flex items-center gap-2 text-[11px] text-white/20">
          <div className="w-3 h-3 border-2 border-violet-400/30 border-t-violet-400 rounded-full animate-spin" />
          Planning steps...
        </div>
      )}
    </div>
  );
}

import { useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useStore } from "../store";
import { CommandInput } from "./CommandInput";
import { ResultsArea } from "./ResultsArea";
import { LearnView } from "./LearnView";
import { WorkflowView } from "./WorkflowView";
import { DestructiveBadge } from "./DestructiveBadge";
import { ContextPill } from "./ContextPill";
import { ModeSwitcher } from "./ModeSwitcher";

export function Overlay() {
  const query = useStore((s) => s.query);
  const setQuery = useStore((s) => s.setQuery);
  const isStreaming = useStore((s) => s.isStreaming);
  const setIsStreaming = useStore((s) => s.setIsStreaming);
  const streamedCommand = useStore((s) => s.streamedCommand);
  const streamError = useStore((s) => s.streamError);
  const clearStream = useStore((s) => s.clearStream);
  const isDestructive = useStore((s) => s.isDestructive);
  const setIsDestructive = useStore((s) => s.setIsDestructive);
  const setSafetyPatterns = useStore((s) => s.setSafetyPatterns);
  const safetyPatterns = useStore((s) => s.safetyPatterns);
  const severity = useStore((s) => s.severity);
  const setSeverity = useStore((s) => s.setSeverity);
  const setTerminalContext = useStore((s) => s.setTerminalContext);
  const terminalContext = useStore((s) => s.terminalContext);
  const setMode = useStore((s) => s.setMode);
  const safetyEnabled = useStore((s) => s.safetyEnabled);
  const model = useStore((s) => s.model);
  const genMode = useStore((s) => s.genMode);

  // Keyboard: Escape to dismiss, Ctrl+C to cancel
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (isStreaming) invoke("cancel_stream");
        else {
          invoke("hide_overlay");
          clearStream();
          setQuery("");
        }
      }
      if (e.ctrlKey && e.key === "c" && isStreaming) invoke("cancel_stream");
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isStreaming]);

  const handleSubmit = useCallback(async () => {
    const q = query.trim();
    if (!q || isStreaming) return;
    if (q === "/settings") { setMode("settings"); setQuery(""); return; }

    clearStream();
    setIsStreaming(true);

    try {
      const ctx = await invoke<any>("get_terminal_context");
      setTerminalContext({
        cwd: ctx.cwd,
        shell: ctx.shell,
        recentOutput: ctx.recent_output,
        appName: ctx.app_name,
      });

      await invoke("stream_command", {
        query: q,
        context: {
          cwd: ctx.cwd,
          shell: ctx.shell,
          recent_output: ctx.recent_output,
          app_name: ctx.app_name,
        },
        model,
        mode: genMode,
      });
    } catch (err) {
      setIsStreaming(false);
    }
  }, [query, isStreaming, model, genMode]);

  // Safety check after streaming completes
  useEffect(() => {
    if (!isStreaming && streamedCommand && safetyEnabled) {
      let cmdToCheck = streamedCommand;
      if (genMode === "learn") {
        cmdToCheck = streamedCommand.split("\n")[0] || streamedCommand;
      }
      invoke<any>("check_destructive", { command: cmdToCheck }).then((r) => {
        setIsDestructive(r.is_destructive);
        setSafetyPatterns(r.matched_patterns);
        setSeverity(r.severity);
      });
    }
  }, [isStreaming, streamedCommand]);

  async function handleCopy() {
    if (!streamedCommand) return;
    const text = genMode === "learn"
      ? streamedCommand.split("\n")[0] || streamedCommand
      : streamedCommand;
    await invoke("copy_to_clipboard", { text });
  }

  async function handlePaste() {
    if (!streamedCommand) return;
    const cmd = genMode === "learn"
      ? streamedCommand.split("\n")[0] || streamedCommand
      : streamedCommand;
    try {
      await invoke("paste_to_terminal", { command: cmd, appName: terminalContext.appName });
      await invoke("hide_overlay");
      clearStream();
      setQuery("");
    } catch { handleCopy(); }
  }

  function renderResults() {
    if (streamError) {
      return <div className="px-4 py-3 text-[13px] text-red-400/80">{streamError}</div>;
    }
    switch (genMode) {
      case "learn":
        return <LearnView content={streamedCommand} isStreaming={isStreaming} onCopy={handleCopy} onPaste={handlePaste} />;
      case "workflow":
        return <WorkflowView content={streamedCommand} isStreaming={isStreaming} />;
      default:
        return <ResultsArea command={streamedCommand} isStreaming={isStreaming} onCopy={handleCopy} onPaste={handlePaste} />;
    }
  }

  return (
    <div data-tauri-drag-region className="w-full h-full flex items-start justify-center pt-3">
      <div className="genie-container w-full max-w-[660px] rounded-2xl border border-teal-500/10 bg-[#0d1117]/[0.97] backdrop-blur-2xl shadow-2xl overflow-hidden">

        {/* Top bar: Context + Mode Switcher */}
        <div className="px-4 pt-3 pb-0 flex items-center justify-between">
          {terminalContext.cwd ? (
            <ContextPill cwd={terminalContext.cwd} shell={terminalContext.shell} />
          ) : <div />}
          <ModeSwitcher />
        </div>

        {/* Input */}
        <CommandInput value={query} onChange={setQuery} onSubmit={handleSubmit} isStreaming={isStreaming} />

        {/* Results */}
        {(streamedCommand || isStreaming || streamError) && (
          <div className="border-t border-white/[0.05]">
            {renderResults()}
            {isDestructive && !isStreaming && (
              <DestructiveBadge patterns={safetyPatterns} severity={severity} />
            )}
          </div>
        )}

        {/* Footer */}
        <div className="px-4 py-2 flex items-center justify-between text-[10px] text-white/20 border-t border-white/[0.03]">
          <div className="flex items-center gap-3">
            <span><kbd className="kbd">⏎</kbd> Generate</span>
            <span><kbd className="kbd">Esc</kbd> Dismiss</span>
            {streamedCommand && !isStreaming && genMode !== "workflow" && (
              <span><kbd className="kbd">Click</kbd> Copy</span>
            )}
          </div>
          <span className="flex items-center gap-1.5">
            <span className="text-teal-400/40">🧞</span>
            <span>ShellGenie</span>
          </span>
        </div>
      </div>
    </div>
  );
}

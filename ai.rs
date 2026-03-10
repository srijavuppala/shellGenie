use crate::state::AppState;
use futures_util::StreamExt;
use reqwest::header::{HeaderMap, HeaderValue, CONTENT_TYPE};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager};

/// Terminal context passed from the frontend
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TerminalContext {
    pub cwd: Option<String>,
    pub shell: Option<String>,
    pub recent_output: Option<String>,
    pub app_name: Option<String>,
}

/// Generation mode
/// - "quick"    → just the command (default, like Cmd-K)
/// - "learn"    → command + inline explanations for every flag/pipe/argument
/// - "workflow" → multi-step plan with numbered steps, each with a command + description
#[derive(Debug, Serialize, Deserialize, Clone)]
pub enum GenMode {
    Quick,
    Learn,
    Workflow,
}

// ── System Prompts ──────────────────────────────────────────────────

fn prompt_quick() -> &'static str {
    "You are ShellGenie, an AI that converts natural language into precise, \
     working terminal commands.\n\n\
     RULES:\n\
     1. Output ONLY the command. No explanation. No markdown. No code fences.\n\
     2. Chain multiple steps with && or ; as appropriate.\n\
     3. Use the provided terminal context to be contextually accurate.\n\
     4. Prefer portable POSIX commands. Use macOS-specific tools when relevant.\n\
     5. For destructive operations, still output the command — safety layer handles it.\n\
     6. If ambiguous, give the most common / safe interpretation.\n\
     7. Never apologize. Never say \"sure\". Just output the command.\n"
}

fn prompt_learn() -> &'static str {
    "You are ShellGenie in LEARN MODE. Convert natural language into a terminal command, \
     then explain every part of it so the user learns.\n\n\
     FORMAT (strict — follow exactly):\n\
     Line 1: The complete, runnable command.\n\
     Line 2: Empty line.\n\
     Then for each meaningful segment of the command, output:\n\
       segment ← explanation\n\n\
     Example:\n\
     find . -name \"*.pdf\" -mtime -7 -exec du -sh {} +\n\n\
     find .          ← search starting from current directory\n\
     -name \"*.pdf\"   ← match files ending in .pdf\n\
     -mtime -7       ← modified within the last 7 days\n\
     -exec du -sh {} + ← run du (disk usage, human-readable) on each match\n\n\
     RULES:\n\
     1. The command on line 1 must be complete and runnable as-is.\n\
     2. Use ← as the separator between segment and explanation.\n\
     3. Keep explanations short (under 12 words each).\n\
     4. Cover flags, pipes, redirections, and non-obvious arguments.\n\
     5. Skip explaining trivially obvious parts (like the base command name itself \
        if it's common, e.g. 'ls', 'cd').\n\
     6. Never use markdown. No code fences. No bullet points.\n"
}

fn prompt_workflow() -> &'static str {
    "You are ShellGenie in WORKFLOW MODE. Break complex tasks into a numbered \
     sequence of steps. Each step has a description and a runnable command.\n\n\
     FORMAT (strict — follow exactly):\n\
     [STEP 1] Short description of what this step does\n\
     command_here\n\n\
     [STEP 2] Short description\n\
     command_here\n\n\
     [STEP 3] Short description\n\
     command_here\n\n\
     RULES:\n\
     1. Each [STEP N] line is a short plain-English description (under 15 words).\n\
     2. The line immediately after is the runnable command (no fences, no markdown).\n\
     3. Use 2-6 steps. Don't over-split trivial tasks.\n\
     4. If the task is simple enough for one command, just use [STEP 1].\n\
     5. Each command must be independently runnable.\n\
     6. Steps should be in logical execution order.\n\
     7. Never use markdown. No code fences. No bullet points.\n"
}

/// Build the full system prompt with mode + context
fn build_system_prompt(ctx: &TerminalContext, mode: &GenMode) -> String {
    let base = match mode {
        GenMode::Quick => prompt_quick(),
        GenMode::Learn => prompt_learn(),
        GenMode::Workflow => prompt_workflow(),
    };

    let mut p = String::from(base);

    if let Some(ref cwd) = ctx.cwd {
        p.push_str(&format!("\nCurrent directory: {}\n", cwd));
    }
    if let Some(ref shell) = ctx.shell {
        p.push_str(&format!("Shell: {}\n", shell));
    }
    if let Some(ref output) = ctx.recent_output {
        let truncated: String = output.chars().take(800).collect();
        p.push_str(&format!(
            "Recent terminal output:\n```\n{}\n```\n",
            truncated
        ));
    }
    if let Some(ref app) = ctx.app_name {
        p.push_str(&format!("Foreground app: {}\n", app));
    }
    p
}

/// Stream a command from Claude API (SSE)
///
/// Emits events to the frontend:
///   - "stream-token" (String)  — each text delta
///   - "stream-done"  ()        — generation complete
///   - "stream-error" (String)  — error occurred
#[tauri::command]
pub async fn stream_command(
    app: AppHandle,
    query: String,
    context: TerminalContext,
    model: Option<String>,
    mode: Option<String>,
) -> Result<(), String> {
    // Reset state
    {
        let state = app.state::<Mutex<AppState>>();
        let mut s = state.lock().map_err(|e| e.to_string())?;
        s.is_streaming = true;
        s.cancel_requested = false;
    }

    // Get API key
    let api_key = super::keychain::get_api_key_internal()
        .map_err(|e| format!("No API key: {}", e))?;

    let model_id = model.unwrap_or_else(|| "claude-sonnet-4-5-20250929".into());

    // Parse generation mode
    let gen_mode = match mode.as_deref() {
        Some("learn") => GenMode::Learn,
        Some("workflow") => GenMode::Workflow,
        _ => GenMode::Quick,
    };

    let system_prompt = build_system_prompt(&context, &gen_mode);

    // Build request
    let mut headers = HeaderMap::new();
    headers.insert(CONTENT_TYPE, HeaderValue::from_static("application/json"));
    headers.insert(
        "x-api-key",
        HeaderValue::from_str(&api_key).map_err(|e| e.to_string())?,
    );
    headers.insert(
        "anthropic-version",
        HeaderValue::from_static("2023-06-01"),
    );

    let body = json!({
        "model": model_id,
        "max_tokens": 1024,
        "stream": true,
        "system": system_prompt,
        "messages": [{ "role": "user", "content": query }]
    });

    let client = reqwest::Client::new();
    let response = client
        .post("https://api.anthropic.com/v1/messages")
        .headers(headers)
        .json(&body)
        .send()
        .await
        .map_err(|e| {
            let msg = format!("Request failed: {}", e);
            let _ = app.emit("stream-error", msg.clone());
            msg
        })?;

    if !response.status().is_success() {
        let status = response.status();
        let body_text = response.text().await.unwrap_or_default();
        let msg = format!("API {} — {}", status, body_text);
        let _ = app.emit("stream-error", msg.clone());
        return Err(msg);
    }

    // Parse SSE stream
    let mut byte_stream = response.bytes_stream();
    let mut buffer = String::new();

    while let Some(chunk) = byte_stream.next().await {
        // Check cancel
        {
            let state = app.state::<Mutex<AppState>>();
            if let Ok(s) = state.lock() {
                if s.cancel_requested {
                    let _ = app.emit("stream-done", ());
                    break;
                }
            }
        }

        let chunk = chunk.map_err(|e| e.to_string())?;
        buffer.push_str(&String::from_utf8_lossy(&chunk));

        // Process complete SSE events (terminated by \n\n)
        while let Some(pos) = buffer.find("\n\n") {
            let event_block = buffer[..pos].to_string();
            buffer = buffer[pos + 2..].to_string();

            for line in event_block.lines() {
                if let Some(data) = line.strip_prefix("data: ") {
                    if data == "[DONE]" {
                        let _ = app.emit("stream-done", ());
                        continue;
                    }

                    if let Ok(json) = serde_json::from_str::<serde_json::Value>(data) {
                        let event_type = json.get("type").and_then(|t| t.as_str());

                        match event_type {
                            Some("content_block_delta") => {
                                if let Some(text) = json
                                    .get("delta")
                                    .and_then(|d| d.get("text"))
                                    .and_then(|t| t.as_str())
                                {
                                    let _ = app.emit("stream-token", text.to_string());
                                }
                            }
                            Some("message_stop") => {
                                let _ = app.emit("stream-done", ());
                            }
                            Some("error") => {
                                let msg = json
                                    .get("error")
                                    .and_then(|e| e.get("message"))
                                    .and_then(|m| m.as_str())
                                    .unwrap_or("Unknown API error");
                                let _ = app.emit("stream-error", msg.to_string());
                            }
                            _ => {}
                        }
                    }
                }
            }
        }
    }

    // Cleanup
    {
        let state = app.state::<Mutex<AppState>>();
        if let Ok(mut s) = state.lock() {
            s.is_streaming = false;
        }
    }

    Ok(())
}

/// Cancel the active stream
#[tauri::command]
pub async fn cancel_stream(app: AppHandle) -> Result<(), String> {
    let state = app.state::<Mutex<AppState>>();
    let mut s = state.lock().map_err(|e| e.to_string())?;
    s.cancel_requested = true;
    s.is_streaming = false;
    Ok(())
}

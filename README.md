# 🧞 ShellGenie

**AI-powered terminal commands, one keystroke away.**

Press `⌘K` from anywhere on your Mac. Type what you want in plain English. Get the exact command. That's it.

---

## The Problem

You know *what* you want your terminal to do — but not the exact flags, pipes, or syntax. So you context-switch to a browser, scan Stack Overflow, copy a command you half-trust, and paste it back. Your flow is gone.

## The Solution

ShellGenie is a native macOS overlay. Press ⌘K, type plain English, and get a working terminal command — streamed in real-time by Claude. It reads your terminal context (directory, shell, recent output) via the Accessibility API. No plugins. No rc files. No browser.

And when the generated command would `rm -rf` your home directory or `DROP` your production database, ShellGenie tells you before you run it.

## Features

| Feature | Description |
|---------|-------------|
| **System-Wide Overlay** | Floating window triggered by ⌘K from any application |
| **Natural Language → Commands** | Describe what you want, Claude streams back a working command |
| **Terminal Context Awareness** | Reads CWD, shell type, and recent output via macOS Accessibility API |
| **Multi-Terminal Support** | Terminal.app, iTerm2, Alacritty, kitty, WezTerm, VS Code, Cursor |
| **Destructive Command Safety** | 50+ regex patterns with severity levels (critical/warning/info) |
| **Secure API Key Storage** | Anthropic key lives in macOS Keychain — never in plaintext |
| **Secret Scrubbing** | API keys, tokens, passwords stripped from context before sending to Claude |
| **API Key Validation** | Validates key against Claude API during onboarding |
| **Smart Onboarding** | 3-step wizard: Accessibility → API Key → Ready |
| **Auto-Paste** | Paste commands directly into Terminal.app or iTerm2 via AppleScript |
| **Lightweight** | Tauri 2 + Rust. No Electron. No Chromium. Under 10MB. |

## How It Works

1. **Press ⌘K** from any application
2. **Type your intent** — "find all PDFs modified this week" or "kill port 3000"
3. **Context is gathered** — CWD, shell, recent output read via Accessibility API
4. **Claude generates the command** — streamed token-by-token with syntax highlighting
5. **Safety check runs** — destructive patterns trigger a severity-colored warning
6. **Copy or auto-paste** — click to copy, or paste directly into your terminal

## Tech Stack

**Backend (Rust)**
- Tauri 2 — native app framework
- Tokio + reqwest — async HTTP with SSE streaming
- security-framework — macOS Keychain integration
- regex — destructive command pattern matching

**Frontend (React 19 + TypeScript)**
- Zustand — state management
- Tailwind CSS — styling
- Tauri IPC — Rust ↔ React bridge

**AI**
- Claude API (Anthropic) with SSE streaming
- Models: Sonnet 4.5 (default), Haiku 4.5 (fast), Opus 4.6 (powerful)

## Quick Start

### Prerequisites
- macOS 13+ (Ventura or later)
- Rust (latest stable)
- Node.js 18+
- pnpm
- Anthropic API key

### Install & Run

```bash
git clone https://github.com/YOUR_USERNAME/shellgenie.git
cd shellgenie
pnpm install
pnpm tauri dev
```

### Build for Production

```bash
pnpm tauri build
```

Output: `src-tauri/target/release/bundle/dmg/ShellGenie.dmg`

## Project Structure

```
shellgenie/
├── src/                           # React frontend
│   ├── main.tsx                   # Entrypoint
│   ├── App.tsx                    # Init, onboarding gate, event listeners
│   ├── store/index.ts             # Zustand state
│   ├── index.css                  # Tailwind + genie theme
│   └── components/
│       ├── Overlay.tsx            # Main command bar
│       ├── CommandInput.tsx       # Auto-growing textarea
│       ├── ResultsArea.tsx        # Streaming display + syntax highlighting
│       ├── ContextPill.tsx        # CWD/shell indicator
│       ├── DestructiveBadge.tsx   # Severity-colored warning badge
│       ├── Onboarding.tsx         # 3-step setup wizard
│       └── Settings.tsx           # Tabbed preferences panel
│
├── src-tauri/                     # Rust backend
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   └── src/
│       ├── main.rs                # Binary entrypoint
│       ├── lib.rs                 # App init, tray, plugins, hotkey
│       ├── state.rs               # AppState
│       └── commands/
│           ├── ai.rs              # Claude SSE streaming
│           ├── safety.rs          # 50+ destructive patterns
│           ├── terminal.rs        # Context detection (AX API + lsof)
│           ├── keychain.rs        # macOS Keychain + API validation
│           ├── hotkey.rs          # Global shortcut registration
│           ├── window.rs          # Overlay show/hide/toggle
│           ├── paste.rs           # AppleScript paste + clipboard
│           └── permissions.rs     # Accessibility check + settings
│
├── package.json
├── vite.config.ts
├── tailwind.config.js
└── README.md
```

## Configuration

| Setting | Storage | Description |
|---------|---------|-------------|
| API Key | macOS Keychain | Never plaintext. Never leaves Rust backend. |
| Model | Settings panel | Sonnet 4.5 / Haiku 4.5 / Opus 4.6 |
| Hotkey | Settings panel | Default ⌘K. Also supports ⌘⇧K, ⌘Space, ⌘J |
| Safety | Settings panel | Toggle destructive pattern scanning |
| Auto-Paste | Settings panel | Paste directly into Terminal.app / iTerm2 |

## Safety Patterns

ShellGenie includes **50+ regex patterns** across three severity levels:

- 🔴 **Critical** — `rm -rf /`, `DROP TABLE`, `dd if=... of=/dev/`, `git push --force`, fork bombs
- 🟡 **Warning** — `sudo rm`, `kill -9`, `curl | bash`, `terraform destroy`, `kubectl delete`
- 🔵 **Info** — `chmod`, `chown`, `git branch -D`, `brew uninstall`

## License

MIT

---

*Built by Srija 

*If ShellGenie saved you a trip to Stack Overflow, consider giving it a ⭐*

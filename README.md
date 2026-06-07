# JSONL Smart Viewer

> High-performance, privacy-first JSONL file viewer — 100% browser-side, no server uploads.

**[🌐 Live Demo](https://0x01lab.github.io/jsonl-smart-viewer/)**

A blazing-fast JSONL (JSON Lines) file viewer that handles GB-scale files with smooth 60fps virtualized scrolling. Powered by **Rust WASM** for parsing and the **TanStack** ecosystem for the UI.

![License](https://img.shields.io/github/license/0x01lab/jsonl-smart-viewer)
![GitHub Pages](https://img.shields.io/badge/hosted-GitHub%20Pages-blue)

---

## ✨ Features

- **🔒 Privacy-first** — Files never leave your browser. Zero server uploads.
- **⚡ GB-scale files** — Rust WASM + Web Workers for on-demand parsing of massive files.
- **🎯 Virtual scrolling** — Only 30–50 DOM rows rendered at once via TanStack Virtual.
- **🔗 Shareable URLs** — All table state (page, sort, filters, columns) lives in the URL.
- **📊 Dynamic schema** — Auto-extracts columns from the union of all JSON keys across the file.
- **🛡️ Fault-tolerant** — Invalid JSON rows are highlighted in red, never crashes.
- **🌙 Dark / Light theme** — System-aware theme with manual toggle.
- **🔍 Detail drawer** — JSON tree view with syntax coloring and copy/format buttons.
- **📐 IDE-style layout** — Collapsible schema panel, virtualized data grid, slide-in detail drawer.

## 🏗️ Architecture

```
Browser main thread                    Web Worker (background)
┌─────────────────────┐               ┌─────────────────────┐
│ TanStack Router      │               │ Rust WASM            │
│ (URL state sync)     │               │ - Newline scanner    │
│         │            │   postMessage  │ - Byte offset index  │
│ TanStack Query       │ ◄──────────►  │ - Schema extraction  │
│ (data cache/prefetch)│  ArrayBuffer  │ - On-demand parsing  │
│         │            │               └─────────────────────┘
│ TanStack Table+Virtual│
│ (render visible rows) │
└─────────────────────┘
```

**Memory target:** ≤150 MB peak regardless of file size.
**First-screen target:** ≤300 ms to show row count + headers after dropping a 1 GB file.

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Framework | [TanStack Start](https://tanstack.com/start) (React 19) |
| UI Components | [shadcn/ui](https://ui.shadcn.com) — Nova compact style |
| Table | [TanStack Table](https://tanstack.com/table) v8 |
| Virtualization | [TanStack Virtual](https://tanstack.com/virtual) v3 |
| Data Caching | [TanStack Query](https://tanstack.com/query) |
| Routing | [TanStack Router](https://tanstack.com/router) + Zod |
| Backend / Parsing | Rust → WASM (`wasm-pack`), running in Web Workers |
| Styling | [Tailwind CSS](https://tailwindcss.com) v4 |
| Icons | [Lucide](https://lucide.dev) |
| Fonts | JetBrains Mono (data) · Inter (UI) |
| Build | [Vite](https://vite.dev) |
| Deployment | Static site (SSG) — single HTML/JS/CSS/WASM bundle |

## 🚀 Getting Started

### Prerequisites

- **Node.js** ≥ 20
- **pnpm** ≥ 9 ([install](https://pnpm.io/installation))
- **Rust** ([install](https://rustup.rs))
- **wasm-pack** ([install](https://rustwasm.github.io/wasm-pack/installer/))

### Install & Run

```bash
# Clone the repository
git clone https://github.com/0x01lab/jsonl-smart-viewer.git
cd jsonl-smart-viewer

# Install dependencies
pnpm install

# Build the Rust WASM module
pnpm build:wasm

# Start the dev server
pnpm dev
```

Open your browser and drop a `.jsonl` file to start exploring.

### Build for Production

```bash
pnpm build:wasm
pnpm build
```

Static output is generated in `app/dist/`.

## 📂 Project Structure

```
josnl-viewer/
├── app/                    # Frontend (React + Vite)
│   ├── src/
│   │   ├── components/     # UI components (shadcn/ui)
│   │   ├── routes/         # TanStack Router pages
│   │   ├── wasm/           # Generated WASM bindings
│   │   └── ...
│   └── package.json
├── crates/
│   └── jsonl-wasm/         # Rust → WASM parser
│       ├── src/
│       └── Cargo.toml
├── docs/
│   ├── PRD.md              # Product requirements
│   └── UI_UX_SPEC.md       # UI/UX specification
├── package.json            # Monorepo root (pnpm workspace)
└── CLAUDE.md               # AI development guide
```

## 🎮 Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Cmd/Ctrl + F` | Global search |
| `Cmd/Ctrl + K` | Command palette |
| `↑` / `↓` | Navigate rows |
| `Enter` | Open detail drawer |
| `Esc` | Close detail drawer |

## 📄 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.

---

<p align="center">
  Built with ❤️ by <a href="https://github.com/0x01lab">0x01lab</a>
</p>

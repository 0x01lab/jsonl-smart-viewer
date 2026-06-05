# Phase 2 设计规范：TanStack Start 前端脚手架 + Worker 桥接

> **状态：** 已批准
> **日期：** 2026-06-05
> **范围：** 最小可用前端 — 能拖入文件并显示表格数据

---

## 1. 目标

在 Phase 1（Rust 核心解析器 + WASM 绑定）的基础上，搭建前端应用脚手架，实现：

1. 用户拖入 JSONL 文件
2. Web Worker 内 WASM 引擎扫描并解析文件
3. 浏览器内显示动态列头 + 分页数据表格

**不做的事：** 虚拟滚动、URL 状态同步、Schema 面板、Detail Drawer、全局搜索、主题切换 UI、排序、过滤、列隐藏、键盘快捷键。这些留给 Phase 3。

---

## 2. 项目结构

```
josnl-viewer/
├── Cargo.toml                      # Rust workspace（已有）
├── package.json                     # pnpm workspace root（新增）
├── pnpm-workspace.yaml              #（新增）
├── crates/
│   ├── jsonl-core/                  # 已有，不改
│   └── jsonl-wasm/                  # 已有，需确认 crate-type
├── app/                             # TanStack Start 前端（新增）
│   ├── package.json
│   ├── app.config.ts                # TanStack Start 配置
│   ├── components.json              # shadcn/ui 配置
│   ├── tsconfig.json
│   ├── vite.config.ts               # Vite + WASM 配置
│   ├── postcss.config.js
│   ├── public/
│   │   └── wasm/                    # wasm-pack 输出（gitignored）
│   ├── app/
│   │   ├── routes/
│   │   │   └── index.tsx            # 单页：拖放 → 表格
│   │   ├── components/
│   │   │   ├── FileDropZone.tsx     # 文件拖放/选择
│   │   │   └── DataTable.tsx        # 基础数据表格
│   │   ├── worker/
│   │   │   ├── jsonl.worker.ts      # Worker 入口
│   │   │   └── useJsonlWorker.ts    # Comlink React hook
│   │   ├── lib/
│   │   │   └── utils.ts             # shadcn cn() 工具
│   │   ├── components/
│   │   │   └── ui/                  # shadcn 组件（自动生成）
│   │   ├── client.tsx               # TanStack Start 入口
│   │   ├── router.tsx               # Router 定义
│   │   ├── routeTree.gen.ts         # 自动生成
│   │   └── index.css                # Tailwind + OKLCH Token
│   └── vite.env.d.ts
└── .gitignore
```

---

## 3. 技术选型

| 类别 | 选择 | 说明 |
|------|------|------|
| 框架 | TanStack Start (React 19) | SSG 支持，基于 Vite |
| UI 组件库 | shadcn/ui Nova 紧凑风格 | 基于 Radix UI + Tailwind v4 |
| 样式 | Tailwind CSS v4 + OKLCH | shadcn create 自动配置 |
| 图标 | Lucide Icons | shadcn 默认集成 |
| 字体 | JetBrains Mono + Inter | 数据区等宽，UI 区无衬线 |
| 表格 | TanStack Table v8 | 动态列模型 + 分页 |
| Worker 通信 | Comlink ~1.5KB | 类型安全的 Worker 代理 |
| WASM 构建 | wasm-pack --target web | 胶水代码 + TypeScript 类型 |
| 包管理 | pnpm | workspace 管理 Rust + 前端 |
| 类型校验 | Zod | 预留，Phase 2 最小使用 |
| 测试 | Vitest + Testing Library | 关键路径测试 |

---

## 4. 项目初始化步骤

### 4.1 根目录 pnpm workspace

```jsonc
// package.json（根目录）
{
  "name": "josnl-viewer",
  "private": true,
  "scripts": {
    "dev": "pnpm --filter app dev",
    "build": "pnpm --filter app build",
    "build:wasm": "cd crates/jsonl-wasm && wasm-pack build --target web --out-dir ../../app/public/wasm",
    "lint": "pnpm --filter app lint",
    "test": "pnpm --filter app test"
  }
}
```

```yaml
# pnpm-workspace.yaml
packages:
  - "app"
```

### 4.2 shadcn 初始化

```bash
cd app
npx shadcn create
# → 框架: TanStack Start
# → 风格: Nova (compact)
# → 基色: Neutral
# → 圆角: 0.625rem
# → 图标: Lucide
```

```jsonc
// app/components.json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "base-nova",
  "tailwind": {
    "config": "tailwind.config.ts",
    "css": "app/index.css",
    "baseColor": "neutral",
    "cssVariables": true
  },
  "aliases": {
    "components": "~/components",
    "utils": "~/lib/utils",
    "ui": "~/components/ui",
    "hooks": "~/hooks"
  }
}
```

### 4.3 安装 shadcn 组件

```bash
npx shadcn add button card input table badge progress skeleton sonner tooltip
```

### 4.4 安装其他依赖

```bash
pnpm add @tanstack/react-table comlink
pnpm add -D @types/react @types/react-dom
```

---

## 5. OKLCH 色彩 Token

### 5.1 Nova 基础 Token

由 `shadcn create` 自动生成，包含 `--background`, `--foreground`, `--primary`, `--border` 等标准 Token。暗色主题通过 `.dark` class 切换。

### 5.2 JSONL Viewer 扩展 Token

手动添加到 `app/index.css`，Phase 2 即配好：

```css
:root {
  /* 表格行 */
  --table-row-even: oklch(1 0 0);
  --table-row-odd: oklch(0.98 0 0);
  --table-row-hover: oklch(0.96 0.01 270);
  --table-row-selected: oklch(0.94 0.02 270);
  --table-row-error: oklch(0.97 0.02 25);
  --table-header-bg: oklch(0.97 0 0);
  --table-grid-line: oklch(0.922 0 0);
  --table-selected-indicator: oklch(0.45 0.18 270);

  /* 语义色 */
  --color-success: oklch(0.65 0.2 160);
  --color-warning: oklch(0.75 0.18 85);
  --color-error: oklch(0.577 0.245 27.325);
  --color-info: oklch(0.55 0.2 260);

  /* JSON 语法高亮 */
  --json-key: oklch(0.55 0.2 260);
  --json-string: oklch(0.55 0.16 150);
  --json-number: oklch(0.65 0.18 65);
  --json-boolean: oklch(0.55 0.2 310);
  --json-null: oklch(0.556 0 0);

  /* 空值 */
  --null-text: oklch(0.65 0 0);
}

.dark {
  --table-row-even: oklch(0.145 0 0);
  --table-row-odd: oklch(0.178 0 0);
  --table-row-hover: oklch(0.22 0.02 270);
  --table-row-selected: oklch(0.28 0.05 270);
  --table-row-error: oklch(0.18 0.03 25);
  --table-header-bg: oklch(0.178 0 0);
  --table-grid-line: oklch(0.269 0 0);
  --table-selected-indicator: oklch(0.55 0.2 270);
}
```

---

## 6. Worker 通信层

### 6.1 架构

```
React 组件 → Comlink proxy → postMessage → Web Worker → WASM JsonlEngine
```

### 6.2 Worker 入口 (`app/worker/jsonl.worker.ts`)

```typescript
import * as Comlink from 'comlink'

// 动态导入 wasm-pack 输出的胶水代码
const wasm = await import('/wasm/jsonl_wasm.js')
await wasm.default()

const engine = new wasm.JsonlEngine()

let fileRef: File | null = null

const api = {
  async initFile(file: File): Promise<{ totalRows: number; schema: SchemaDef }> {
    fileRef = file
    engine.set_total_size(file.size)
    const CHUNK_SIZE = 1024 * 1024 // 1MB
    let offset = 0
    while (offset < file.size) {
      const chunk = file.slice(offset, offset + CHUNK_SIZE)
      const buffer = await chunk.arrayBuffer()
      engine.feed_chunk(new Uint8Array(buffer))
      offset += CHUNK_SIZE
    }
    const result = engine.finalize_scan()
    return { totalRows: result.total_rows, schema: result.schema }
  },

  async getRows(start: number, end: number): Promise<FlatRow[]> {
    if (!engine) throw new Error('Engine not initialized')
    return engine.get_rows(start, end)
  }
}

Comlink.expose(api)
```

### 6.3 React Hook (`app/worker/useJsonlWorker.ts`)

```typescript
import { wrap, Remote } from 'comlink'
import { useState, useRef, useCallback } from 'react'

interface SchemaDef { columns: ColumnDef[] }
interface ColumnDef { name: string; types: string[]; nullable: boolean }
interface FlatRow { index: number; data: Record<string, unknown>; error?: string }

type WorkerApi = {
  initFile(f: File): Promise<{ totalRows: number; schema: SchemaDef }>
  getRows(start: number, end: number): Promise<FlatRow[]>
}

export function useJsonlWorker() {
  const workerRef = useRef<Worker | null>(null)
  const apiRef = useRef<Remote<WorkerApi> | null>(null)
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [fileInfo, setFileInfo] = useState<{ totalRows: number; schema: SchemaDef } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const loadFile = useCallback(async (file: File) => {
    setStatus('loading')
    setError(null)
    if (!workerRef.current) {
      const worker = new Worker(new URL('./jsonl.worker.ts', import.meta.url), { type: 'module' })
      workerRef.current = worker
      apiRef.current = wrap<WorkerApi>(worker)
    }
    try {
      const info = await apiRef.current!.initFile(file)
      setFileInfo(info)
      setStatus('ready')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
      setStatus('error')
    }
  }, [])

  const getRows = useCallback(async (start: number, end: number) => {
    if (!apiRef.current) throw new Error('Worker not initialized')
    return apiRef.current.getRows(start, end)
  }, [])

  const reset = useCallback(() => {
    workerRef.current?.terminate()
    workerRef.current = null
    apiRef.current = null
    setStatus('idle')
    setFileInfo(null)
    setError(null)
  }, [])

  return { status, fileInfo, error, loadFile, getRows, reset }
}
```

### 6.4 数据流

```
用户拖入文件
    ↓
FileDropZone 触发 onFile(file)
    ↓
useJsonlWorker.loadFile(file)
    ↓ Comlink proxy
Worker: 分块读取 (1MB) → WASM scan → 返回 { totalRows, schema }
    ↓
React state: status='ready', fileInfo={ totalRows, schema }
    ↓
DataTable 渲染表头 (schema.columns → ColumnDef[])
    ↓
初次请求 getRows(0, pageSize)
    ↓ Comlink proxy
Worker: WASM get_rows(0, pageSize) → FlatRow[]（Worker 内持有 fileRef）
    ↓
DataTable 渲染行数据
```

---

## 7. UI 组件

### 7.1 页面状态机

单页面 `routes/index.tsx`，两种状态：

- `idle | loading | error` → 全屏居中的 FileDropZone
- `ready` → 全屏 DataTable

### 7.2 FileDropZone

对齐 UI_UX_SPEC §8.1，使用 shadcn `Card` + `Button`：

- 居中拖放区域，`border-dashed` 虚线边框
- 拖入时边框变 `--primary` 实线 + `--accent` 背景
- 「选择文件」按钮 shadcn `Button variant="default" h-9`
- loading 时显示 shadcn `Progress` + 扫描进度文字
- error 时显示 shadcn `Sonner` toast
- 暗色主题默认（在 `<html>` 上添加 `class="dark"`）

### 7.3 DataTable

对齐 UI_UX_SPEC §3 + Nova 紧凑规格：

- **表头** — shadcn `Table` 组件，Inter 13px semibold，sticky
- **行号列** — 固定第一列，52px 宽，12px `--muted-foreground`
- **单元格渲染规则：**

| 类型 | 样式 | 对齐 |
|------|------|------|
| string | 默认文字 | 左对齐 |
| number | 千位分隔符 | 右对齐 |
| boolean | shadcn `Badge` 彩色圆点 | 居中 |
| null | 灰色斜体 `--null-text` | 左对齐 |
| object/array | shadcn `Badge outline` `{N fields}` | 左对齐 |
| error row | `--table-row-error` 背景 + 左侧红色竖线 | — |

- **斑马纹** — 奇偶行 `--table-row-even` / `--table-row-odd`
- **行 hover** — `--table-row-hover`，100ms transition
- **行选中** — `--table-row-selected` + 左侧 3px `--table-selected-indicator` 竖线
- **分页** — Phase 2 用简单上/下页按钮，不用 shadcn `Pagination`（Phase 3 换虚拟滚动）
- **字体** — 数据区 `font-mono text-[13px]`，表头 `font-sans text-[13px] font-semibold`

### 7.4 Status Bar（简化版）

对齐 UI_UX_SPEC §7，Phase 2 简化：

- 高度 28px，固定底部
- 显示：总行数、错误行数、当前页、每页条数、选中行号
- 不用 shadcn 组件，纯 Tailwind 文字 + flex 布局
- Phase 3 升级为完整 shadcn `Pagination` + `Select` + `Tooltip`

### 7.5 轻量 Header Bar（简化版）

对齐 UI_UX_SPEC §4，Phase 2 简化：

- 高度 40px，固定顶部
- 左侧：文件名 + 文件大小（shadcn `Button variant="ghost"`）
- 右侧：行数/列数统计
- Phase 3 加入搜索框、导出菜单、主题切换

---

## 8. 字体配置

```css
/* app/index.css */
@font-face {
  font-family: 'JetBrains Mono';
  src: url('/fonts/JetBrainsMono-Regular.woff2') format('woff2');
  font-weight: 400;
  font-display: swap;
}

@font-face {
  font-family: 'Inter';
  src: url('/fonts/Inter-Regular.woff2') format('woff2');
  font-weight: 400;
  font-display: swap;
}
```

字体文件放入 `app/public/fonts/`。Phase 2 也可先用 Google Fonts CDN，后续优化为本地托管。

---

## 9. Vite 配置

```typescript
// app/vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'

export default defineConfig({
  plugins: [tanstackStart(), react()],
  worker: {
    format: 'es',
  },
  optimizeDeps: {
    exclude: ['/wasm/jsonl_wasm.js'],
  },
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
})
```

---

## 10. 错误处理

| 场景 | 处理方式 |
|------|---------|
| 非 JSONL 文件 | FileDropZone 红色提示 + Sonner toast |
| Worker 初始化失败 | error 状态 + 重试按钮 |
| WASM 加载失败 | 检测 `WebAssembly` 支持，降级提示 |
| 空文件 | 提示 "文件为空，无有效 JSONL 数据" |
| 文件扫描出错 | 显示已扫描部分 + 错误行统计 |
| getRows 失败 | Sonner toast + 自动重试 |

---

## 11. 测试策略

| 层 | 测试内容 | 方式 |
|---|---------|------|
| Worker 通信 | `initFile` 返回正确的 totalRows + schema | Vitest + Worker 环境 |
| Hook | `useJsonlWorker` 状态机 idle → loading → ready | Testing Library |
| FileDropZone | 拖放/点击触发 onFile 回调 | Testing Library |
| DataTable | schema → ColumnDef 映射 + 行渲染 | Testing Library |
| 集成 | 真实 JSONL 文件端到端流程 | 手动测试 |

---

## 12. Phase 3 衔接点

| Phase 2 产出 | Phase 3 扩展 |
|-------------|-------------|
| `useJsonlWorker` hook | 包装为 TanStack Query queryFn |
| 简单分页 | 替换为 TanStack Virtual 虚拟滚动 |
| 基础 DataTable | 加排序、过滤、列隐藏 |
| 单页面 | 拆为 `/` + `/viewer` 路由 + URL 状态 |
| 暗色固定 | 主题切换 light/dark/system |
| 无 Schema 面板 | 左侧 Schema Panel (shadcn Checkbox + Collapsible) |
| 无 Detail Drawer | 右侧 Sheet (shadcn Sheet + JSON tree) |
| 无搜索 | Toolbar + shadcn Command (Cmd+K) |
| 简化 Status Bar | 完整 shadcn Pagination + Select |

设计保证扩展不需要大规模重构：
- `useJsonlWorker` 返回稳定接口，Phase 3 只加包装不改签名
- DataTable columns 从外部传入，方便 Phase 3 控制列可见性
- Worker api 用 Comlink expose，加新方法只需扩展
- OKLCH Token 体系一次性配好，Phase 3 直接使用

---

## 13. 依赖清单

```json
{
  "dependencies": {
    "@tanstack/react-start": "latest",
    "@tanstack/react-router": "latest",
    "@tanstack/react-table": "^8",
    "react": "^19",
    "react-dom": "^19",
    "comlink": "^4",
    "zod": "^3"
  },
  "devDependencies": {
    "tailwindcss": "^4",
    "typescript": "^5.7",
    "vite": "^6",
    "vitest": "^3",
    "@testing-library/react": "^16"
  }
}
```

shadcn 组件通过 `npx shadcn add` 安装，不直接写入 package.json dependencies。

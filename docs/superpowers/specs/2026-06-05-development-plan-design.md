# JSONL Smart Viewer — 开发计划设计文档

> **版本:** v1.0
> **日期:** 2026-06-05
> **状态:** Draft → Pending Review
> **策略:** 自底向上 (Bottom-Up)
> **时间线:** 7 周，质量优先

---

## 1. 项目决策记录

| 决策项 | 选择 | 备注 |
|--------|------|------|
| 开发模式 | 独立开发 | 单人全栈 |
| 时间策略 | 时间充裕，质量优先 | 不赶进度 |
| Rust 经验 | 熟练 | 含 WASM 经验 |
| TanStack 经验 | 熟悉 | 全生态 |
| 测试策略 | 全面覆盖 | Rust 单元 + WASM 集成 + 前端组件 + E2E |
| v1 范围 | 仅本地文件加载 | 远程 URL + 数据导出延后至 v2 |
| v2 范围 | 远程流式加载 + 数据导出 | 后续迭代 |

---

## 2. 仓库结构

```
josnl-viewer/
├── crates/
│   ├── jsonl-core/               # Rust 核心解析库 (纯逻辑, 不依赖 WASM)
│   │   ├── src/
│   │   │   ├── lib.rs
│   │   │   ├── scanner.rs        # 换行符扫描 + 字节偏移索引
│   │   │   ├── schema.rs         # Schema 提取 (增量并集算法)
│   │   │   ├── parser.rs         # 按需 JSON 解析 (file.slice)
│   │   │   └── types.rs          # 公共类型定义
│   │   └── Cargo.toml
│   └── jsonl-wasm/               # WASM 绑定层 (wasm-bindgen 胶水)
│       ├── src/
│       │   └── lib.rs            # 导出 JS 可调用的接口
│       └── Cargo.toml
├── app/                          # TanStack Start 前端
│   ├── src/
│   │   ├── routes/               # 路由 (/, /viewer)
│   │   ├── components/           # UI 组件
│   │   ├── hooks/                # Worker 通信, 数据 hooks
│   │   ├── workers/              # Web Worker 入口
│   │   ├── lib/                  # 工具函数
│   │   └── styles/               # Tailwind + 自定义样式
│   └── package.json
├── tests/                        # E2E 测试 (Playwright)
├── docs/                         # PRD, 设计文档
└── CLAUDE.md
```

---

## 3. 技术选型

| 决策点 | 选择 | 理由 |
|--------|------|------|
| Rust JSON 解析器 | `simd-json` (首选) + `serde_json` (fallback) | simd-json 在 x86 上快 2-3x，WASM 环境自动降级 |
| Rust → JS 通信 | `wasm-bindgen` + 手写 Worker postMessage | 避免 wasm-pack 的黑盒抽象，更可控 |
| 列模型 | TanStack Table v8 `useReactTable` | 动态列、排序、筛选、固定列全内置 |
| 虚拟滚动 | TanStack Virtual v3 `useVirtualizer` | 官方生态集成，支持动态行高 |
| 数据缓存 | TanStack Query v5 `useQuery` | 分页缓存 + GC + 预加载一步到位 |
| 状态同步 | TanStack Router `validateSearch` + Zod | URL 即状态，类型安全 |
| 样式方案 | Tailwind CSS v4 + CSS Variables (主题) | 快速开发 + 主题切换通过 CSS 变量 |
| E2E 测试 | Playwright | 跨浏览器 + 文件拖拽模拟 |
| JSON 解压 | `DecompressionStream` API | 浏览器原生，零依赖 |

---

## 4. Phase 1: Rust 核心解析器 (Week 1-2)

### 4.1 目标

构建纯 Rust、不依赖 WASM 的 `jsonl-core` 库，能独立通过 `cargo test` 验证。再通过 `jsonl-wasm` 薄封装层导出给 JS。

### 4.2 核心数据结构

```rust
// crates/jsonl-core/src/types.rs

/// 行偏移索引 — 扫描阶段的唯一产出
pub struct LineIndex {
    /// (start_byte, length) 对，索引即行号
    offsets: Vec<(u64, u32)>,
    /// 标记哪些行是无效 JSON
    error_lines: HashSet<u32>,
}

/// Schema 描述 — 增量并集算法的产出
pub struct Schema {
    /// 扁平化后的列定义，按首次出现顺序排列
    columns: Vec<ColumnDef>,
    /// 快速查找: "a.b.c" → 列索引
    column_map: HashMap<String, usize>,
}

pub struct ColumnDef {
    pub key: String,              // "address.city"
    pub depth: u8,                // 嵌套深度 (0 = 顶层)
    pub inferred_type: ValueType, // 推断的类型
    pub nullable: bool,           // 是否出现过 null
}

pub enum ValueType {
    String, Number, Boolean, Object, Array, Null, Mixed,
}
```

### 4.3 模块职责

| 模块 | 职责 | 输入 | 输出 |
|------|------|------|------|
| `scanner` | 扫描 `\n`，建立 `LineIndex` | `&[u8]` 原始字节流 | `LineIndex` |
| `schema` | 增量并集提取 JSON Key | 单行 JSON `&str` | 累积更新 `Schema` |
| `parser` | 按需解析指定行 | `LineIndex` + 文件切片 | `Vec<FlatRow>` |
| `types` | 公共类型定义 | — | — |

### 4.4 关键算法

**换行扫描器** — O(n) 单次遍历，流式处理：

```
输入: 字节流 chunks (通过回调喂入)
处理: 逐字节扫描 '\n' (0x0A)，记录每行起始偏移
输出: LineIndex { offsets, error_lines }
特殊处理:
  - 空行跳过 (连续 \n\n)
  - 保留最终不完整行标记 (文件末尾无 \n)
```

**Schema 增量并集** — 每解析一行就更新：

```
输入: 一行 JSON 的 Key 集合 { "id", "name", "address.city", ... }
处理:
  1. 展平嵌套 → dot notation ("a.b.c")
  2. 对比现有 Schema，新增缺失的列
  3. 更新类型推断 (如果某列既有 int 又有 string → 标记为 mixed)
  4. 更新 nullable 标记
输出: 更新后的 Schema
```

**按需解析** — 只解请求的行范围：

```
输入: 请求范围 [start_row, end_row) + LineIndex + 原始文件引用
处理:
  1. 从 LineIndex 查找对应字节范围
  2. slice 文件获取原始字节
  3. 逐行 JSON 解析 + 扁平化
  4. 失败的行标记为 ErrorRow，保留原始文本
输出: Vec<FlatRow> + 错误信息
```

### 4.5 WASM 绑定层

```rust
// crates/jsonl-wasm/src/lib.rs
#[wasm_bindgen]
pub struct JsonlEngine { /* 内部状态 */ }

#[wasm_bindgen]
impl JsonlEngine {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self;

    /// 设置文件总大小 (用于进度计算)
    pub fn set_total_size(&mut self, size: u64);

    /// 流式喂入数据块，返回当前扫描进度 (0.0 ~ 1.0)
    /// 进度 = bytes_fed / total_size
    pub fn feed_chunk(&mut self, chunk: &[u8]) -> f64;

    /// 扫描完成，获取 Schema 和总行数
    pub fn finalize_scan(&mut self) -> JsValue;

    /// 按需获取指定范围的行数据
    pub fn get_rows(&self, start: u32, end: u32) -> JsValue;
}
```

### 4.6 测试

| 测试类型 | 工具 | 覆盖范围 |
|----------|------|----------|
| 单元测试 | `#[test]` + `cargo test` | scanner, schema, parser 每个公共函数 |
| 集成测试 | `tests/` 目录 | 端到端：喂入 JSONL → 拿到 FlatRow |
| 性能基准 | `criterion` | 1MB/100MB/1GB 文件的扫描/解析耗时 |
| WASM 测试 | `wasm-pack test --node` | 验证 JS 绑定层数据序列化正确 |

**测试数据集：**
- `tests/fixtures/simple.jsonl` — 10 行，所有列一致
- `tests/fixtures/heterogeneous.jsonl` — 100 行，字段不一致，嵌套深
- `tests/fixtures/with_errors.jsonl` — 混入 5% 非法 JSON
- `tests/fixtures/large.jsonl` — 用脚本生成 100 万行（压测用）

### 4.7 时间线

| 天数 | 任务 |
|------|------|
| Day 1-3 | types + scanner (换行扫描 + 行索引) |
| Day 4-5 | schema (增量并集算法 + 类型推断) |
| Day 6-8 | parser (按需解析 + 扁平化 + 错误行处理) |
| Day 9-10 | jsonl-wasm 绑定层 + WASM 编译通过 |
| 持续 | cargo test + criterion 基准 |

---

## 5. Phase 2: TanStack Start 骨架 + Worker 桥梁 (Week 3)

### 5.1 目标

搭建前端工程骨架，建立主线程 ↔ Web Worker ↔ Rust WASM 的完整通信链路。到本周末，能拖入一个小文件并在页面上看到解析结果。

### 5.2 路由设计

```
路由结构:
  /         → Landing Page (空状态引导页，拖拽上传)
  /viewer   → Viewer Page (数据表格主界面)

URL 状态模型 (Zod schema):
  /viewer?page=1&size=100&sort=name:asc&hiddenColumns=email,phone&selectedRow=42
```

```typescript
const viewerSearchSchema = z.object({
  page: z.number().int().positive().default(1).catch(1),
  size: z.union([
    z.literal(50), z.literal(100), z.literal(200),
    z.literal(500), z.literal(1000)
  ]).default(100),
  sort: z.string().optional(),          // "colName:asc" | "colName:desc"
  hiddenColumns: z.string().optional(), // 逗号分隔
  selectedRow: z.number().int().optional(),
  search: z.string().optional(),
  filters: z.string().optional(),       // JSON 编码的筛选条件
})
```

### 5.3 Worker 通信协议

```typescript
// ─── 主线程 → Worker ───
type WorkerRequest =
  | { type: 'INIT'; fileSize: number }       // 通知 Worker 文件总大小 (用于进度计算)
  | { type: 'LOAD_FILE'; file: File }        // 传入 File 引用, Worker 内部自行 stream 分块
  | { type: 'GET_ROWS'; start: number; end: number }
  | { type: 'SEARCH'; query: string }
  | { type: 'DESTROY' }

// ─── Worker → 主线程 ───
type WorkerResponse =
  | { type: 'SCAN_PROGRESS'; progress: number; rowsScanned: number }
  | { type: 'SCAN_COMPLETE'; schema: SchemaDef; totalRows: number; errorRows: number }
  | { type: 'ROWS_DATA'; rows: FlatRow[]; start: number; end: number }
  | { type: 'SEARCH_RESULT'; matchingIndices: number[] }
  | { type: 'ERROR'; message: string }

// ─── 共享类型定义 ───
interface SchemaDef {
  columns: ColumnDefDTO[]
  totalRows: number
  errorRows: number
}

interface ColumnDefDTO {
  key: string              // "address.city"
  depth: number            // 嵌套深度 (0 = 顶层)
  inferredType: ValueType  // 'string' | 'number' | 'boolean' | 'object' | 'array' | 'null' | 'mixed'
  nullable: boolean
}

// FlatRow: 扁平化后的行数据, key 为 dot-notation 列名
type FlatRow = Record<string, unknown> & {
  _index: number        // 原始行号 (0-based)
  _error?: string       // 仅错误行有值, 存原始文本
}
```

**Worker 内部流程：**

1. 主线程先发 `INIT { fileSize }`，Worker 记录总大小用于进度计算
2. 主线程发 `LOAD_FILE { file }`，Worker 内部用 `file.stream().getReader()` 逐块读取（每块 1MB），喂给 Rust `feed_chunk(chunk, bytesRead, totalSize)` 计算进度
3. `GET_ROWS`: Worker 用 `file.slice(startByte, endByte)` 只取需要的字节，传给 Rust 解析
4. `SEARCH`: Rust 遍历已索引行，返回匹配行号

### 5.4 React Hooks 封装

| Hook | 职责 |
|------|------|
| `useJsonlWorker` | 管理 Worker 生命周期，提供 loadFile/getRows/search 方法 |
| `useFileLoader` | 拖拽/选择文件，类型校验，触发加载 |
| `useVirtualRows` | TanStack Query 缓存 + 预加载 + GC 管理 |

### 5.5 测试

| 测试类型 | 工具 | 覆盖范围 |
|----------|------|----------|
| Worker 协议测试 | Vitest + 手动 mock | 消息格式序列化/反序列化 |
| 路由测试 | TanStack Router 测试工具 | URL 参数解析、非法值自动纠错 |
| Hooks 测试 | `@testing-library/react` + Vitest | useJsonlWorker 状态流转 |
| 集成测试 | Playwright | 拖入文件 → 看到 Schema + 行数据 |

### 5.6 时间线

| 天数 | 任务 |
|------|------|
| Day 1-2 | 工程初始化 + 路由 + Zod 状态 |
| Day 3-4 | Worker 通信协议 + Worker 入口 |
| Day 5 | Hooks 封装 (useJsonlWorker, useFileLoader) |
| Day 6-7 | 最小 UI (拖入文件 → 看到原始 JSON 行列表) |

---

## 6. Phase 3: 表格虚拟化与数据缓存集成 (Week 4-5)

### 6.1 目标

将 TanStack Table + Virtual + Query 三件套完整集成，实现 GB 级文件的 60fps 丝滑滚动体验。

### 6.2 数据流

```
URL State (TanStack Router)
    │ page, size, sort, filters, hiddenColumns
    ▼
TanStack Query — useQuery({
    queryKey: ['rows', page, size, sort, filters],
    queryFn: () => worker.getRows(page * size, (page+1) * size),
    staleTime: Infinity,
    gcTime: 5 * 60 * 1000,
    placeholderData: keepPreviousData,
})
    │ { data: FlatRow[], schema }
    ▼
TanStack Table — useReactTable({
    columns: schema → 动态生成 columnDefs,
    data: query.data,
    state: { sorting, columnVisibility, columnFilters },
    onStateChange: → 同步到 URL
})
    │ table model
    ▼
TanStack Virtual — useVirtualizer({
    count: totalRows,
    getScrollElement: () => scrollRef,
    estimateSize: () => 32,
    overscan: 5,
})
    │ virtualItems: 仅可见行的索引
    ▼
DOM — 渲染 virtualItems 中的 ~40 行
```

### 6.3 动态列模型

Schema 来自 Rust 解析器，列模型动态生成：

- 行号列 `_rowNumber`: 固定左侧，60px，不可隐藏/排序/调整宽度
- 数据列: 从 Schema 动态生成，含类型感知渲染和类型特定排序函数
- 错误标记列 `_error`: 仅在存在 error 行时添加

### 6.4 类型感知单元格渲染

| 数据类型 | 渲染样式 |
|----------|---------|
| `string` (短) | 默认文字，左对齐 |
| `string` (长) | 单行截断 + 省略号，Hover 显示完整 Tooltip |
| `number` | 右对齐，千位分隔符 |
| `boolean` | 居中 Tag 徽标: `● true` 绿色 / `○ false` 灰色 |
| `null` / `undefined` | 灰色斜体 "null" |
| `object` / `array` | `{3 fields}` / `[5 items]` 折叠徽标 |
| URL 字符串 | 蓝色可点击链接 |
| Error Row | 整行红色背景 + 左侧红色竖线 + `⚠ JSON 格式损坏` |

### 6.5 虚拟滚动

- 使用 `absolute + translateY` 定位 (非 `relative + marginTop`)
- 默认行高 32px，支持动态测量 (error 行可能更高)
- overscan: 上下各 5 行
- 恒定 30-50 个 DOM 节点，无论数据量

### 6.6 缓存策略

| 参数 | 值 | 理由 |
|------|-----|------|
| `staleTime` | `Infinity` | 行数据不变质，永远新鲜 |
| `gcTime` | 5 分钟 | 滚动过的页面 5 分钟后自动回收 |
| `placeholderData` | `keepPreviousData` | 翻页时保留旧数据直到新数据到达 |
| 预加载 | N+1, N+2 页 | 确保向下滚动零延迟 |

内存估算: 每页 100 行 × ~1KB ≈ 100KB/页，缓存窗口 3 页 ≈ 300KB，峰值 5-10MB。

### 6.7 列交互

| 功能 | 实现方式 |
|------|----------|
| 列排序 | `table.getSortedRowModel()` — 三态: ASC → DESC → 无 |
| 列隐藏 | `columnVisibility` state → URL |
| 列宽拖拽 | `columnResize` mode: `onChange` |
| 列固定 | `columnPinning` state |
| 列重排 | `columnOrder` state + drag |
| 列筛选 | `columnFilters` state → URL |

### 6.8 测试

| 测试类型 | 工具 | 覆盖范围 |
|----------|------|----------|
| 列模型测试 | Vitest | 动态列生成、排序函数、类型推断 |
| 单元格渲染测试 | `@testing-library/react` | 每种数据类型的渲染快照 |
| 虚拟滚动测试 | Vitest + mock Virtualizer | overscan 计算、行高度测量 |
| 缓存策略测试 | Vitest + QueryClient mock | 预加载触发、GC 淘汰、翻页行为 |
| 性能基准 | Playwright + `performance.now()` | 1GB 文件滚动 FPS ≥ 55 |
| 内存快照 | Chrome DevTools Protocol | 峰值 ≤ 150MB |

### 6.9 时间线

| 天数 | 任务 |
|------|------|
| Day 1-3 | TanStack Table 集成 + 动态列模型 |
| Day 4-5 | TypeAwareCell 全类型渲染 |
| Day 6-8 | TanStack Virtual 虚拟滚动 |
| Day 9-10 | TanStack Query 缓存 + 预加载 |
| 持续 | 性能测试 + 内存监控 |

---

## 7. Phase 4: UI 细化与发布验收 (Week 6-7)

### 7.1 目标

完善所有 UI 组件，实现完整交互体验，通过全面测试，构建部署。

### 7.2 组件架构

```
<ViewerRoute>
  ├── <Toolbar>                        ← 顶部 48px
  │     ├── <FileIndicator>            ← 文件名 + 大小
  │     ├── <GlobalSearch>             ← 搜索框 + 匹配计数
  │     ├── <FilterTags>               ← 活跃筛选标签列表
  │     ├── <ToolbarActions>           ← 设置/主题按钮
  │     └── <ThemeToggle>              ← 亮/暗切换
  │
  ├── <MainLayout>                     ← 三栏弹性布局
  │     ├── <SchemaPanel>              ← 左侧 240px (可折叠)
  │     │     ├── <SchemaSearch>       ← 字段搜索框
  │     │     ├── <FieldTree>          ← 字段树 + 复选框
  │     │     └── <SchemaActions>      ← 全显/全隐按钮
  │     │
  │     ├── <VirtualGrid>              ← 中间弹性区域
  │     │     ├── <GridHeader>         ← Sticky 表头 + 列菜单
  │     │     └── <GridBody>           ← 虚拟化行区域
  │     │           └── <VirtualRow>   ← 单行渲染
  │     │                 └── <TypeAwareCell>
  │     │
  │     └── <DetailDrawer>             ← 右侧 400px (滑入)
  │           ├── <DrawerHeader>       ← 行号 + 关闭按钮
  │           ├── <JsonTreeView>       ← JSON 语法着色树
  │           └── <DrawerActions>      ← 复制/格式化按钮
  │
  └── <StatusBar>                      ← 底部 32px
        ├── <RowStats>                 ← 总行数/筛选数/错误数
        ├── <Pagination>               ← 页码导航 + 每页条数
        ├── <SelectionInfo>            ← 选中行号
        └── <PerformanceMetrics>       ← 加载耗时 + 内存估算
```

### 7.3 实现顺序

**Priority 1 — 核心交互 (Week 6 前半):**
- SchemaPanel: 左侧字段列表面板 (复选框/搜索/类型标签)
- DetailDrawer: 右侧行详情抽屉 (JSON Tree + 操作按钮)
- StatusToolbar: 顶部工具栏 (文件名/搜索/筛选标签)
- StatusBar: 底部状态栏 (行数/分页/选中/性能)

**Priority 2 — 交互增强 (Week 6 后半):**
- SearchBar: 全局搜索 (Cmd/Ctrl+F, 匹配计数, 高亮)
- FilterSystem: 列筛选系统 (文本/数值/布尔筛选器)
- ColumnMenu: 列头右键菜单 (排序/筛选/隐藏/固定)
- ErrorRowRenderer: 错误行渲染 (红底 + 竖线 + 提示)

**Priority 3 — 视觉打磨 (Week 7 前半):**
- ThemeSystem: 亮/暗主题系统 (CSS Variables)
- Animations: 动效系统
- LandingPage: 空状态引导页
- KeyboardShortcuts: 键盘快捷键
- SettingsPanel: 设置面板

**Priority 4 — v1 收尾 (Week 7 后半):**
- GzipSupport: .jsonl.gz 文件解压
- SSG Build: 静态编译 + 部署

### 7.4 JSON Tree Viewer

对标 VS Code JSON 高亮配色：

| Token | 亮色 | 暗色 |
|-------|------|------|
| Key | `text-sky-600` | `text-sky-400` |
| String | `text-emerald-600` | `text-emerald-400` |
| Number | `text-amber-600` | `text-amber-400` |
| Boolean | `text-purple-600` | `text-purple-400` |
| Null | `text-gray-400 italic` | `text-gray-400 italic` |
| Bracket | `text-gray-500` | `text-gray-500` |

功能: 嵌套节点可展开/收起、深度缩进 2 空格、超长值折叠、"复制 JSON"/"复制原始行"/"格式化/压缩" 按钮。

### 7.5 主题系统

使用 CSS Variables 定义亮/暗两套色值。默认跟随 `prefers-color-scheme`，用户手动切换后存入 `localStorage`。三态: 亮 / 暗 / 跟随系统。

### 7.6 键盘快捷键

| 快捷键 | 功能 |
|--------|------|
| `↑` / `↓` | 上下移动选中行 |
| `Enter` | 打开当前行的详情抽屉 |
| `Esc` | 关闭抽屉 / 取消搜索 |
| `Cmd/Ctrl + F` | 聚焦全局搜索框 |
| `Cmd/Ctrl + K` | 快速打开命令面板 |
| `Cmd/Ctrl + P` | 跳转到指定行号 |
| `Cmd/Ctrl + S` | 导出当前筛选结果 (v2) |
| `Cmd/Ctrl + ,` | 打开设置面板 |
| `H` / `L` | 折叠/展开左侧 Schema 面板 (Vim 风格) |
| `J` / `K` | 下/上移动选中行 (Vim 风格，可选) |
| `Page Up` / `Page Down` | 翻页 |
| `Home` / `End` | 跳转到首行/末行 |

### 7.7 全局搜索

```
用户输入 → Worker SEARCH {query}
  → Rust 遍历已索引行匹配
  → 返回 matchingIndices: number[]
  → TanStack Table 设置 globalFilter
  → 虚拟滚动重新计算
  → 搜索框显示 "12 / 89,012"
  → 上下箭头跳转匹配项
```

### 7.8 Gzip 支持

使用浏览器原生 `DecompressionStream` API，零依赖。检测 `.gz` 后缀自动走解压路径。

### 7.9 全面测试

| 层级 | 工具 | 覆盖范围 |
|------|------|----------|
| Rust 单元测试 | `cargo test` | scanner / schema / parser 每个公共函数 |
| Rust 性能基准 | `criterion` | 1MB / 100MB / 1GB 文件扫描 + 解析耗时 |
| WASM 集成测试 | `wasm-pack test --node` | JS 绑定层序列化正确性 |
| 前端单元测试 | Vitest | hooks / utils / columnBuilder |
| 组件测试 | `@testing-library/react` | 每个 UI 组件渲染 + 交互 |
| 快照测试 | Vitest | CellRenderers 每种类型的输出 |
| E2E 测试 | Playwright | 完整用户流程 |
| 性能测试 | Playwright + CDP | FPS + 内存 + 首屏时间 |
| 跨浏览器 | Playwright | Chrome / Firefox / Safari |

**关键 E2E 场景:**

1. 拖入 10 行 JSONL → 看到表格 + 正确数据
2. 拖入 100MB JSONL → 首屏 ≤ 300ms → 滚动流畅
3. 点击行 → 抽屉滑入 → JSON 树正确
4. 隐藏列 → URL 更新 → 刷新后恢复
5. 排序 → 数据重新排列 → URL 更新
6. 搜索 → 匹配高亮 → 跳转 → 清除
7. 混入错误行 → 红底高亮 → 点击看原始文本
8. 主题切换 → 所有组件颜色正确
9. 键盘导航 → 上下选择 → Enter 开抽屉 → Esc 关闭
10. .jsonl.gz 文件 → 自动解压 → 正常显示

### 7.10 SSG 构建

```
构建产物:
  dist/
    index.html              (~5KB)
    assets/main-*.js        (~200KB gzipped)
    assets/main-*.css       (~30KB gzipped)
    assets/jsonl_core.wasm  (~300KB)

部署目标 (三选一): GitHub Pages / Cloudflare Pages / Vercel
```

### 7.11 时间线

| 天数 | 任务 |
|------|------|
| Day 1-2 | SchemaPanel + DetailDrawer + JsonTreeView |
| Day 3 | Toolbar + StatusBar |
| Day 4-5 | SearchBar + FilterSystem + ColumnMenu |
| Day 6 | ThemeSystem + Animations |
| Day 7 | KeyboardShortcuts + SettingsPanel |
| Day 8 | LandingPage 空状态 |
| Day 9 | Gzip 支持 |
| Day 10-12 | E2E 全面测试 + Bug 修复 |
| Day 13-14 | SSG 构建 + 部署 + 文档 |

---

## 8. 完整时间线总览

```
Week 1-2: Phase 1 — Rust 核心解析器
Week 3:   Phase 2 — TanStack Start 骨架 + Worker 桥梁
Week 4-5: Phase 3 — 表格虚拟化与数据缓存集成
Week 6:   Phase 4 前半 — UI 核心组件
Week 7:   Phase 4 后半 — 打磨、测试、发布
```

---

## 9. v2 路线图 (后续迭代)

以下功能在 v1 完成后按需实现：

- **远程流式加载**: 支持输入 URL，边下载边解析
- **数据导出**: 导出筛选结果为 JSONL / CSV / JSON
- **列统计**: 数值列的 min/max/avg/median
- **多文件对比**: 同时加载多个文件并排比较
- **自定义列公式**: 类似 Excel 的计算列

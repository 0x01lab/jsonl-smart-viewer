# Milestone A: Virtual Table + Full Data Grid

**日期:** 2026-06-05
**阶段:** Phase 3 — 里程碑 A（共 2 个里程碑）
**策略:** 大爆炸重构 — 替换现有 DataTable 为完整虚拟化数据表格

## 范围

里程碑 A 交付一个功能完整的 IDE 风格数据表格：

| 功能 | 状态 |
|------|------|
| 连续虚拟滚动（无分页） | 新建 |
| TanStack Query 行缓存 | 新建 |
| 多列排序（Shift+点击追加） | 新建 |
| 列头筛选菜单（Popover） | 新建 |
| 完整 Schema 面板（显隐/排序/类型） | 新建 |
| URL 状态同步（Zod + Router） | 新建 |
| 列宽拖拽调整 | 新建 |
| 列拖拽排序（Schema 面板内） | 新建 |
| 简版工具栏 | 新建 |
| 状态栏 | 提取重构 |
| 旧 DataTable | 替换删除 |

**明确不在范围内：** 全局搜索 UI、详情抽屉、JSON 树查看器、导出功能、主题切换（留给里程碑 B）。

## 架构

### 整体架构

```
URL (TanStack Router + Zod validateSearch)
  ↓ 双向同步
HomePage (路由组件)
  ├── Toolbar (简版)
  ├── SchemaPanel        ← 列显隐/拖拽排序/类型筛选
  ├── VirtualDataTable   ← 核心重构组件
  └── StatusBar          ← 状态信息
```

### 数据流

```
用户滚动
  → TanStack Virtual 计算可见行范围 [start, end]
  → TanStack Query 用 key ['rows', start, end] 查缓存
  → 缓存未命中 → Worker.getRows(start, end)
  → WASM 按需解析 → 结果入缓存 → 渲染
```

### 状态流转

```
URL search params
  ↕ (双向同步)
useTableState (sorting, filters, visibility, order)
  ↓
TanStack Table (列模型 + 排序 + 筛选)
  ↓
TanStack Virtual (计算可见行范围)
  ↓
useVirtualRows (按范围获取行数据)
  ↓
TanStack Query (缓存 + Worker 调用)
  ↓
Worker → WASM (按需解析)
```

## 组件设计

### 文件结构

```
app/src/
├── routes/
│   └── index.tsx                    ← 重构：URL 状态 + 组件组合
├── components/
│   ├── schema-panel.tsx             ← 新建
│   ├── virtual-data-table.tsx       ← 新建（替代 data-table.tsx）
│   ├── column-header.tsx            ← 新建
│   ├── cell-renderer.tsx            ← 提取
│   ├── toolbar.tsx                  ← 新建（简版）
│   ├── status-bar.tsx               ← 提取
│   └── ui/                          ← 不变
├── hooks/
│   ├── use-table-state.ts           ← 新建
│   ├── use-virtual-rows.ts          ← 新建
│   └── use-column-resize.ts         ← 新建
├── worker/
│   ├── jsonl.worker.ts              ← 不变
│   └── use-jsonl-worker.ts          ← 小改：增加 prefetchRows
└── types/
    └── table-state.ts               ← 新建：Zod schema
```

### 组件职责

#### `index.tsx`（路由页面）— 重构

职责：URL 状态管理 + 顶层布局组合

- 从 URL 读取/写入 search params（TanStack Router validateSearch）
- 组合 Toolbar + SchemaPanel + VirtualDataTable + StatusBar
- 传递 Worker 实例给子组件
- 不再管理 rows/page 状态（全部下沉）

URL search params schema：

```
?sortBy=id:asc,name:desc&filter=age%3E25&filter=name%3Aalice
 &cols=id,name,email&scrollOffset=3200
```

Zod 定义：
- `sortBy`: `z.string().optional()` — "col:asc" 或多列 "col1:asc,col2:desc"
- `filter`: `z.record(z.string()).optional()` — `{ col: "op:value" }`，如 `age: ">25"`, `name: ":alice"`（冒号分隔操作符和值）
- `cols`: `z.string().optional()` — 可见列，逗号分隔
- `scrollOffset`: `z.number().optional()` — 虚拟滚动位置

#### `schema-panel.tsx` — 新建

输入：schema（列定义 + 类型）、columnOrder、columnVisibility、回调函数

功能：
- 搜索框：模糊过滤列名
- 列列表：checkbox 控制显隐、拖拽排序（@dnd-kit/sortable）
- 类型标签：每列显示类型 badge（number/string/boolean/array/object/null）
- 底部类型筛选条：按类型高亮/过滤列

布局：固定宽度 220px，可折叠（动画展开/收起），顶部标题 + 列数。

交互：
- 拖拽手柄：右侧 `⠿` 图标
- 拖拽中：原位半透明 + 浮动卡片跟随
- 放下：列顺序立即更新 + URL 同步

#### `virtual-data-table.tsx` — 新建（核心）

输入：schema、totalRows、errorRows、排序/筛选状态、Worker API
不接收 rows 数组 — 自行通过 TanStack Query 获取。

内部结构：
```
┌─ ColumnHeader × N（sticky 固定列头）
├─ Virtual Body（TanStack Virtual）
│   ├─ 上方占位 spacer
│   ├─ 可见行 × ~30-50（每行 32px）
│   └─ 下方占位 spacer
└─ (无分页控件)
```

行高固定 32px，预取范围：可见区前后各 5 行。

#### `column-header.tsx` — 新建

功能：
- 显示列名
- 点击切换排序（none → asc → desc → none）
- Shift+点击追加排序条件，显示优先级数字 (①②③)
- 点击筛选图标打开 Popover 菜单
- 右边缘拖拽调整列宽

排序视觉：活跃排序列头背景 `#ffffff08`，排序箭头用主题色。

列宽调整：
- 列头右边缘 6px 区域
- hover 显示分隔线高亮（主题色）
- 拖拽实时变化，最小宽度 40px
- 双击自动适配列内容宽度

#### `cell-renderer.tsx` — 提取

从现有 data-table.tsx 提取 CellRenderer，无逻辑变更。

#### `toolbar.tsx` — 新建（简版）

显示：文件名 + 文件大小 + 全局搜索占位（⌘F 图标，不可点击）

#### `status-bar.tsx` — 提取

从现有 data-table.tsx 提取状态栏，增加内存估算显示。

### Hook 职责

#### `use-table-state.ts`

统一管理表格所有状态，双向同步 URL。

状态：
- sorting: SortingState
- columnFilters: ColumnFiltersState
- columnVisibility: VisibilityState
- columnOrder: string[]

行为：状态变化 → URL；URL 变化 → 状态；初始化从 URL 恢复。

#### `use-virtual-rows.ts`

虚拟滚动 + 行数据获取。

- queryKey: `['rows', fileId, start, end]`（fileId 为文件名+大小的哈希，避免多文件缓存冲突）
- staleTime: Infinity（文件不变数据不变）
- gcTime: 5 分钟（不可见区缓存自动回收）
- 预取：当前范围 ± 5 行

#### `use-column-resize.ts`

列宽拖拽调整逻辑，使用 TanStack Table 内置的 columnSizing 状态。

## 交互设计

### 排序

- 点击列头文字：none → 升序 ▲ → 降序 ▼ → 清除
- Shift+点击：追加第二排序条件
- 多列排序显示优先级数字

### 筛选菜单

string 列：
- 搜索框 + 包含/不包含/等于 三种模式
- 去重值列表 top 50，checkbox 选择

number 列：
- 条件选择器（大于/小于/等于/范围）
- 值输入框
- 可添加多条件

boolean 列：
- 单选：全部 / true / false

### 键盘快捷键

| 快捷键 | 功能 |
|--------|------|
| ↑ / ↓ | 上下移动选中行 |
| Escape | 清除选中 |

（⌘F 全局搜索留给里程碑 B 做完整 UI）

## 视觉规范

### 高亮样式

所有高亮使用背景色，不使用左侧彩色边框：

| 状态 | 背景色 | 说明 |
|------|--------|------|
| 选中行 | `#3b82f622` | 蓝色半透明 |
| 错误行 | `#ef444418` | 红色半透明 |
| Hover | 现有 hover 变量 | 不变 |
| 斑马纹 | 偶数/奇数行交替 | 不变 |

### Schema 面板选中项

背景色 `#3b82f618`，圆角卡片样式。

### 类型标签颜色

| 类型 | 颜色 |
|------|------|
| number | `#3b82f6` (蓝) |
| string | `#22c55e` (绿) |
| boolean | `#f59e0b` (橙) |
| array | `#a855f7` (紫) |
| object | `#ef4444` (红) |
| null | `#888` (灰) |

## 错误处理

| 场景 | 处理 |
|------|------|
| 行解析失败 | 行背景色变红，显示错误信息，不崩溃 |
| Worker 通信失败 | toast 错误 + 重试按钮 |
| 超大文件加载慢 | skeleton 行 + 进度条 |
| URL 参数非法 | Zod 静默回退默认值 |
| 内存超 150MB | TanStack Query gcTime 自动回收 |
| 列筛选无结果 | 空状态提示 "无匹配行" |

## 排序/筛选实现策略

- 排序在客户端完成：WASM 解析后对当前缓存行排序
- 筛选在客户端完成：TanStack Table 的 columnFilters
- 大文件只对已加载行排序，不做 WASM 端排序优化（留给未来）

## 测试策略

### 单元测试（Vitest）

- `use-table-state.ts` — URL ↔ 状态双向同步
- `cell-renderer.tsx` — 各类型值渲染正确性
- `column-header.tsx` — 排序状态切换逻辑

### 集成测试（Vitest + Testing Library）

- `virtual-data-table.tsx` — 滚动触发数据获取
- `schema-panel.tsx` — checkbox 控制列显隐、拖拽排序

### 手动验证

- 连续滚动 10 万行文件的流畅度
- 排序/筛选组合使用
- URL 分享链接恢复状态
- 浏览器前进/后退

## 新增依赖

```json
{
  "@tanstack/react-virtual": "^3.x",
  "@tanstack/react-query": "^5.x",
  "@dnd-kit/core": "^6.x",
  "@dnd-kit/sortable": "^8.x",
  "@dnd-kit/utilities": "^3.x",
  "zod": "^3.x"
}
```

`@tanstack/react-table` 和 `@tanstack/react-router` 已安装。`zod` 可能已作为 router 的依赖存在。

## 性能目标

| 指标 | 目标 |
|------|------|
| 滚动帧率 | ≥ 60fps |
| 首屏渲染 | ≤ 300ms（1GB 文件） |
| 内存占用 | ≤ 150MB 峰值 |
| 可见行渲染 | 30-50 行 DOM 节点 |
| 预取延迟 | 滚动时无白屏 |

## 实现顺序

1. 安装依赖 + 类型定义
2. 创建 `types/table-state.ts`（Zod schema）
3. 创建 `hooks/use-table-state.ts`
4. 创建 `cell-renderer.tsx`（提取）
5. 创建 `status-bar.tsx`（提取）
6. 创建 `toolbar.tsx`（简版）
7. 创建 `hooks/use-virtual-rows.ts`
8. 创建 `hooks/use-column-resize.ts`
9. 创建 `column-header.tsx`
10. 创建 `virtual-data-table.tsx`（核心）
11. 创建 `schema-panel.tsx`
12. 重构 `routes/index.tsx`
13. 删除旧 `data-table.tsx`
14. 测试 + 手动验证

## 里程碑 B 预告

以下功能留给里程碑 B：

- 全局搜索 UI（⌘F）
- 详情抽屉（右侧滑入，JSON 树查看器）
- 导出功能（JSONL/CSV/JSON）
- 主题切换
- 完整工具栏

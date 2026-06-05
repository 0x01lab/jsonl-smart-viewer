# UI/UX 设计规范 (UI/UX Design Specification)

> 对标 **DataGrip、TablePlus、Supabase Table Editor、Prisma Studio、DBeaver** 等成熟 SQL 数据表格管理工具的 UI 质感与操作直觉。
>
> **UI 框架：** [shadcn/ui](https://ui.shadcn.com/) — Nova 紧凑风格 (`base-nova`)，基于 Radix UI 原语 + Tailwind CSS v4 + OKLCH 色彩空间。
>
> **项目初始化：** `npx shadcn create` → 选择 TanStack Start 框架 → Nova 风格 → Neutral 基色

---

## 0. 技术栈与 shadcn 配置 (Tech Stack & shadcn Config)

### 0.1 项目初始化

```bash
# 使用 shadcn create 可视化创建项目（最新版）
npx shadcn create
# → 选择框架: TanStack Start
# → 选择风格: Nova (compact)
# → 选择基色: Neutral
# → 选择圆角: 0.625rem (默认)
# → 选择图标库: Lucide
```

### 0.2 components.json 配置参考

```jsonc
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

### 0.3 使用的 shadcn 组件映射

| UI 区域 | shadcn 组件 | 说明 |
|---------|-------------|------|
| 工具栏按钮 | `Button` (ghost / outline variant) | Nova `h-8` 紧凑高度 |
| 全局搜索 | `Input` + `Command` (Cmd+K) | Nova `h-8` 输入框 |
| 筛选标签 | `Badge` (removable) | Nova pill 形 `rounded-4xl` |
| 列菜单 | `DropdownMenu` | 紧凑菜单项 |
| 字段复选框 | `Checkbox` + `Collapsible` | 树状结构 |
| 类型标签 | `Badge` (outline variant) | 紧凑小尺寸 |
| 分页控件 | `Pagination` / `Select` (每页条数) | Nova Select |
| 右侧抽屉 | `Sheet` (side="right") | Nova `rounded-xl` |
| 设置面板 | `Dialog` / `Sheet` | Nova Dialog |
| 主题切换 | `DropdownMenu` + `Sun/Moon` | 三态切换 |
| Toast 通知 | `Sonner` (shadcn 推荐) | 从顶部滑入 |
| 空状态拖拽区 | `Card` | Nova `py-4 px-4` 紧凑内边距 |
| 加载状态 | `Skeleton` + `Progress` | Nova 骨架屏 |
| 表格容器 | `Table` (自定义增强) | 虚拟滚动包裹 |
| 树状 JSON 查看器 | `Collapsible` + 自定义渲染 | 可折叠节点 |
| 状态栏 | 自定义 `StatusBar` 组件 | 使用 shadcn Tooltip |
| 导出菜单 | `DropdownMenu` | JSONL / CSV / JSON |
| 快捷键提示 | `Kbd` (自定义) + `Tooltip` | 快捷键展示 |

---

## 1. 全局布局架构 (Global Layout)

采用经典的「三栏 + 工具栏 + 状态栏」IDE 级布局，所有面板均可折叠，核心数据表格始终占据最大视觉面积：

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  顶部工具栏 (Toolbar) — shadcn Button/Input/DropdownMenu                    │
│  [文件名 ▾]  [🔍 全局搜索]  [Badge 筛选标签...]  [导出 ▾]  [设置 ⚙]  [主题 🌗] │
├──────────┬──────────────────────────────────────────────┬───────────────────┤
│          │  列头 (Sticky Header)                         │                   │
│  左侧栏  │  ┌────┬────────┬────────┬───────┬────────┐   │   右侧详情抽屉    │
│ (Schema  │  │ #  │ col_A  │ col_B  │ col_C │ col_D  │   │   (Row Detail     │
│  Panel)  │  ├────┼────────┼────────┼───────┼────────┤   │    Drawer)        │
│          │  │ 1  │ val    │ val    │ null  │ val    │   │                   │
│ □ col_A  │  │ 2  │ val    │ val    │ val   │ val    │   │  JSON Tree View   │
│ ☑ col_B  │  │ 3  │ ...    │ ...    │ ...   │ ...    │   │  ──────────────   │
│ ☑ col_C  │  │    │        │        │       │        │   │  {                │
│ □ col_D  │  │  ↕ 虚拟滚动区域 (仅渲染可视行)        │   │    "id": 1,      │
│          │  │    │        │        │       │        │   │    "name": "...", │
│ ─────── │  │ N  │ val    │ val    │ val   │ val    │   │    "meta": {      │
│ 排序:    │  └────┴────────┴────────┴───────┴────────┘   │      ...         │
│ A ↑ ↓    │                                              │    }             │
│          │                                              │  }               │
│          │                                              │  [复制] [格式化]  │
├──────────┴──────────────────────────────────────────────┴───────────────────┤
│  底部状态栏 (Status Bar)                                                      │
│  共 1,234,567 行  │  已筛选: 89,012 行  │  当前页: 1/890  │  加载: 0.2s      │
│  ← 1 2 3 ... 890 →  │  每页: [100 ▾]  │  选中: 第 42 行  │  内存: ~45MB     │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.1 布局规则

| 区域 | 默认状态 | 行为 |
|------|---------|------|
| **顶部工具栏** | 始终可见，高度 40px (Nova 紧凑) | 固定于视口顶部 (sticky)，包含文件信息、全局搜索、操作按钮 |
| **左侧 Schema 面板** | 默认展开，宽度 220px (Nova 紧凑) | 可折叠至图标模式 (44px)；展示全量字段列表与排序状态 |
| **主数据表格区** | 始终可见，弹性填满剩余空间 | 表头 sticky 固定，内容区虚拟滚动 |
| **右侧详情抽屉** | 默认隐藏 | 点击行时从右侧滑入 (shadcn Sheet)，宽度 380px，支持 Esc 关闭 |
| **底部状态栏** | 始终可见，高度 28px (Nova 紧凑) | 固定于视口底部，展示统计信息与分页控件 |

---

## 2. 视觉设计系统 (Visual Design System)

### 2.1 Nova 风格基础 Token

shadcn Nova 风格采用 **OKLCH 色彩空间**，通过 CSS 变量实现主题切换。以下为 Neutral 基色的完整 Token 定义：

**亮色主题 (Light)：**

```css
:root {
  --radius: 0.625rem;   /* 10px — Nova 默认圆角基数 */
  --radius-sm: calc(var(--radius) * 0.6);  /* 6px */
  --radius-md: calc(var(--radius) * 0.8);  /* 8px */
  --radius-lg: var(--radius;               /* 10px */
  --radius-xl: calc(var(--radius) * 1.4);  /* 14px */
  --radius-2xl: calc(var(--radius) * 1.8); /* 18px */

  --background: oklch(1 0 0);              /* 纯白 */
  --foreground: oklch(0.145 0 0);          /* 近黑 */
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.145 0 0);
  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.145 0 0);
  --primary: oklch(0.205 0 0);             /* 深色主色 */
  --primary-foreground: oklch(0.985 0 0);
  --secondary: oklch(0.97 0 0);            /* 次要背景 */
  --secondary-foreground: oklch(0.205 0 0);
  --muted: oklch(0.97 0 0);                /* 静音背景 */
  --muted-foreground: oklch(0.556 0 0);    /* 次要文字 */
  --accent: oklch(0.97 0 0);
  --accent-foreground: oklch(0.205 0 0);
  --destructive: oklch(0.577 0.245 27.325); /* 危险红 */
  --border: oklch(0.922 0 0);              /* 边框 */
  --input: oklch(0.922 0 0);
  --ring: oklch(0.708 0 0);                /* 聚焦环 */
}
```

**暗色主题 (Dark)：**

```css
.dark {
  --background: oklch(0.145 0 0);
  --foreground: oklch(0.985 0 0);
  --card: oklch(0.145 0 0);
  --card-foreground: oklch(0.985 0 0);
  --popover: oklch(0.145 0 0);
  --popover-foreground: oklch(0.985 0 0);
  --primary: oklch(0.985 0 0);
  --primary-foreground: oklch(0.205 0 0);
  --secondary: oklch(0.269 0 0);
  --secondary-foreground: oklch(0.985 0 0);
  --muted: oklch(0.269 0 0);
  --muted-foreground: oklch(0.708 0 0);
  --accent: oklch(0.269 0 0);
  --accent-foreground: oklch(0.985 0 0);
  --destructive: oklch(0.396 0.163 25.731);
  --border: oklch(0.269 0 0);
  --input: oklch(0.269 0 0);
  --ring: oklch(0.439 0 0);
}
```

### 2.2 JSONL Viewer 扩展 Token

在 shadcn 基础 Token 之上，项目扩展以下业务 Token 用于数据表格特有场景：

```css
:root {
  /* 表格行交替背景 */
  --table-row-even: oklch(1 0 0);               /* 白底 */
  --table-row-odd: oklch(0.98 0 0);             /* 极淡灰 (斑马纹) */
  --table-row-hover: oklch(0.96 0.01 270);      /* 淡靛蓝 hover */
  --table-row-selected: oklch(0.94 0.02 270);   /* 靛蓝选中 */
  --table-row-error: oklch(0.97 0.02 25);       /* 淡红错误行 */
  --table-header-bg: oklch(0.97 0 0);           /* 表头背景 */
  --table-grid-line: oklch(0.922 0 0);          /* 网格线 */
  --table-selected-indicator: oklch(0.45 0.18 270); /* 选中行左侧竖线 */

  /* 语义色 */
  --color-success: oklch(0.65 0.2 160);         /* 绿色 */
  --color-warning: oklch(0.75 0.18 85);         /* 琥珀色 */
  --color-error: oklch(0.577 0.245 27.325);     /* 红色 */
  --color-info: oklch(0.55 0.2 260);            /* 蓝色 */

  /* JSON 语法高亮 */
  --json-key: oklch(0.55 0.2 260);              /* 蓝色 Key */
  --json-string: oklch(0.55 0.16 150);          /* 绿色 String */
  --json-number: oklch(0.65 0.18 65);           /* 橙色 Number */
  --json-boolean: oklch(0.55 0.2 310);          /* 紫色 Boolean */
  --json-null: oklch(0.556 0 0);                /* 灰色 Null */

  /* 空值文字 */
  --null-text: oklch(0.65 0 0);                 /* 浅灰斜体 */
}
```

### 2.3 配色方案对比表 (Color Reference)

**亮色主题关键色值：**

| 用途 | OKLCH Token | 近似 HEX | 说明 |
|------|-------------|---------|------|
| 背景 - 页面 | `--background` | `#FFFFFF` | 纯白 |
| 背景 - 表格行 (偶数) | `--table-row-even` | `#FFFFFF` | 白底 |
| 背景 - 表格行 (奇数) | `--table-row-odd` | `#F9FAFB` | 极淡灰 (斑马纹) |
| 背景 - 表头 | `--table-header-bg` | `#F3F4F6` | 浅灰 |
| 背景 - 行 Hover | `--table-row-hover` | `#EEF2FF` | 淡靛蓝 |
| 背景 - 行选中 | `--table-row-selected` | `#E0E7FF` | 靛蓝 |
| 背景 - 错误行 | `--table-row-error` | `#FEF2F2` | 淡红 |
| 文字 - 主要 | `--foreground` | `#111827` | 近黑 |
| 文字 - 次要 | `--muted-foreground` | `#6B7280` | 灰色 |
| 文字 - 空值 (null) | `--null-text` | `#9CA3AF` | 浅灰 + 斜体 |
| 边框 - 网格线 | `--border` | `#E5E7EB` | 细灰线 |
| 强调色 - 主色 | `--primary` | `#1F2937` | 深色 (Nova 默认) |
| 强调色 - 成功 | `--color-success` | `#10B981` | 绿色 |
| 强调色 - 警告 | `--color-warning` | `#F59E0B` | 琥珀色 |
| 强调色 - 错误 | `--color-error` | `#EF4444` | 红色 |

**暗色主题关键色值：**

| 用途 | 近似 HEX |
|------|---------|
| 背景 - 页面 | `#111827` |
| 背景 - 表格行 (偶数) | `#111827` |
| 背景 - 表格行 (奇数) | `#1F2937` |
| 背景 - 表头 | `#1F2937` |
| 背景 - 行 Hover | `#1E1B4B` |
| 背景 - 行选中 | `#312E81` |
| 文字 - 主要 | `#F9FAFB` |
| 文字 - 次要 | `#9CA3AF` |
| 边框 - 网格线 | `#374151` |

### 2.4 排版 (Typography)

Nova 风格使用 `text-sm` (0.875rem) 作为基础字号：

| 元素 | 字体 | 字号 | 字重 | Tailwind 类 |
|------|------|------|------|------------|
| 表格单元格数据 | `JetBrains Mono` / `Menlo` / `monospace` | 13px | Regular (400) | `font-mono text-[13px]` |
| 表头文字 | `Inter` / `system-ui` | 13px | Semibold (600) | `font-sans text-[13px] font-semibold` |
| 工具栏标题 | `Inter` / `system-ui` | 14px | Medium (500) | `font-sans text-sm font-medium` |
| 状态栏文字 | `Inter` / `system-ui` | 12px | Regular (400) | `font-sans text-xs` |
| 左侧栏字段名 | `JetBrains Mono` / `monospace` | 12px | Regular (400) | `font-mono text-xs` |
| 抽屉内 JSON Key | `JetBrains Mono` / `monospace` | 13px | Regular (400) | `font-mono text-[13px]` |
| 抽屉内 JSON Value | `JetBrains Mono` / `monospace` | 13px | Regular (400) | `font-mono text-[13px]` |
| Badge 类型标签 | `Inter` / `system-ui` | 11px | Medium (500) | `font-sans text-[11px] font-medium` |

> **核心原则：** 数据区一律使用等宽字体 (Monospace)，确保数字、代码等内容的列对齐与可读性，这是 DataGrip / TablePlus 等专业工具的通用做法。

### 2.5 间距与尺寸 (Spacing & Sizing) — Nova 紧凑规格

Nova 风格核心特征：按钮 `h-8` (32px)、输入框 `h-8`、卡片 `py-4 px-4`、圆角 `rounded-lg`。

| 元素 | 尺寸 | shadcn Nova 基准 |
|------|------|-----------------|
| 表格行高 | 28px (默认) / 可由用户在 24-44px 间调整 | 比 Vega (32px) 更紧凑 |
| 表头高度 | 32px | Nova `h-8` |
| 单元格内边距 | 水平 8px，垂直 4px | Nova Table `p-2` |
| 列最小宽度 | 72px | 紧凑 |
| 列默认宽度 | 140px (自适应内容时上限 360px) | 紧凑 |
| 左侧栏宽度 | 220px (可拖拽调整为 160-320px) | Nova 紧凑 |
| 右侧抽屉宽度 | 380px (可拖拽调整为 280-560px) | Nova Sheet 紧凑 |
| 工具栏高度 | 40px | Nova 紧凑 |
| 状态栏高度 | 28px | Nova 紧凑 |
| 网格线宽度 | 1px (实线) | `border` |
| 按钮默认高度 | 32px | Nova `h-8` |
| 按钮小号高度 | 28px | Nova `h-7` |
| 按钮大号高度 | 36px | Nova `h-9` |
| 输入框高度 | 32px | Nova `h-8` |
| 卡片内边距 | 16px (py-4 px-4) | Nova Card |
| 圆角 - 按钮/输入 | 8px (rounded-lg) | Nova `--radius-md` |
| 圆角 - 卡片/对话框 | 14px (rounded-xl) | Nova `--radius-xl` |
| 圆角 - Badge | 全圆角 (rounded-4xl) | Nova pill |

### 2.6 图标与组件风格

* **图标库：** [Lucide Icons](https://lucide.dev/) — shadcn 默认集成，轻量线条风格。
* **按钮风格 (shadcn Button)：** Ghost 为主要使用变体（`variant="ghost"`），Hover 时出现 `--accent` 背景；主要操作使用 `variant="default"`。Nova 紧凑 `h-8` 高度。
* **输入框 (shadcn Input)：** Nova 紧凑 `h-8`，1px `--border` 细边框，Focus 时显示 `--ring` 描边 + 微弱阴影 (`ring-2`)。
* **下拉菜单 (shadcn DropdownMenu)：** 极轻阴影 (`shadow-md`)，圆角 `rounded-lg`，紧凑菜单项间距。
* **Badge (shadcn Badge)：** Nova pill 形 `rounded-4xl`，类型标签使用 `variant="outline"`，筛选标签使用 `variant="secondary"` + 可删除。
* **Sheet (shadcn Sheet)：** 右侧抽屉使用 `side="right"`，Nova `rounded-xl` 圆角，支持拖拽调整宽度。
* **整体风格关键词：** *Compact, Dense-Information, Developer-Tool Aesthetic, Nova Minimal*。

---

## 3. 数据表格网格详细规范 (Data Grid Specification)

### 3.1 表头 (Column Header)

表头是对标 SQL 管理器的核心交互区域，使用 shadcn `DropdownMenu` 作为列菜单：

```
┌──────────────────────────┐
│  ↕  字段名称           ▾  │
│     (排序箭头)    (菜单)  │
└──────────────────────────┘
```

* **字段名：** 等宽字体显示，过长时截断并以 `Tooltip` 展示全名。
* **排序指示器：** 点击表头切换 `ASC ↑` → `DESC ↓` → `取消排序`，三态循环。当前排序列高亮且显示箭头图标。
* **列菜单 (shadcn `DropdownMenu`)：** 点击表头右侧 `▾` 图标弹出下拉菜单，包含：
  - `升序排列` / `降序排列` / `取消排序` (`DropdownMenuItem`)
  - `按此列筛选...` (打开筛选输入框)
  - `隐藏此列` (`DropdownMenuSeparator` 分隔)
  - `固定到左侧` / `固定到右侧`
  - `自动调整列宽` / `调整所有列宽`
* **列宽拖拽：** 表头右边缘出现 `↔` 光标，拖拽实时调整宽度。双击自动适配该列最长内容宽度。
* **列重排：** 拖拽表头中部可整列移动位置。
* **列固定 (Pinning)：** 支持将关键列（如 `id`、`_index`）固定在左侧或右侧，滚动时不随主体移动。

### 3.2 行号列 (Row Number Column)

* 表格最左侧固定显示行号列 `#`，宽度 52px (Nova 紧凑)，始终可见不随水平滚动消失。
* 行号使用 `--muted-foreground` 色，字体 12px。
* 选中行的行号使用 `--primary` 色加粗显示。

### 3.3 单元格渲染规则 (Cell Rendering)

| 数据类型 | 渲染样式 | shadcn 组件 | 示例 |
|----------|---------|-------------|------|
| `string` (短文本) | 默认文字，左对齐 | 纯文本 | `hello world` |
| `string` (长文本) | 单行截断 + 省略号，Hover 显示 `Tooltip` | `Tooltip` | `A very long text th...` |
| `number` / `integer` | 右对齐，千位分隔符 | 纯文本 | `1,234,567` |
| `boolean` | 居中显示小型 Badge | `Badge` (success / secondary) | `● true` |
| `null` / `undefined` | 灰色斜体文字 `null`，背景微弱灰底 | 纯文本 (`--null-text`) | *null* |
| `object` / `array` (嵌套) | 显示 `{...}` 或 `[...]` 图标徽标，蓝色调，点击展开 | `Badge` (outline + custom) | `{3 fields}` |
| `Error Row` | 整行 `--table-row-error` 背景 + 左侧红色竖线 + `⚠ JSON 格式损坏` 提示 | 自定义 | `⚠ Invalid JSON` |
| URL 字符串 | 蓝色可点击链接样式 | 纯文本 (`--color-info`) | `https://...` |

### 3.4 斑马纹与 Hover (Zebra Striping & Hover)

* **斑马纹：** 默认开启，奇偶行交替使用 `--table-row-even` 与 `--table-row-odd` 背景。
* **行 Hover：** 鼠标悬停行背景变为 `--table-row-hover`。
* **行选中：** 点击行后背景变为 `--table-row-selected`，左侧显示 3px `--table-selected-indicator` 竖线指示器。
* **可选：** 支持用户在设置中关闭斑马纹，使用纯白底。

### 3.5 网格线 (Grid Lines)

* 默认显示水平网格线 (行间分隔)，不显示垂直网格线 (列间分隔) —— 与 DataGrip / Supabase 默认行为一致。
* 水平线使用 `--border` 色，1px 实线。
* 用户可在设置中切换为「十字网格 (Full Grid)」或「无网格线 (No Lines)」。

---

## 4. 工具栏详细规范 (Toolbar Specification)

```
┌─────────────────────────────────────────────────────────────────────────┐
│  📄 train_data.jsonl  (1.2 GB)  │  🔍 搜索全部列...          │ ☰  ☾  ⚙ │
└─────────────────────────────────────────────────────────────────────────┘
```

| 组件 | shadcn 组件 | 说明 |
|------|-------------|------|
| **文件信息** | `Button` (ghost) + `DropdownMenu` | 左侧显示文件名 + 文件大小，点击显示下拉菜单（重新加载、关闭文件） |
| **全局搜索** | `Input` (Nova h-8) + `Command` (Cmd+K) | 居中的搜索输入框，实时模糊搜索所有列，搜索时展示匹配计数 "12 / 89" |
| **筛选标签区** | `Badge` (removable, variant="secondary") | 搜索框下方或右侧，展示当前激活的筛选条件标签（如 `status = 200 ×`），点击 × 移除 |
| **导出按钮** | `Button` + `DropdownMenu` | 下拉菜单支持「导出筛选结果为 JSONL / CSV / JSON」 |
| **列设置按钮** | `Button` (ghost, size="icon") | 快捷打开左侧 Schema 面板 |
| **主题切换** | `Button` (ghost) + `DropdownMenu` | 亮/暗/跟随系统 三态切换 |
| **设置按钮** | `Button` (ghost, size="icon") | 打开全局 `Dialog` 设置面板（行高、字体大小、网格线模式、快捷键等） |

---

## 5. 左侧 Schema 面板 (Schema Panel)

对标 DataGrip 的 Database 面板与 Supabase 的列选择器：

```
┌─────────────────────┐
│  字段 (23)    🔍     │
├─────────────────────┤
│  ☑ id          int   │
│  ☑ name        str   │
│  ☐ email       str   │
│  ☑ age         int   │
│  ☐ address     obj   │
│  │  ☑ address.city   │
│  │  ☐ address.zip    │
│  ☑ tags        arr   │
│  ☑ created_at  str   │
├─────────────────────┤
│  ▾ 排序: name ↑      │
│  ▾ 类型筛选: 全部     │
├─────────────────────┤
│  [全部显示] [全部隐藏] │
└─────────────────────┘
```

* **搜索过滤：** 顶部使用 shadcn `Input` (Nova h-8) 快速定位字段。
* **字段列表：** 树状展示所有扁平化后的字段，嵌套字段使用 shadcn `Collapsible` 以缩进展示层级关系（如 `address.city`、`address.zip`）。
* **复选框控制：** shadcn `Checkbox` 勾选/取消即时控制表格列的显示与隐藏。
* **类型标签：** 每个字段右侧显示推断出的数据类型小标签，使用 shadcn `Badge` (`variant="outline"`, Nova 紧凑尺寸)，不同类型不同颜色：
  - `str` → 蓝色 (`--color-info`)
  - `int` / `float` → 橙色 (`--color-warning`)
  - `bool` → 紫色 (`--json-boolean`)
  - `obj` → 绿色 (`--color-success`)
  - `arr` → 靛蓝 (`--primary`)
* **批量操作：** 底部「全部显示」「全部隐藏」使用 shadcn `Button` (`variant="ghost"`, Nova `h-7` 小号)。
* **排序显示：** 当前列排序状态摘要（如 `排序: name ↑, age ↓`）。

---

## 6. 右侧详情抽屉 (Row Detail Drawer)

对标 DataGrip / DBeaver 的行编辑面板，使用 shadcn `Sheet` (`side="right"`)，点击表格任意行时从右侧滑入：

```
┌───────────────────────────┐
│  行详情 - #42          ✕  │
├───────────────────────────┤
│                           │
│  {                        │
│    "id": 42,              │
│    "name": "Alice",       │
│    "email": null,         │
│    "address": {           │
│      "city": "Shanghai",  │
│      "zip": "200000"      │
│    },                     │
│    "tags": [              │
│      "vip",               │
│      "active"             │
│    ],                     │
│    "created_at": "2026.." │
│  }                        │
│                           │
├───────────────────────────┤
│  [📋 复制 JSON]  [📐 格式化] │
│  [📥 复制原始行]             │
└───────────────────────────┘
```

* **Sheet 配置：** `side="right"`, Nova 紧凑宽度 380px，`rounded-xl` 圆角。
* **JSON Tree 着色：** 使用项目扩展 Token：
  - Key → `--json-key` (蓝色)
  - String → `--json-string` (绿色)
  - Number → `--json-number` (橙色)
  - Boolean → `--json-boolean` (紫色)
  - Null → `--json-null` (灰色)
* **可折叠节点：** 嵌套的 `object` 和 `array` 节点使用 shadcn `Collapsible`，点击 `▸` / `▾` 展开/收起。
* **操作按钮：** 使用 shadcn `Button` (`variant="outline"`, Nova `h-8`)：
  - 「复制 JSON」：复制格式化后的完整 JSON 到剪贴板，配合 shadcn `Sonner` toast 反馈。
  - 「复制原始行」：复制该行在文件中的原始 JSONL 文本。
  - 「格式化 / 压缩」：切换 JSON 展示的缩进模式。
* **滑入动画：** shadcn Sheet 内置 `transform: translateX` 动画，时长 200ms，`ease-out` 缓动曲线。
* **关闭方式：** 点击 Sheet 右上角 `✕`、按 `Esc` 键、或点击 Sheet 外部遮罩区域。

---

## 7. 底部状态栏 (Status Bar)

对标 DataGrip / VS Code 底部状态栏：

```
┌───────────────────────────────────────────────────────────────────────────┐
│  📊 共 1,234,567 行  │  🔍 筛选: 89,012 行  │  ⚠ 错误: 3 行             │
│  ◀ 1 2 3 ... 890 ▶  │  每页: [100 ▾]  │  选中: #42  │  ⏱ 0.21s  │  💾 ~45MB │
└───────────────────────────────────────────────────────────────────────────┘
```

| 区域 | shadcn 组件 | 内容 |
|------|-------------|------|
| **统计区** | 纯文本 + `Tooltip` | 总行数、筛选后行数、错误行数 |
| **分页控件** | `Pagination` + `Select` (每页条数) | 页码导航 `◀ 1 2 3 ... N ▶`，每页条数下拉选择 (50 / 100 / 200 / 500 / 1000) |
| **选中信息** | 纯文本 | 当前选中行的行号 `#42`，或范围 `#42-56` |
| **性能指标** | `Tooltip` (详细性能) | 最近一次数据加载耗时、当前内存占用估算 |
| **加载状态** | `Progress` + `Skeleton` | 后台解析时显示进度条 + 进度百分比 |

---

## 8. 空状态与引导页 (Empty & Onboarding States)

### 8.1 初始落地页 (Landing Page - 无文件加载时)

当用户首次打开应用，尚未加载任何文件时，展示居中的引导面板，使用 shadcn `Card` (Nova 紧凑 `py-4 px-4`)：

```
┌─────────────────────────────────────────┐
│                                         │
│            📊 JSONL Smart Viewer        │
│                                         │
│     ┌─────────────────────────────┐     │
│     │                             │     │
│     │   拖拽 JSONL 文件到此处      │     │
│     │        或                    │     │
│     │   [📂 选择文件]  [🔗 输入URL] │     │
│     │                             │     │
│     └─────────────────────────────┘     │
│                                         │
│     支持: .jsonl / .json / .jsonl.gz    │
│     100% 本地解析 · 隐私安全             │
│                                         │
└─────────────────────────────────────────┘
```

* 拖拽区域使用 `border-dashed` + `--border` 色，拖入文件时边框变为 `--primary` 实线 + `--accent` 背景高亮。
* 「选择文件」按钮使用 shadcn `Button` (`variant="default"`, Nova `h-9`)。
* 「输入 URL」按钮使用 shadcn `Button` (`variant="outline"`, Nova `h-9`)。
* 下方支持多种文件格式提示。

### 8.2 加载中状态 (Loading State)

* 文件扫描阶段：显示 shadcn `Progress` 进度条 + "正在扫描行索引... (23%)" 文字。
* Schema 提取阶段：显示 "正在分析字段结构..." + shadcn `Skeleton` 占位。

### 8.3 错误状态

* 文件格式不合法：显示明确的错误提示 (shadcn `Alert` `variant="destructive"`) + "请选择 .jsonl 或 .json 文件"。
* 网络文件加载失败：显示 "无法访问远程文件" + shadcn `Button` 重试按钮。

---

## 9. 交互反馈与动效 (Interaction Feedback & Motion)

| 交互 | 动效 | 时长 | shadcn 实现 |
|------|------|------|------------|
| 行 Hover | 背景色过渡 | 100ms `ease` | CSS `transition-colors` |
| 行选中 | 背景色变化 + 左侧竖线出现 | 150ms `ease-out` | CSS `transition-all` |
| 列排序切换 | 表头图标旋转动画 | 200ms `ease` | CSS `transition-transform` |
| 列宽拖拽 | 实时跟随鼠标 (无延迟) | — | 原生拖拽 |
| 抽屉滑入/滑出 | `translateX` 平移 | 200ms `ease-out` / 150ms `ease-in` | Sheet 内置动画 |
| 左侧栏展开/折叠 | 宽度过渡 | 200ms `ease` | CSS `transition-[width]` |
| 筛选标签出现/消失 | `scale + opacity` 渐变 | 150ms `ease` | Badge + CSS animation |
| 错误行出现 | 左侧红色竖线闪烁一次 | 300ms | CSS `@keyframes` |
| Toast 通知 | 从顶部滑入，自动消失 | 200ms 入 / 3000ms 停留 / 200ms 出 | shadcn `Sonner` |
| DropdownMenu 弹出 | scale + opacity | 150ms | DropdownMenu 内置动画 |
| Dialog 弹出 | scale + opacity | 200ms | Dialog 内置动画 |
| Collapsible 展开 | height 过渡 | 200ms `ease` | Collapsible 内置动画 |

> **核心原则：** 所有动效时长控制在 **100ms ~ 300ms** 之间，绝不使用过长的动画干扰数据查看效率。这是开发工具与消费级应用的核心区别 —— **效率优先，花哨其次**。

---

## 10. 键盘快捷键 (Keyboard Shortcuts)

对标 DataGrip / DBeaver 的键盘导航习惯：

| 快捷键 | 功能 | shadcn 组件 |
|--------|------|-------------|
| `↑` / `↓` | 上下移动选中行 | 自定义 |
| `←` / `→` | 水平滚动表格 (或切换焦点单元格) | 自定义 |
| `Enter` | 打开当前行的右侧详情抽屉 (Sheet) | Sheet trigger |
| `Esc` | 关闭抽屉 / 取消搜索 / 取消筛选 | Sheet / Command close |
| `Cmd/Ctrl + F` | 聚焦全局搜索框 | Input focus |
| `Cmd/Ctrl + K` | 快速打开命令面板 (shadcn `Command`) | Command dialog |
| `Cmd/Ctrl + P` | 快速跳转到指定行号 | Command dialog |
| `Cmd/Ctrl + S` | 导出当前筛选结果 | DropdownMenu trigger |
| `Cmd/Ctrl + ,` | 打开设置面板 (Dialog) | Dialog trigger |
| `H` / `L` | 折叠/展开左侧 Schema 面板 (Vim 风格) | 自定义 |
| `J` / `K` | 下/上移动选中行 (Vim 风格，可选启用) | 自定义 |
| `Page Up` / `Page Down` | 快速翻页 | Pagination |
| `Home` / `End` | 跳转到首行 / 末行 | 自定义 |

---

## 11. 响应式与边界处理 (Responsive & Edge Cases)

* **最小视口：** 支持 1024×768 最小分辨率，低于此宽度时左侧栏自动折叠为图标模式 (44px)。
* **超宽屏：** 表格列自动填满可用空间，右侧留白不超过一列宽度。
* **超多列 (100+ 列)：** 性能不受影响（虚拟化仅渲染可见列）；左侧栏默认折叠嵌套字段。
* **超长字段值：** 单元格内单行截断，shadcn `Tooltip` 最大宽度 380px (Nova 紧凑)，超长内容在 Tooltip 内换行展示。
* **空单元格：** 显示灰色斜体 `null` (`--null-text`)，而不是空白 —— 空白无法区分「无数据」和「未加载」。

---

## 12. 无障碍 (Accessibility)

* shadcn 组件默认内置 WAI-ARIA 支持 — 所有交互元素支持键盘 Tab 聚焦，Focus 状态显示可见的 `--ring` 描边轮廓。
* 表格使用语义化 `<table>` 或 `role="grid"` + `aria-*` 属性。
* 行选中状态通过 `aria-selected` 暴露给屏幕阅读器。
* 颜色对比度符合 WCAG 2.1 AA 标准 (最低 4.5:1)。shadcn Nova 默认 Token 已满足此标准。
* 支持通过 `prefers-reduced-motion` 媒体查询关闭所有非功能性动画。

---

## 13. 主题切换 (Theme Switching)

使用 `next-themes` (或 TanStack Start 等价方案) 管理主题状态：

* **亮色 (Light)：** 使用 `:root` CSS 变量。
* **暗色 (Dark)：** 使用 `.dark` CSS 变量。
* **跟随系统：** 默认值，使用 `prefers-color-scheme` 媒体查询。
* **切换控件：** shadcn `DropdownMenu`，三个选项使用 shadcn `DropdownMenuCheckboxItem`。
* **持久化：** 用户偏好存储在 `localStorage`，跨会话保持。

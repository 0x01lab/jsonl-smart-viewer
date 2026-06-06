import { jsx, jsxs, Fragment } from "react/jsx-runtime";
import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { Button as Button$1 } from "@base-ui/react/button";
import { cva } from "class-variance-authority";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { Progress as Progress$1 } from "@base-ui/react/progress";
import { useReactTable, getFilteredRowModel, getSortedRowModel, getCoreRowModel, flexRender } from "@tanstack/react-table";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpDown, ArrowUp, ArrowDown, Filter, X, Search, GripVertical, Loader2Icon, OctagonXIcon, TriangleAlertIcon, InfoIcon, CircleCheckIcon } from "lucide-react";
import { Input as Input$1 } from "@base-ui/react/input";
import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { useSensors, useSensor, PointerSensor, KeyboardSensor, DndContext, closestCenter } from "@dnd-kit/core";
import { sortableKeyboardCoordinates, arrayMove, SortableContext, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { wrap } from "comlink";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { z } from "zod";
import { Toaster as Toaster$1, toast } from "sonner";
function cn(...inputs) {
  return twMerge(clsx(inputs));
}
const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/80",
        outline: "border-border bg-background hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50",
        secondary: "bg-secondary text-secondary-foreground hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_5%)] aria-expanded:bg-secondary aria-expanded:text-secondary-foreground",
        ghost: "hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:hover:bg-muted/50",
        destructive: "bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:hover:bg-destructive/30 dark:focus-visible:ring-destructive/40",
        link: "text-primary underline-offset-4 hover:underline"
      },
      size: {
        default: "h-8 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        xs: "h-6 gap-1 rounded-[min(var(--radius-md),10px)] px-2 text-xs in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 gap-1 rounded-[min(var(--radius-md),12px)] px-2.5 text-[0.8rem] in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-9 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        icon: "size-8",
        "icon-xs": "size-6 rounded-[min(var(--radius-md),10px)] in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-7 rounded-[min(var(--radius-md),12px)] in-data-[slot=button-group]:rounded-lg",
        "icon-lg": "size-9"
      }
    },
    defaultVariants: {
      variant: "default",
      size: "default"
    }
  }
);
function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}) {
  return /* @__PURE__ */ jsx(
    Button$1,
    {
      "data-slot": "button",
      className: cn(buttonVariants({ variant, size, className })),
      ...props
    }
  );
}
function Progress({
  className,
  children,
  value,
  ...props
}) {
  return /* @__PURE__ */ jsxs(
    Progress$1.Root,
    {
      value,
      "data-slot": "progress",
      className: cn("flex flex-wrap gap-3", className),
      ...props,
      children: [
        children,
        /* @__PURE__ */ jsx(ProgressTrack, { children: /* @__PURE__ */ jsx(ProgressIndicator, {}) })
      ]
    }
  );
}
function ProgressTrack({ className, ...props }) {
  return /* @__PURE__ */ jsx(
    Progress$1.Track,
    {
      className: cn(
        "relative flex h-1 w-full items-center overflow-x-hidden rounded-full bg-muted",
        className
      ),
      "data-slot": "progress-track",
      ...props
    }
  );
}
function ProgressIndicator({
  className,
  ...props
}) {
  return /* @__PURE__ */ jsx(
    Progress$1.Indicator,
    {
      "data-slot": "progress-indicator",
      className: cn("h-full bg-primary transition-all", className),
      ...props
    }
  );
}
function FileDropZone({ onFile, loading, error }) {
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef(null);
  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);
  const handleDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);
  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();
      setIsDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) onFile(file);
    },
    [onFile]
  );
  const handleInputChange = useCallback(
    (e) => {
      var _a;
      const file = (_a = e.target.files) == null ? void 0 : _a[0];
      if (file) onFile(file);
    },
    [onFile]
  );
  return /* @__PURE__ */ jsx("div", { className: "flex min-h-screen items-center justify-center", children: /* @__PURE__ */ jsxs("div", { className: "text-center", children: [
    /* @__PURE__ */ jsx("h1", { className: "text-lg font-medium text-foreground mb-6", children: "JSONL Smart Viewer" }),
    /* @__PURE__ */ jsxs(
      "div",
      {
        onDragOver: handleDragOver,
        onDragLeave: handleDragLeave,
        onDrop: handleDrop,
        onClick: () => {
          var _a;
          return (_a = inputRef.current) == null ? void 0 : _a.click();
        },
        className: `
            mx-auto max-w-md cursor-pointer rounded-xl border-2 p-8
            transition-colors duration-100
            ${isDragOver ? "border-primary bg-accent border-solid" : "border-border border-dashed"}
          `,
        children: [
          /* @__PURE__ */ jsx("p", { className: "text-sm text-muted-foreground mb-4", children: "拖拽 JSONL 文件到此处" }),
          /* @__PURE__ */ jsx(
            Button,
            {
              variant: "default",
              className: "h-9",
              onClick: (e) => {
                var _a;
                e.stopPropagation();
                (_a = inputRef.current) == null ? void 0 : _a.click();
              },
              children: "📂 选择文件"
            }
          ),
          /* @__PURE__ */ jsx(
            "input",
            {
              ref: inputRef,
              type: "file",
              accept: ".jsonl,.json,.log,.jsonl.gz",
              onChange: handleInputChange,
              className: "hidden",
              "aria-label": "选择文件"
            }
          )
        ]
      }
    ),
    /* @__PURE__ */ jsx("p", { className: "mt-4 text-xs text-muted-foreground", children: "支持: .jsonl / .json / .jsonl.gz  ·  100% 本地解析 · 隐私安全" }),
    loading && /* @__PURE__ */ jsxs("div", { className: "mt-6 max-w-xs mx-auto", children: [
      /* @__PURE__ */ jsx(Progress, { value: null, className: "h-1.5" }),
      /* @__PURE__ */ jsx("p", { className: "mt-2 text-xs text-muted-foreground", children: "正在扫描..." })
    ] }),
    error && /* @__PURE__ */ jsx("div", { className: "mt-4 text-sm text-destructive", children: error })
  ] }) });
}
function ColumnHeader({
  columnId,
  header,
  sortDirection,
  sortIndex,
  width,
  isRowNum,
  onSortToggle,
  onResizeStart,
  onResizeDoubleClick
}) {
  const handleClick = useCallback(
    (e) => {
      if (isRowNum) return;
      onSortToggle(columnId, e.shiftKey);
    },
    [columnId, isRowNum, onSortToggle]
  );
  const sortIcon = () => {
    if (sortDirection === void 0) return null;
    if (sortDirection === false)
      return /* @__PURE__ */ jsx(ArrowUp, { className: "h-3 w-3 text-primary" });
    return /* @__PURE__ */ jsx(ArrowDown, { className: "h-3 w-3 text-primary" });
  };
  return /* @__PURE__ */ jsxs(
    "div",
    {
      className: "relative flex items-center gap-1 px-2 py-1.5 select-none font-sans text-[13px] font-semibold",
      style: {
        width: isRowNum ? 52 : void 0,
        minWidth: isRowNum ? 52 : 40,
        background: sortDirection !== void 0 ? "var(--table-row-selected)" : void 0
      },
      children: [
        /* @__PURE__ */ jsxs(
          "div",
          {
            className: `flex items-center gap-1 flex-1 ${isRowNum ? "" : "cursor-pointer"}`,
            onClick: handleClick,
            children: [
              /* @__PURE__ */ jsx("span", { className: "truncate", children: header }),
              sortIcon(),
              sortIndex !== void 0 && sortDirection !== void 0 && /* @__PURE__ */ jsx("span", { className: "text-[10px] text-muted-foreground font-normal", children: sortIndex + 1 }),
              !isRowNum && sortDirection === void 0 && /* @__PURE__ */ jsx(ArrowUpDown, { className: "h-3 w-3 text-muted-foreground/40" })
            ]
          }
        ),
        !isRowNum && /* @__PURE__ */ jsx(
          "div",
          {
            className: "absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-primary/30 active:bg-primary/50 transition-colors",
            onMouseDown: (e) => onResizeStart(e, columnId, width),
            onDoubleClick: () => onResizeDoubleClick(columnId)
          }
        )
      ]
    }
  );
}
function Input({ className, type, ...props }) {
  return /* @__PURE__ */ jsx(
    Input$1,
    {
      type,
      "data-slot": "input",
      className: cn(
        "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        className
      ),
      ...props
    }
  );
}
function FilterPopover({
  columnType,
  currentValue,
  onApply,
  onClear
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [localValue, setLocalValue] = useState(currentValue);
  const handleOpen = useCallback(() => {
    setLocalValue(currentValue);
    setIsOpen(true);
  }, [currentValue]);
  const handleApply = useCallback(() => {
    if (localValue.trim()) {
      onApply(localValue.trim());
    } else {
      onClear();
    }
    setIsOpen(false);
  }, [localValue, onApply, onClear]);
  const handleClear = useCallback(() => {
    setLocalValue("");
    onClear();
    setIsOpen(false);
  }, [onClear]);
  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === "Enter") handleApply();
      if (e.key === "Escape") setIsOpen(false);
    },
    [handleApply]
  );
  const normalizedType = columnType.toLowerCase();
  return /* @__PURE__ */ jsxs("div", { className: "relative", children: [
    /* @__PURE__ */ jsx(
      "button",
      {
        className: `p-0.5 rounded hover:bg-muted/50 transition-colors ${currentValue ? "text-primary" : "text-muted-foreground/40"}`,
        onClick: handleOpen,
        title: "筛选",
        children: /* @__PURE__ */ jsx(Filter, { className: "h-3 w-3" })
      }
    ),
    isOpen && /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsx(
        "div",
        {
          className: "fixed inset-0 z-40",
          onClick: () => setIsOpen(false)
        }
      ),
      /* @__PURE__ */ jsxs(
        "div",
        {
          className: "absolute top-full left-0 z-50 mt-1 w-56 rounded-lg border border-border bg-popover p-3 shadow-lg",
          onKeyDown: handleKeyDown,
          children: [
            /* @__PURE__ */ jsx("div", { className: "mb-2 text-xs font-medium text-muted-foreground", children: "筛选" }),
            normalizedType === "string" && /* @__PURE__ */ jsx("div", { className: "space-y-2", children: /* @__PURE__ */ jsx(
              Input,
              {
                placeholder: "包含文本...",
                value: localValue,
                onChange: (e) => setLocalValue(e.target.value),
                className: "h-7 text-xs",
                autoFocus: true
              }
            ) }),
            normalizedType === "number" && /* @__PURE__ */ jsxs("div", { className: "space-y-2", children: [
              /* @__PURE__ */ jsxs(
                "select",
                {
                  className: "w-full h-7 rounded border border-border bg-background px-2 text-xs",
                  value: localValue.startsWith(">") ? "gt" : localValue.startsWith("<") ? "lt" : "eq",
                  onChange: (e) => {
                    const prefix = e.target.value === "gt" ? ">" : e.target.value === "lt" ? "<" : "=";
                    const existingVal = localValue.replace(/^[><=]/, "");
                    setLocalValue(prefix + existingVal);
                  },
                  children: [
                    /* @__PURE__ */ jsx("option", { value: "eq", children: "等于" }),
                    /* @__PURE__ */ jsx("option", { value: "gt", children: "大于" }),
                    /* @__PURE__ */ jsx("option", { value: "lt", children: "小于" })
                  ]
                }
              ),
              /* @__PURE__ */ jsx(
                Input,
                {
                  placeholder: "输入数值...",
                  value: localValue.replace(/^[><=]/, ""),
                  onChange: (e) => {
                    var _a;
                    const prefix = ((_a = localValue.match(/^[><=]/)) == null ? void 0 : _a[0]) ?? "=";
                    setLocalValue(prefix + e.target.value);
                  },
                  className: "h-7 text-xs",
                  type: "number",
                  autoFocus: true
                }
              )
            ] }),
            normalizedType === "boolean" && /* @__PURE__ */ jsx("div", { className: "space-y-1", children: [
              { label: "全部", value: "" },
              { label: "true", value: "true" },
              { label: "false", value: "false" }
            ].map((opt) => /* @__PURE__ */ jsxs(
              "label",
              {
                className: "flex items-center gap-2 px-2 py-1 rounded hover:bg-muted/50 cursor-pointer text-xs",
                children: [
                  /* @__PURE__ */ jsx(
                    "input",
                    {
                      type: "radio",
                      name: `filter-bool-${normalizedType}`,
                      checked: localValue === opt.value,
                      onChange: () => setLocalValue(opt.value),
                      className: "accent-primary"
                    }
                  ),
                  opt.label
                ]
              },
              opt.value
            )) }),
            !["string", "number", "boolean"].includes(normalizedType) && /* @__PURE__ */ jsx(
              Input,
              {
                placeholder: "筛选值...",
                value: localValue,
                onChange: (e) => setLocalValue(e.target.value),
                className: "h-7 text-xs",
                autoFocus: true
              }
            ),
            /* @__PURE__ */ jsxs("div", { className: "mt-3 flex items-center justify-between", children: [
              /* @__PURE__ */ jsxs(
                Button,
                {
                  variant: "ghost",
                  size: "sm",
                  className: "h-6 text-xs",
                  onClick: handleClear,
                  children: [
                    /* @__PURE__ */ jsx(X, { className: "mr-1 h-3 w-3" }),
                    "清除"
                  ]
                }
              ),
              /* @__PURE__ */ jsx(Button, { size: "sm", className: "h-6 text-xs", onClick: handleApply, children: "应用" })
            ] })
          ]
        }
      )
    ] })
  ] });
}
const badgeVariants = cva(
  "group/badge inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-4xl border border-transparent px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-all focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground [a]:hover:bg-primary/80",
        secondary: "bg-secondary text-secondary-foreground [a]:hover:bg-secondary/80",
        destructive: "bg-destructive/10 text-destructive focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:focus-visible:ring-destructive/40 [a]:hover:bg-destructive/20",
        outline: "border-border text-foreground [a]:hover:bg-muted [a]:hover:text-muted-foreground",
        ghost: "hover:bg-muted hover:text-muted-foreground dark:hover:bg-muted/50",
        link: "text-primary underline-offset-4 hover:underline"
      }
    },
    defaultVariants: {
      variant: "default"
    }
  }
);
function Badge({
  className,
  variant = "default",
  render,
  ...props
}) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps(
      {
        className: cn(badgeVariants({ variant }), className)
      },
      props
    ),
    render,
    state: {
      slot: "badge",
      variant
    }
  });
}
function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}
function CellRenderer({ value }) {
  if (value === null || value === void 0) {
    return /* @__PURE__ */ jsx("span", { className: "italic text-[var(--null-text)]", children: "null" });
  }
  if (typeof value === "boolean") {
    return /* @__PURE__ */ jsxs(
      Badge,
      {
        variant: value ? "default" : "secondary",
        className: "text-[11px]",
        children: [
          "● ",
          String(value)
        ]
      }
    );
  }
  if (typeof value === "number") {
    return /* @__PURE__ */ jsx("span", { className: "tabular-nums", children: value.toLocaleString() });
  }
  if (typeof value === "object") {
    const fields = Array.isArray(value) ? value.length : Object.keys(value).length;
    return /* @__PURE__ */ jsx(Badge, { variant: "outline", className: "text-[11px]", children: Array.isArray(value) ? `[${fields}]` : `{${fields} fields}` });
  }
  const str = String(value);
  if (str.length > 50)
    return /* @__PURE__ */ jsxs("span", { title: str, children: [
      str.slice(0, 50),
      "…"
    ] });
  return /* @__PURE__ */ jsx(Fragment, { children: str });
}
const MIN_COLUMN_WIDTH = 40;
function useColumnResize({ table }) {
  const isResizing = useRef(false);
  const resizingColumnId = useRef(null);
  const startX = useRef(0);
  const startWidth = useRef(0);
  const handleResizeStart = useCallback(
    (e, columnId, currentWidth) => {
      e.preventDefault();
      e.stopPropagation();
      isResizing.current = true;
      resizingColumnId.current = columnId;
      startX.current = e.clientX;
      startWidth.current = currentWidth;
      const handleMouseMove = (moveEvent) => {
        if (!isResizing.current) return;
        const diff = moveEvent.clientX - startX.current;
        const newWidth = Math.max(MIN_COLUMN_WIDTH, startWidth.current + diff);
        table.setColumnSizing((prev) => ({
          ...prev,
          [resizingColumnId.current]: newWidth
        }));
      };
      const handleMouseUp = () => {
        isResizing.current = false;
        resizingColumnId.current = null;
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [table]
  );
  const handleDoubleClick = useCallback(
    (columnId) => {
      table.setColumnSizing((prev) => ({
        ...prev,
        [columnId]: 150
      }));
    },
    [table]
  );
  return { handleResizeStart, handleDoubleClick };
}
const PAGE_SIZE$1 = 50;
function VirtualDataTable({
  schema,
  totalRows,
  fileId,
  page,
  getRows,
  sorting,
  columnFilters,
  columnVisibility,
  columnOrder,
  selectedRowIndex,
  onSortingChange,
  onColumnFiltersChange,
  onSelectedRowChange
}) {
  var _a;
  const scrollRef = useRef(null);
  const headerScrollRef = useRef(null);
  useEffect(() => {
    const scrollEl = scrollRef.current;
    const headerEl = headerScrollRef.current;
    if (!scrollEl || !headerEl) return;
    const handleScroll = () => {
      headerEl.scrollLeft = scrollEl.scrollLeft;
    };
    scrollEl.addEventListener("scroll", handleScroll, { passive: true });
    return () => scrollEl.removeEventListener("scroll", handleScroll);
  }, []);
  const start = (page - 1) * PAGE_SIZE$1;
  const end = Math.min(start + PAGE_SIZE$1, totalRows);
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["rows", fileId, page],
    queryFn: () => getRows(start, end),
    enabled: !!fileId && start < totalRows,
    staleTime: Infinity,
    gcTime: 5 * 60 * 1e3,
    placeholderData: (prev) => prev
  });
  const columns = useMemo(() => {
    const rowNumCol = {
      id: "#",
      size: 52,
      header: "#",
      cell: ({ row }) => /* @__PURE__ */ jsx("span", { className: "text-xs text-muted-foreground", children: row.original.index + 1 }),
      enableSorting: false,
      enableResizing: false
    };
    const dataCols = schema.columns.map((col) => ({
      id: col.key,
      accessorKey: `data.${col.key}`,
      header: col.key,
      cell: ({ row }) => {
        if (row.original.error) return null;
        return /* @__PURE__ */ jsx(CellRenderer, { value: row.original.data[col.key] });
      },
      size: 150,
      minSize: 40
    }));
    return [rowNumCol, ...dataCols];
  }, [schema]);
  const table = useReactTable({
    data: rows,
    columns,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      columnOrder
    },
    onSortingChange,
    onColumnFiltersChange,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    enableSortingRemoval: true,
    enableMultiSort: true,
    manualPagination: true,
    pageCount: -1
  });
  const { handleResizeStart, handleDoubleClick } = useColumnResize({ table });
  const handleSortToggle = useCallback(
    (columnId, shiftKey) => {
      const column = table.getColumn(columnId);
      if (!column) return;
      const currentSort = sorting.find((s) => s.id === columnId);
      let newSorting;
      if (shiftKey) {
        if (currentSort) {
          if (currentSort.desc) {
            newSorting = sorting.filter((s) => s.id !== columnId);
          } else {
            newSorting = sorting.map(
              (s) => s.id === columnId ? { ...s, desc: true } : s
            );
          }
        } else {
          newSorting = [...sorting, { id: columnId, desc: false }];
        }
      } else {
        if (currentSort) {
          if (currentSort.desc) {
            newSorting = [];
          } else {
            newSorting = [{ id: columnId, desc: true }];
          }
        } else {
          newSorting = [{ id: columnId, desc: false }];
        }
      }
      onSortingChange(newSorting);
    },
    [sorting, table, onSortingChange]
  );
  const handleRowClick = useCallback(
    (index) => {
      onSelectedRowChange(selectedRowIndex === index ? null : index);
    },
    [selectedRowIndex, onSelectedRowChange]
  );
  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        const next = selectedRowIndex === null ? 0 : Math.min(selectedRowIndex + 1, totalRows - 1);
        onSelectedRowChange(next);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        const prev = selectedRowIndex === null ? 0 : Math.max(selectedRowIndex - 1, 0);
        onSelectedRowChange(prev);
      } else if (e.key === "Escape") {
        onSelectedRowChange(null);
      }
    },
    [selectedRowIndex, totalRows, onSelectedRowChange]
  );
  const headerGroups = table.getHeaderGroups();
  const headers = ((_a = headerGroups[0]) == null ? void 0 : _a.headers) ?? [];
  const tableRows = table.getRowModel().rows;
  const totalWidth = useMemo(() => {
    return table.getVisibleLeafColumns().reduce((sum, col) => sum + col.getSize(), 0);
  }, [table]);
  return /* @__PURE__ */ jsxs(
    "div",
    {
      className: "flex-1 flex flex-col overflow-hidden",
      onKeyDown: handleKeyDown,
      tabIndex: 0,
      children: [
        /* @__PURE__ */ jsx(
          "div",
          {
            ref: headerScrollRef,
            className: "shrink-0 overflow-hidden bg-[var(--table-header-bg)] border-b border-[var(--table-grid-line)]",
            children: /* @__PURE__ */ jsx("div", { style: { width: totalWidth, minWidth: "100%" }, children: /* @__PURE__ */ jsx("div", { className: "flex", children: headers.map((header) => {
              const colId = header.column.id;
              const isRowNum = colId === "#";
              const colDef = schema.columns.find((c) => c.key === colId);
              const sortState = sorting.find((s) => s.id === colId);
              const filterState = columnFilters.find((f) => f.id === colId);
              const width = header.getSize();
              return /* @__PURE__ */ jsx(
                "div",
                {
                  className: "border-r border-[var(--table-grid-line)] last:border-r-0 shrink-0",
                  style: {
                    width: isRowNum ? 52 : width,
                    minWidth: isRowNum ? 52 : 40
                  },
                  children: /* @__PURE__ */ jsxs("div", { className: "flex items-center", children: [
                    /* @__PURE__ */ jsx("div", { className: "flex-1", children: /* @__PURE__ */ jsx(
                      ColumnHeader,
                      {
                        columnId: colId,
                        header: isRowNum ? "#" : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        ),
                        sortDirection: sortState ? sortState.desc : void 0,
                        sortIndex: sorting.length > 1 && sortState ? sorting.indexOf(sortState) : void 0,
                        width,
                        isRowNum,
                        onSortToggle: handleSortToggle,
                        onResizeStart: handleResizeStart,
                        onResizeDoubleClick: handleDoubleClick
                      }
                    ) }),
                    !isRowNum && colDef && /* @__PURE__ */ jsx("div", { className: "pr-1", children: /* @__PURE__ */ jsx(
                      FilterPopover,
                      {
                        columnType: colDef.inferred_type,
                        currentValue: filterState ? String(filterState.value) : "",
                        onApply: (value) => {
                          const newFilters = columnFilters.filter(
                            (f) => f.id !== colId
                          );
                          newFilters.push({ id: colId, value });
                          onColumnFiltersChange(newFilters);
                        },
                        onClear: () => {
                          const newFilters = columnFilters.filter(
                            (f) => f.id !== colId
                          );
                          onColumnFiltersChange(newFilters);
                        }
                      }
                    ) })
                  ] })
                },
                header.id
              );
            }) }) })
          }
        ),
        /* @__PURE__ */ jsx("div", { ref: scrollRef, className: "flex-1 overflow-auto", children: isLoading ? /* @__PURE__ */ jsx("div", { className: "flex items-center justify-center py-12 text-muted-foreground text-sm", children: "加载中..." }) : tableRows.length === 0 ? /* @__PURE__ */ jsx("div", { className: "flex items-center justify-center py-12 text-muted-foreground text-sm", children: "无匹配行" }) : /* @__PURE__ */ jsx("div", { style: { width: totalWidth, minWidth: "100%" }, children: tableRows.map((row) => {
          const isError = !!row.original.error;
          const isSelected = row.original.index === selectedRowIndex;
          const isOdd = row.original.index % 2 === 1;
          const bgColor = isError ? "#ef444418" : isSelected ? "#3b82f622" : isOdd ? "var(--table-row-odd)" : "var(--table-row-even)";
          return /* @__PURE__ */ jsx(
            "div",
            {
              className: "flex items-center border-b border-[var(--table-grid-line)] font-mono text-[13px] cursor-pointer hover:bg-[var(--table-row-hover)]",
              style: { height: 32, background: bgColor },
              onClick: () => handleRowClick(row.original.index),
              children: row.getVisibleCells().map((cell) => {
                const colId = cell.column.id;
                const width = colId === "#" ? 52 : cell.column.getSize();
                if (isError && colId !== "#") {
                  return /* @__PURE__ */ jsx(
                    "div",
                    {
                      className: "px-2 shrink-0 overflow-hidden",
                      style: { width, minWidth: colId === "#" ? 52 : 40 },
                      children: /* @__PURE__ */ jsx("span", { className: "text-xs text-[var(--color-error)] italic truncate block", children: row.original.error })
                    },
                    cell.id
                  );
                }
                return /* @__PURE__ */ jsx(
                  "div",
                  {
                    className: "px-2 shrink-0 overflow-hidden",
                    style: { width, minWidth: colId === "#" ? 52 : 40 },
                    children: flexRender(cell.column.columnDef.cell, cell.getContext())
                  },
                  cell.id
                );
              })
            },
            row.id
          );
        }) }) })
      ]
    }
  );
}
const TYPE_COLORS = {
  string: { bg: "bg-[#22c55e20]", text: "text-[#22c55e]" },
  number: { bg: "bg-[#3b82f620]", text: "text-[#3b82f6]" },
  boolean: { bg: "bg-[#f59e0b20]", text: "text-[#f59e0b]" },
  array: { bg: "bg-[#a855f720]", text: "text-[#a855f7]" },
  object: { bg: "bg-[#ef444420]", text: "text-[#ef4444]" },
  null: { bg: "bg-[#88888820]", text: "text-[#888]" },
  mixed: { bg: "bg-[#88888820]", text: "text-[#888]" }
};
function getTypeColor(type) {
  return TYPE_COLORS[type.toLowerCase()] ?? TYPE_COLORS.mixed;
}
function SortableColumnItem({
  col,
  isVisible,
  onToggleVisibility
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: col.key });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1
  };
  const color = getTypeColor(col.inferred_type);
  return /* @__PURE__ */ jsxs(
    "div",
    {
      ref: setNodeRef,
      style,
      className: `flex items-center gap-2 px-2.5 py-1.5 rounded-md mx-1.5 transition-colors ${isVisible ? "" : "opacity-50"} hover:bg-muted/30`,
      children: [
        /* @__PURE__ */ jsx(
          "input",
          {
            type: "checkbox",
            checked: isVisible,
            onChange: () => onToggleVisibility(col.key),
            className: "accent-primary w-3.5 h-3.5 shrink-0"
          }
        ),
        /* @__PURE__ */ jsx("span", { className: "flex-1 text-xs font-mono truncate", children: col.key }),
        /* @__PURE__ */ jsx(
          "span",
          {
            className: `text-[10px] px-1.5 py-0.5 rounded ${color.bg} ${color.text} shrink-0`,
            children: col.inferred_type.toLowerCase()
          }
        ),
        /* @__PURE__ */ jsx(
          "button",
          {
            className: "text-muted-foreground/60 hover:text-muted-foreground cursor-grab shrink-0",
            ...attributes,
            ...listeners,
            children: /* @__PURE__ */ jsx(GripVertical, { className: "h-3.5 w-3.5" })
          }
        )
      ]
    }
  );
}
function SchemaPanel({
  columns,
  columnVisibility,
  columnOrder,
  onVisibilityChange,
  onOrderChange
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [collapsed, setCollapsed] = useState(false);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates
    })
  );
  const orderedColumns = useMemo(() => {
    if (columnOrder.length === 0) return columns;
    const colMap = new Map(columns.map((c) => [c.key, c]));
    const ordered = columnOrder.map((id) => colMap.get(id)).filter(Boolean);
    const seen = new Set(columnOrder);
    for (const col of columns) {
      if (!seen.has(col.key)) ordered.push(col);
    }
    return ordered;
  }, [columns, columnOrder]);
  const filteredColumns = useMemo(() => {
    if (!searchQuery.trim()) return orderedColumns;
    const q = searchQuery.toLowerCase();
    return orderedColumns.filter((col) => col.key.toLowerCase().includes(q));
  }, [orderedColumns, searchQuery]);
  const typeCounts = useMemo(() => {
    const counts = {};
    for (const col of columns) {
      const t = col.inferred_type.toLowerCase();
      counts[t] = (counts[t] || 0) + 1;
    }
    return counts;
  }, [columns]);
  const handleToggleVisibility = useCallback(
    (columnId) => {
      const isVisible = columnVisibility[columnId] !== false;
      onVisibilityChange(columnId, !isVisible);
    },
    [columnVisibility, onVisibilityChange]
  );
  const handleDragEnd = useCallback(
    (event) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const oldIndex = columnOrder.indexOf(String(active.id));
      const newIndex = columnOrder.indexOf(String(over.id));
      if (oldIndex === -1 || newIndex === -1) return;
      const newOrder = arrayMove(columnOrder, oldIndex, newIndex);
      onOrderChange(newOrder);
    },
    [columnOrder, onOrderChange]
  );
  if (collapsed) {
    return /* @__PURE__ */ jsx("div", { className: "w-8 min-w-8 border-r border-[var(--table-grid-line)] bg-[var(--table-header-bg)] flex flex-col items-center pt-2", children: /* @__PURE__ */ jsx(
      "button",
      {
        className: "text-xs text-muted-foreground hover:text-foreground",
        onClick: () => setCollapsed(false),
        title: "展开 Schema 面板",
        children: "▶"
      }
    ) });
  }
  return /* @__PURE__ */ jsxs("div", { className: "w-[220px] min-w-[220px] border-r border-[var(--table-grid-line)] bg-[var(--table-header-bg)] flex flex-col", children: [
    /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between px-2.5 py-2 border-b border-[var(--table-grid-line)]", children: [
      /* @__PURE__ */ jsx("span", { className: "font-semibold text-xs", children: "Schema" }),
      /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-1", children: [
        /* @__PURE__ */ jsxs("span", { className: "text-[11px] text-muted-foreground", children: [
          columns.length,
          " 字段"
        ] }),
        /* @__PURE__ */ jsx(
          "button",
          {
            className: "text-xs text-muted-foreground hover:text-foreground ml-1",
            onClick: () => setCollapsed(true),
            title: "收起",
            children: "◀"
          }
        )
      ] })
    ] }),
    /* @__PURE__ */ jsx("div", { className: "px-2.5 py-1.5 border-b border-[var(--table-grid-line)]/50", children: /* @__PURE__ */ jsxs("div", { className: "relative", children: [
      /* @__PURE__ */ jsx(Search, { className: "absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" }),
      /* @__PURE__ */ jsx(
        Input,
        {
          placeholder: "搜索字段...",
          value: searchQuery,
          onChange: (e) => setSearchQuery(e.target.value),
          className: "h-6 pl-7 text-xs"
        }
      )
    ] }) }),
    /* @__PURE__ */ jsx("div", { className: "flex-1 overflow-y-auto py-1", children: /* @__PURE__ */ jsx(
      DndContext,
      {
        sensors,
        collisionDetection: closestCenter,
        onDragEnd: handleDragEnd,
        children: /* @__PURE__ */ jsx(
          SortableContext,
          {
            items: filteredColumns.map((c) => c.key),
            strategy: verticalListSortingStrategy,
            children: filteredColumns.map((col) => /* @__PURE__ */ jsx(
              SortableColumnItem,
              {
                col,
                isVisible: columnVisibility[col.key] !== false,
                onToggleVisibility: handleToggleVisibility
              },
              col.key
            ))
          }
        )
      }
    ) }),
    /* @__PURE__ */ jsx("div", { className: "px-2.5 py-2 border-t border-[var(--table-grid-line)] flex flex-wrap gap-1", children: Object.entries(typeCounts).map(([type, count]) => {
      const color = getTypeColor(type);
      return /* @__PURE__ */ jsxs(
        "span",
        {
          className: `text-[10px] px-1.5 py-0.5 rounded cursor-default ${color.bg} ${color.text}`,
          children: [
            type,
            " (",
            count,
            ")"
          ]
        },
        type
      );
    }) })
  ] });
}
function Toolbar({
  fileName,
  fileSize,
  columnCount,
  onReset
}) {
  return /* @__PURE__ */ jsxs("div", { className: "flex h-10 items-center justify-between border-b border-[var(--table-grid-line)] bg-[var(--table-header-bg)] px-3", children: [
    /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2", children: [
      /* @__PURE__ */ jsxs(
        Button,
        {
          variant: "ghost",
          size: "sm",
          className: "h-7 font-sans text-sm font-medium",
          onClick: onReset,
          children: [
            "📄 ",
            fileName
          ]
        }
      ),
      /* @__PURE__ */ jsxs("span", { className: "text-xs text-muted-foreground", children: [
        "(",
        formatFileSize(fileSize),
        ") · ",
        columnCount,
        " 列"
      ] })
    ] }),
    /* @__PURE__ */ jsx("div", { className: "flex items-center gap-2", children: /* @__PURE__ */ jsxs(
      Button,
      {
        variant: "ghost",
        size: "sm",
        className: "h-7 gap-1.5 text-xs text-muted-foreground opacity-50 cursor-not-allowed",
        disabled: true,
        children: [
          /* @__PURE__ */ jsx(Search, { className: "h-3.5 w-3.5" }),
          "搜索",
          /* @__PURE__ */ jsx("kbd", { className: "ml-1 rounded bg-muted px-1 py-0.5 text-[10px] font-mono", children: "⌘F" })
        ]
      }
    ) })
  ] });
}
const PAGE_SIZE = 50;
function StatusBar({
  totalRows,
  errorRows,
  page,
  selectedRowIndex,
  onPageChange,
  loadTimeMs,
  memoryEstimateMB
}) {
  const totalPages = Math.max(1, Math.ceil(totalRows / PAGE_SIZE));
  return /* @__PURE__ */ jsxs("div", { className: "flex h-7 items-center justify-between border-t border-[var(--table-grid-line)] bg-[var(--table-header-bg)] px-3 text-xs text-muted-foreground font-sans", children: [
    /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3", children: [
      /* @__PURE__ */ jsxs("span", { children: [
        "📊 共 ",
        totalRows.toLocaleString(),
        " 行"
      ] }),
      errorRows > 0 && /* @__PURE__ */ jsxs("span", { className: "text-[var(--color-error)]", children: [
        "⚠ 错误: ",
        errorRows,
        " 行"
      ] }),
      memoryEstimateMB !== void 0 && /* @__PURE__ */ jsxs("span", { children: [
        "💾 ~",
        memoryEstimateMB,
        "MB"
      ] })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3", children: [
      totalPages > 1 && /* @__PURE__ */ jsxs(Fragment, { children: [
        /* @__PURE__ */ jsx(
          Button,
          {
            variant: "ghost",
            size: "sm",
            className: "h-5 px-1 text-xs",
            disabled: page <= 1,
            onClick: () => onPageChange(page - 1),
            children: "◀"
          }
        ),
        /* @__PURE__ */ jsxs("span", { children: [
          page,
          " / ",
          totalPages
        ] }),
        /* @__PURE__ */ jsx(
          Button,
          {
            variant: "ghost",
            size: "sm",
            className: "h-5 px-1 text-xs",
            disabled: page >= totalPages,
            onClick: () => onPageChange(page + 1),
            children: "▶"
          }
        )
      ] }),
      selectedRowIndex !== null && /* @__PURE__ */ jsxs("span", { children: [
        "选中: #",
        selectedRowIndex + 1
      ] }),
      loadTimeMs !== void 0 && /* @__PURE__ */ jsxs("span", { children: [
        "⏱ ",
        loadTimeMs,
        "ms"
      ] })
    ] })
  ] });
}
function useJsonlWorker() {
  const workerRef = useRef(null);
  const apiRef = useRef(null);
  const [status, setStatus] = useState("idle");
  const [fileInfo, setFileInfo] = useState(null);
  const [error, setError] = useState(null);
  const [fileId, setFileId] = useState(null);
  const loadFile = useCallback(async (file) => {
    setStatus("loading");
    setError(null);
    try {
      if (!workerRef.current) {
        const worker = new Worker(
          new URL("./jsonl.worker.ts", import.meta.url),
          { type: "module" }
        );
        workerRef.current = worker;
        apiRef.current = wrap(worker);
      }
      const result = await apiRef.current.initFile(file);
      setFileInfo({
        totalRows: result.total_rows,
        errorRows: result.error_rows,
        schema: result
      });
      setFileId(`${file.name}-${file.size}`);
      setStatus("ready");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
      setStatus("error");
    }
  }, []);
  const getRows = useCallback(
    async (start, end) => {
      if (!apiRef.current) throw new Error("Worker not initialized");
      return apiRef.current.getRows(start, end);
    },
    []
  );
  const reset = useCallback(() => {
    var _a;
    (_a = workerRef.current) == null ? void 0 : _a.terminate();
    workerRef.current = null;
    apiRef.current = null;
    setStatus("idle");
    setFileInfo(null);
    setError(null);
    setFileId(null);
  }, []);
  return { status, fileInfo, fileId, error, loadFile, getRows, reset };
}
z.object({
  /** Sorting state: "col:asc,col2:desc" */
  sortBy: z.string().optional(),
  /** Column filters: "col:op:value,col2:op:value" */
  filter: z.string().optional(),
  /** Visible columns: "col1,col2,col3" */
  cols: z.string().optional(),
  /** Current page number (1-based) */
  page: z.number().optional(),
  /** Selected row index (zero-based, global) */
  selectedRow: z.number().optional()
});
function parseSortBy(sortBy) {
  if (!sortBy) return [];
  return sortBy.split(",").filter(Boolean).map((part) => {
    const [id, dir] = part.split(":");
    return { id, desc: dir === "desc" };
  }).filter((s) => s.id);
}
function serializeSortBy(sorting) {
  if (sorting.length === 0) return void 0;
  return sorting.map((s) => `${s.id}:${s.desc ? "desc" : "asc"}`).join(",");
}
function parseFilter(filter) {
  if (!filter) return {};
  const result = {};
  filter.split(",").forEach((part) => {
    const colonIdx = part.indexOf(":");
    if (colonIdx === -1) return;
    const col = part.slice(0, colonIdx);
    const value = part.slice(colonIdx + 1);
    result[col] = value;
  });
  return result;
}
function serializeFilter(filters) {
  const entries = Object.entries(filters).filter(([, v]) => v !== "");
  if (entries.length === 0) return void 0;
  return entries.map(([col, val]) => `${col}:${val}`).join(",");
}
function parseCols(cols) {
  if (!cols) return void 0;
  const parsed = cols.split(",").filter(Boolean);
  return parsed.length > 0 ? parsed : void 0;
}
function serializeCols(cols) {
  if (!cols || cols.length === 0) return void 0;
  return cols.join(",");
}
function defaultVisibility(columnIds) {
  const vis = {};
  for (const id of columnIds) {
    vis[id] = true;
  }
  return vis;
}
function useTableState({ columnIds }) {
  const navigate = useNavigate();
  const routerState = useRouterState();
  const search = routerState.location.search;
  const page = useMemo(() => {
    const val = search.page;
    return typeof val === "number" && val > 0 ? val : 1;
  }, [search.page]);
  const sorting = useMemo(
    () => parseSortBy(search.sortBy),
    [search.sortBy]
  );
  const columnFilters = useMemo(() => {
    const parsed = parseFilter(search.filter);
    return Object.entries(parsed).map(([id, value]) => ({ id, value }));
  }, [search.filter]);
  const columnVisibility = useMemo(() => {
    const cols = parseCols(search.cols);
    if (!cols) return defaultVisibility(columnIds);
    const vis = {};
    for (const id of columnIds) {
      vis[id] = cols.includes(id);
    }
    return vis;
  }, [search.cols, columnIds]);
  const columnOrder = useMemo(() => {
    return [...columnIds];
  }, [columnIds]);
  const selectedRowIndex = useMemo(() => {
    const val = search.selectedRow;
    return typeof val === "number" ? val : null;
  }, [search.selectedRow]);
  const updateUrl = useCallback(
    (params) => {
      void navigate({
        to: ".",
        search: (prev) => ({
          ...prev,
          ...params
        }),
        replace: true
      });
    },
    [navigate]
  );
  const onPageChange = useCallback(
    (newPage) => {
      updateUrl({ page: newPage > 1 ? newPage : void 0, selectedRow: void 0 });
    },
    [updateUrl]
  );
  const onSortingChange = useCallback(
    (updaterOrValue) => {
      const newSorting = typeof updaterOrValue === "function" ? updaterOrValue(sorting) : updaterOrValue;
      updateUrl({ sortBy: serializeSortBy(newSorting) });
    },
    [sorting, updateUrl]
  );
  const onColumnFiltersChange = useCallback(
    (updaterOrValue) => {
      const newFilters = typeof updaterOrValue === "function" ? updaterOrValue(columnFilters) : updaterOrValue;
      const filterMap = {};
      for (const f of newFilters) {
        filterMap[f.id] = String(f.value);
      }
      updateUrl({ filter: serializeFilter(filterMap) });
    },
    [columnFilters, updateUrl]
  );
  const onColumnVisibilityChange = useCallback(
    (updaterOrValue) => {
      const newVisibility = typeof updaterOrValue === "function" ? updaterOrValue(columnVisibility) : updaterOrValue;
      const visibleCols = columnIds.filter(
        (id) => newVisibility[id] !== false
      );
      updateUrl({ cols: serializeCols(visibleCols) });
    },
    [columnVisibility, columnIds, updateUrl]
  );
  const onColumnOrderChange = useCallback(
    (newOrder) => {
      const visibleCols = newOrder.filter(
        (id) => columnVisibility[id] !== false
      );
      updateUrl({ cols: serializeCols(visibleCols) });
    },
    [columnVisibility, updateUrl]
  );
  const onSelectedRowChange = useCallback(
    (index) => {
      updateUrl({ selectedRow: index ?? void 0 });
    },
    [updateUrl]
  );
  return {
    page,
    sorting,
    columnFilters,
    columnVisibility,
    columnOrder,
    selectedRowIndex,
    onPageChange,
    onSortingChange,
    onColumnFiltersChange,
    onColumnVisibilityChange,
    onColumnOrderChange,
    onSelectedRowChange
  };
}
const Toaster = ({ ...props }) => {
  return /* @__PURE__ */ jsx(
    Toaster$1,
    {
      className: "toaster group",
      icons: {
        success: /* @__PURE__ */ jsx(CircleCheckIcon, { className: "size-4" }),
        info: /* @__PURE__ */ jsx(InfoIcon, { className: "size-4" }),
        warning: /* @__PURE__ */ jsx(TriangleAlertIcon, { className: "size-4" }),
        error: /* @__PURE__ */ jsx(OctagonXIcon, { className: "size-4" }),
        loading: /* @__PURE__ */ jsx(Loader2Icon, { className: "size-4 animate-spin" })
      },
      style: {
        "--normal-bg": "var(--popover)",
        "--normal-text": "var(--popover-foreground)",
        "--normal-border": "var(--border)",
        "--border-radius": "var(--radius)"
      },
      toastOptions: {
        classNames: {
          toast: "cn-toast"
        }
      },
      ...props
    }
  );
};
function HomePage() {
  const {
    status,
    fileInfo,
    fileId,
    error,
    loadFile,
    getRows,
    reset
  } = useJsonlWorker();
  const [file, setFile] = useState(null);
  const columnIds = fileInfo ? fileInfo.schema.columns.map((c) => c.key) : [];
  const {
    page,
    sorting,
    columnFilters,
    columnVisibility,
    columnOrder,
    selectedRowIndex,
    onPageChange,
    onSortingChange,
    onColumnFiltersChange,
    onColumnVisibilityChange,
    onColumnOrderChange,
    onSelectedRowChange
  } = useTableState({
    columnIds
  });
  const handleFile = useCallback(async (newFile) => {
    setFile(newFile);
    onSelectedRowChange(null);
    try {
      await loadFile(newFile);
      toast.success("文件加载完成");
    } catch (err) {
      toast.error(`加载失败: ${err instanceof Error ? err.message : "未知错误"}`);
    }
  }, [loadFile, onSelectedRowChange]);
  const handleReset = useCallback(() => {
    reset();
    setFile(null);
  }, [reset]);
  const handleVisibilityChange = useCallback((columnId, visible) => {
    onColumnVisibilityChange((prev) => ({
      ...prev,
      [columnId]: visible
    }));
  }, [onColumnVisibilityChange]);
  if (status !== "ready" || !fileInfo) {
    return /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsx(Toaster, {}),
      /* @__PURE__ */ jsx(FileDropZone, { onFile: handleFile, loading: status === "loading", error: status === "error" ? error : null })
    ] });
  }
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsx(Toaster, {}),
    /* @__PURE__ */ jsxs("div", { className: "flex h-screen flex-col", children: [
      /* @__PURE__ */ jsx(Toolbar, { fileName: (file == null ? void 0 : file.name) ?? "unknown.jsonl", fileSize: (file == null ? void 0 : file.size) ?? 0, columnCount: fileInfo.schema.columns.length, onReset: handleReset }),
      /* @__PURE__ */ jsxs("div", { className: "flex flex-1 overflow-hidden", children: [
        /* @__PURE__ */ jsx(SchemaPanel, { columns: fileInfo.schema.columns, columnVisibility, columnOrder, onVisibilityChange: handleVisibilityChange, onOrderChange: onColumnOrderChange }),
        /* @__PURE__ */ jsx(VirtualDataTable, { schema: fileInfo.schema, totalRows: fileInfo.totalRows, fileId, page, getRows, sorting, columnFilters, columnVisibility, columnOrder, selectedRowIndex, onSortingChange, onColumnFiltersChange, onColumnVisibilityChange, onColumnOrderChange, onSelectedRowChange })
      ] }),
      /* @__PURE__ */ jsx(StatusBar, { totalRows: fileInfo.totalRows, errorRows: fileInfo.errorRows, page, selectedRowIndex, onPageChange })
    ] })
  ] });
}
export {
  HomePage as component
};

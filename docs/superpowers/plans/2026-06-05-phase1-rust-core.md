# Phase 1: Rust Core Parser — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a pure Rust JSONL parsing library (`jsonl-core`) with newline scanning, schema extraction, and on-demand row parsing, wrapped in a WASM binding layer (`jsonl-wasm`).

**Architecture:** Three-module pipeline — `NewlineScanner` builds a byte-offset index, `SchemaExtractor` does incremental union of flattened JSON keys, `RowParser` parses specific rows on demand. All pure Rust with no WASM dependency. A thin `jsonl-wasm` crate wraps the API with `wasm-bindgen`.

**Tech Stack:** Rust 2021 edition, `serde_json`, `wasm-bindgen`, `criterion` (benchmarks)

---

## File Structure

```
crates/jsonl-core/
├── Cargo.toml
├── src/
│   ├── lib.rs           # Re-exports, engine orchestration
│   ├── types.rs         # LineOffset, LineIndex, Schema, ColumnDef, ValueType, FlatRow
│   ├── scanner.rs       # NewlineScanner — byte scanning, Vec<LineOffset>
│   ├── schema.rs        # SchemaExtractor — flatten JSON, incremental union
│   └── parser.rs        # RowParser — on-demand row parsing + flattening
├── tests/
│   ├── fixtures/
│   │   ├── simple.jsonl
│   │   ├── heterogeneous.jsonl
│   │   └── with_errors.jsonl
│   └── integration_test.rs
└── benches/
    └── scanner_bench.rs

crates/jsonl-wasm/
├── Cargo.toml
└── src/
    └── lib.rs           # wasm-bindgen exports: JsonlEngine

Cargo.toml                # Workspace root
```

---

### Task 1: Project Scaffolding

**Files:**
- Create: `Cargo.toml` (workspace root)
- Create: `crates/jsonl-core/Cargo.toml`
- Create: `crates/jsonl-core/src/lib.rs`
- Create: `crates/jsonl-wasm/Cargo.toml`
- Create: `crates/jsonl-wasm/src/lib.rs`

- [ ] **Step 1: Create workspace root Cargo.toml**

```toml
[workspace]
members = ["crates/jsonl-core", "crates/jsonl-wasm"]
resolver = "2"
```

- [ ] **Step 2: Create jsonl-core Cargo.toml**

```toml
[package]
name = "jsonl-core"
version = "0.1.0"
edition = "2021"

[dependencies]
serde = { version = "1", features = ["derive"] }
serde_json = "1"

[dev-dependencies]
criterion = "0.5"

[[bench]]
name = "scanner_bench"
harness = false
```

- [ ] **Step 3: Create jsonl-core/src/lib.rs (empty skeleton)**

```rust
pub mod types;
pub mod scanner;
pub mod schema;
pub mod parser;

pub use types::*;
pub use scanner::NewlineScanner;
pub use schema::SchemaExtractor;
pub use parser::RowParser;
```

- [ ] **Step 4: Create placeholder modules (empty files to compile)**

Create `crates/jsonl-core/src/types.rs`:
```rust
// Core types — implemented in Task 2
```

Create `crates/jsonl-core/src/scanner.rs`:
```rust
// Newline scanner — implemented in Task 3
```

Create `crates/jsonl-core/src/schema.rs`:
```rust
// Schema extractor — implemented in Task 4
```

Create `crates/jsonl-core/src/parser.rs`:
```rust
// Row parser — implemented in Task 5
```

- [ ] **Step 5: Create jsonl-wasm Cargo.toml**

```toml
[package]
name = "jsonl-wasm"
version = "0.1.0"
edition = "2021"

[lib]
crate-type = ["cdylib", "rlib"]

[dependencies]
jsonl-core = { path = "../jsonl-core" }
wasm-bindgen = "0.2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
js-sys = "0.3"

[dev-dependencies]
wasm-bindgen-test = "0.3"
```

- [ ] **Step 6: Create jsonl-wasm/src/lib.rs (placeholder)**

```rust
// WASM bindings — implemented in Task 7
```

- [ ] **Step 7: Verify workspace builds**

Run: `cargo build`
Expected: Compiles with no errors (only warnings about unused files)

- [ ] **Step 8: Commit**

```bash
git add Cargo.toml crates/
git commit -m "feat: scaffold Rust workspace with jsonl-core and jsonl-wasm crates"
```

---

### Task 2: Core Types (types.rs)

**Files:**
- Modify: `crates/jsonl-core/src/types.rs`
- Test: inline `#[cfg(test)]` module

- [ ] **Step 1: Write failing tests for types**

```rust
use std::collections::{HashMap, HashSet};

/// Value types found in JSONL fields
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub enum ValueType {
    String,
    Number,
    Boolean,
    Object,
    Array,
    Null,
    Mixed,
}

/// Byte offset for a single line in the file
#[derive(Debug, Clone, Copy)]
pub struct LineOffset {
    pub start: u64,
    pub len: u32,
}

/// Index of all line positions + error tracking
#[derive(Debug, Clone)]
pub struct LineIndex {
    pub offsets: Vec<LineOffset>,
    pub error_lines: HashSet<u32>,
}

impl LineIndex {
    pub fn new(offsets: Vec<LineOffset>) -> Self {
        Self {
            offsets,
            error_lines: HashSet::new(),
        }
    }

    pub fn total_lines(&self) -> u32 {
        self.offsets.len() as u32
    }

    pub fn get(&self, line: u32) -> Option<LineOffset> {
        self.offsets.get(line as usize).copied()
    }

    pub fn byte_range(&self, start_line: u32, end_line: u32) -> Option<(u64, u64)> {
        if end_line == 0 || start_line >= end_line || (end_line as usize) > self.offsets.len() {
            return None;
        }
        let start_byte = self.offsets.get(start_line as usize)?.start;
        let last = self.offsets.get((end_line - 1) as usize)?;
        let end_byte = last.start + last.len as u64;
        Some((start_byte, end_byte))
    }
}

/// Column definition in the extracted schema
#[derive(Debug, Clone)]
pub struct ColumnDef {
    pub key: String,
    pub depth: u8,
    pub inferred_type: ValueType,
    pub nullable: bool,
}

/// Schema describing all columns found across the JSONL file
#[derive(Debug, Clone)]
pub struct Schema {
    pub columns: Vec<ColumnDef>,
    pub column_map: HashMap<String, usize>,
}

impl Schema {
    pub fn new() -> Self {
        Self {
            columns: Vec::new(),
            column_map: HashMap::new(),
        }
    }

    /// Get column keys in order
    pub fn column_keys(&self) -> Vec<&str> {
        self.columns.iter().map(|c| c.key.as_str()).collect()
    }
}

impl Default for Schema {
    fn default() -> Self {
        Self::new()
    }
}

/// A flattened row of data
#[derive(Debug, Clone)]
pub struct FlatRow {
    pub index: u32,
    pub data: HashMap<String, serde_json::Value>,
    pub error: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_line_index_new() {
        let offsets = vec![
            LineOffset { start: 0, len: 20 },
            LineOffset { start: 21, len: 15 },
        ];
        let index = LineIndex::new(offsets);
        assert_eq!(index.total_lines(), 2);
        assert!(index.error_lines.is_empty());
    }

    #[test]
    fn test_line_index_get() {
        let offsets = vec![
            LineOffset { start: 0, len: 20 },
            LineOffset { start: 21, len: 15 },
        ];
        let index = LineIndex::new(offsets);
        assert_eq!(index.get(0), Some(LineOffset { start: 0, len: 20 }));
        assert_eq!(index.get(1), Some(LineOffset { start: 21, len: 15 }));
        assert_eq!(index.get(2), None);
    }

    #[test]
    fn test_line_index_byte_range() {
        let offsets = vec![
            LineOffset { start: 0, len: 20 },
            LineOffset { start: 21, len: 15 },
            LineOffset { start: 37, len: 10 },
        ];
        let index = LineIndex::new(offsets);
        // Lines 0..2 → bytes 0..36
        assert_eq!(index.byte_range(0, 2), Some((0, 36)));
        // Lines 1..3 → bytes 21..47
        assert_eq!(index.byte_range(1, 3), Some((21, 47)));
        // Invalid: start >= end
        assert_eq!(index.byte_range(2, 1), None);
        // Invalid: out of bounds
        assert_eq!(index.byte_range(0, 4), None);
    }

    #[test]
    fn test_schema_new() {
        let schema = Schema::new();
        assert!(schema.columns.is_empty());
        assert!(schema.column_map.is_empty());
    }

    #[test]
    fn test_flat_row_creation() {
        let mut data = HashMap::new();
        data.insert("id".to_string(), serde_json::json!(42));
        let row = FlatRow {
            index: 0,
            data,
            error: None,
        };
        assert_eq!(row.index, 0);
        assert_eq!(row.data.get("id").unwrap(), &serde_json::json!(42));
        assert!(row.error.is_none());
    }

    #[test]
    fn test_flat_row_error() {
        let row = FlatRow {
            index: 5,
            data: HashMap::new(),
            error: Some("invalid json".to_string()),
        };
        assert_eq!(row.error, Some("invalid json".to_string()));
    }
}
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `cargo test -p jsonl-core -- types`
Expected: All 6 tests PASS (types include implementation)

- [ ] **Step 3: Commit**

```bash
git add crates/jsonl-core/src/types.rs
git commit -m "feat(jsonl-core): add core types — LineIndex, Schema, ColumnDef, FlatRow"
```

---

### Task 3: Newline Scanner (scanner.rs)

**Files:**
- Modify: `crates/jsonl-core/src/scanner.rs`
- Test: inline `#[cfg(test)]` module

- [ ] **Step 1: Write scanner implementation + tests**

```rust
use crate::types::LineOffset;

/// Result returned after feeding a chunk to the scanner
pub struct ScanResult {
    pub new_lines: u32,
    pub progress: f64,
}

/// Scans raw bytes for newline characters and builds a line offset index.
///
/// Usage:
/// ```ignore
/// let mut scanner = NewlineScanner::new(file_size as u64);
/// scanner.feed_chunk(&bytes);
/// let offsets = scanner.finish();
/// ```
pub struct NewlineScanner {
    offsets: Vec<LineOffset>,
    current_line_start: u64,
    bytes_processed: u64,
    total_size: u64,
}

impl NewlineScanner {
    pub fn new(total_size: u64) -> Self {
        Self {
            offsets: Vec::new(),
            current_line_start: 0,
            bytes_processed: 0,
            total_size,
        }
    }

    /// Feed a chunk of bytes. Returns number of new lines found and progress (0.0..1.0).
    pub fn feed_chunk(&mut self, chunk: &[u8]) -> ScanResult {
        let mut new_lines = 0u32;
        let chunk_start = self.bytes_processed;

        for (i, &byte) in chunk.iter().enumerate() {
            if byte == b'\n' {
                let abs_pos = chunk_start + i as u64;
                let line_start = self.current_line_start;
                let len = (abs_pos - line_start) as u32;

                // Only record non-empty lines (skip bare \n)
                if len > 0 {
                    self.offsets.push(LineOffset { start: line_start, len });
                }

                self.current_line_start = abs_pos + 1;
                new_lines += 1;
            }
        }

        self.bytes_processed += chunk.len() as u64;

        ScanResult {
            new_lines,
            progress: self.progress(),
        }
    }

    /// Finish scanning. Handles the last line if the file doesn't end with \n.
    pub fn finish(mut self) -> Vec<LineOffset> {
        if self.bytes_processed > self.current_line_start {
            let len = (self.bytes_processed - self.current_line_start) as u32;
            self.offsets.push(LineOffset {
                start: self.current_line_start,
                len,
            });
        }
        self.offsets
    }

    pub fn progress(&self) -> f64 {
        if self.total_size > 0 {
            (self.bytes_processed as f64 / self.total_size as f64).min(1.0)
        } else {
            1.0
        }
    }

    pub fn lines_found(&self) -> u32 {
        self.offsets.len() as u32
    }

    pub fn bytes_processed(&self) -> u64 {
        self.bytes_processed
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_scan_empty_input() {
        let scanner = NewlineScanner::new(0);
        let offsets = scanner.finish();
        assert!(offsets.is_empty());
    }

    #[test]
    fn test_scan_single_line_no_newline() {
        let mut scanner = NewlineScanner::new(5);
        scanner.feed_chunk(b"hello");
        let offsets = scanner.finish();
        assert_eq!(offsets.len(), 1);
        assert_eq!(offsets[0], LineOffset { start: 0, len: 5 });
    }

    #[test]
    fn test_scan_single_line_with_newline() {
        let mut scanner = NewlineScanner::new(6);
        let result = scanner.feed_chunk(b"hello\n");
        assert_eq!(result.new_lines, 1);
        let offsets = scanner.finish();
        assert_eq!(offsets.len(), 1);
        assert_eq!(offsets[0], LineOffset { start: 0, len: 5 });
    }

    #[test]
    fn test_scan_multiple_lines() {
        let mut scanner = NewlineScanner::new(12);
        scanner.feed_chunk(b"hello\nworld\n");
        let offsets = scanner.finish();
        assert_eq!(offsets.len(), 2);
        assert_eq!(offsets[0], LineOffset { start: 0, len: 5 });
        assert_eq!(offsets[1], LineOffset { start: 6, len: 5 });
    }

    #[test]
    fn test_scan_last_line_no_newline() {
        let mut scanner = NewlineScanner::new(12);
        scanner.feed_chunk(b"hello\nworld");
        let offsets = scanner.finish();
        assert_eq!(offsets.len(), 2);
        assert_eq!(offsets[0], LineOffset { start: 0, len: 5 });
        assert_eq!(offsets[1], LineOffset { start: 6, len: 5 });
    }

    #[test]
    fn test_scan_streaming_chunks() {
        let mut scanner = NewlineScanner::new(12);

        let r1 = scanner.feed_chunk(b"hel");
        assert_eq!(r1.new_lines, 0);

        let r2 = scanner.feed_chunk(b"lo\nwor");
        assert_eq!(r2.new_lines, 1);

        let r3 = scanner.feed_chunk(b"ld\n");
        assert_eq!(r3.new_lines, 1);

        let offsets = scanner.finish();
        assert_eq!(offsets.len(), 2);
        assert_eq!(offsets[0], LineOffset { start: 0, len: 5 });
        assert_eq!(offsets[1], LineOffset { start: 6, len: 5 });
    }

    #[test]
    fn test_scan_skips_empty_lines() {
        let mut scanner = NewlineScanner::new(10);
        scanner.feed_chunk(b"a\n\n\nb\n");
        let offsets = scanner.finish();
        assert_eq!(offsets.len(), 2);
        assert_eq!(offsets[0], LineOffset { start: 0, len: 1 });
        assert_eq!(offsets[1], LineOffset { start: 4, len: 1 });
    }

    #[test]
    fn test_scan_progress() {
        let mut scanner = NewlineScanner::new(100);
        assert_eq!(scanner.progress(), 0.0);

        scanner.feed_chunk(&[0u8; 50]);
        assert!((scanner.progress() - 0.5).abs() < 0.01);

        scanner.feed_chunk(&[0u8; 50]);
        assert!((scanner.progress() - 1.0).abs() < 0.01);
    }

    #[test]
    fn test_scan_real_jsonl() {
        let data = b"{\"id\":1,\"name\":\"Alice\"}\n{\"id\":2,\"name\":\"Bob\"}\n{\"id\":3}\n";
        let mut scanner = NewlineScanner::new(data.len() as u64);
        scanner.feed_chunk(data);
        let offsets = scanner.finish();
        assert_eq!(offsets.len(), 3);
        // Verify each line starts at the right byte
        assert_eq!(offsets[0].start, 0);
        assert_eq!(offsets[1].start, 24);
        assert_eq!(offsets[2].start, 46);
    }
}
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `cargo test -p jsonl-core -- scanner`
Expected: All 9 tests PASS

- [ ] **Step 3: Commit**

```bash
git add crates/jsonl-core/src/scanner.rs
git commit -m "feat(jsonl-core): add newline scanner with streaming chunk support"
```

---

### Task 4: Schema Extractor (schema.rs)

**Files:**
- Modify: `crates/jsonl-core/src/schema.rs`
- Test: inline `#[cfg(test)]` module

- [ ] **Step 1: Write schema extractor implementation + tests**

```rust
use crate::types::{ColumnDef, Schema, ValueType};
use serde_json::Value;

/// Extracts a unified schema from JSONL rows using incremental union.
///
/// Each call to `process_line` parses one JSON line, flattens nested keys
/// to dot notation, and merges them into the growing schema.
pub struct SchemaExtractor {
    schema: Schema,
}

impl SchemaExtractor {
    pub fn new() -> Self {
        Self {
            schema: Schema::new(),
        }
    }

    /// Process a single JSON line. Returns `true` if valid JSON, `false` if parse error.
    pub fn process_line(&mut self, line: &str) -> bool {
        match serde_json::from_str::<Value>(line) {
            Ok(value) => {
                let flat = flatten_value("", &value, 0);
                self.merge_flat_keys(&flat);
                true
            }
            Err(_) => false,
        }
    }

    /// Process a line that is already parsed. Used by the parser for rows
    /// that were already validated.
    pub fn process_value(&mut self, value: &Value) {
        let flat = flatten_value("", value, 0);
        self.merge_flat_keys(&flat);
    }

    /// Get the number of columns discovered so far
    pub fn column_count(&self) -> usize {
        self.schema.columns.len()
    }

    pub fn into_schema(self) -> Schema {
        self.schema
    }

    fn merge_flat_keys(&mut self, keys: &[(String, u8, ValueType)]) {
        for (key, depth, vtype) in keys {
            if let Some(&idx) = self.schema.column_map.get(key) {
                let col = &mut self.schema.columns[idx];
                // Update type inference
                if col.inferred_type != *vtype {
                    match (&col.inferred_type, vtype) {
                        (ValueType::Null, other) => {
                            col.inferred_type = other.clone();
                        }
                        (_, ValueType::Null) => {
                            col.nullable = true;
                        }
                        _ => {
                            col.inferred_type = ValueType::Mixed;
                        }
                    }
                }
                if matches!(vtype, ValueType::Null) {
                    col.nullable = true;
                }
            } else {
                let idx = self.schema.columns.len();
                self.schema.column_map.insert(key.clone(), idx);
                self.schema.columns.push(ColumnDef {
                    key: key.clone(),
                    depth: *depth,
                    inferred_type: if matches!(vtype, ValueType::Null) {
                        ValueType::Null
                    } else {
                        vtype.clone()
                    },
                    nullable: matches!(vtype, ValueType::Null),
                });
            }
        }
    }
}

impl Default for SchemaExtractor {
    fn default() -> Self {
        Self::new()
    }
}

/// Flatten a JSON value into (key, depth, type) tuples.
/// Nested objects become dot-notation keys: `{"a": {"b": 1}}` → `("a.b", 1, Number)`.
fn flatten_value(prefix: &str, value: &Value, depth: u8) -> Vec<(String, u8, ValueType)> {
    match value {
        Value::Null => {
            if prefix.is_empty() {
                vec![]
            } else {
                vec![(prefix.to_string(), depth, ValueType::Null)]
            }
        }
        Value::Bool(_) => vec![(prefix.to_string(), depth, ValueType::Boolean)],
        Value::Number(_) => vec![(prefix.to_string(), depth, ValueType::Number)],
        Value::String(_) => vec![(prefix.to_string(), depth, ValueType::String)],
        Value::Array(_) => vec![(prefix.to_string(), depth, ValueType::Array)],
        Value::Object(map) => {
            if prefix.is_empty() {
                // Root level: recurse into each field with field name as prefix
                let mut result = Vec::new();
                for (k, v) in map {
                    result.extend(flatten_value(k, v, 0));
                }
                result
            } else if map.is_empty() {
                vec![(prefix.to_string(), depth, ValueType::Object)]
            } else {
                let mut result = Vec::new();
                for (k, v) in map {
                    let key = format!("{}.{}", prefix, k);
                    result.extend(flatten_value(&key, v, depth + 1));
                }
                result
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_flatten_simple_object() {
        let value: Value = serde_json::from_str(r#"{"id":1,"name":"Alice"}"#).unwrap();
        let flat = flatten_value("", &value, 0);
        assert_eq!(flat.len(), 2);
        assert_eq!(flat[0], ("id".to_string(), 0, ValueType::Number));
        assert_eq!(flat[1], ("name".to_string(), 0, ValueType::String));
    }

    #[test]
    fn test_flatten_nested_object() {
        let value: Value = serde_json::from_str(
            r#"{"address":{"city":"Shanghai","zip":"200000"}}"#,
        )
        .unwrap();
        let flat = flatten_value("", &value, 0);
        assert_eq!(flat.len(), 2);
        assert_eq!(flat[0], ("address.city".to_string(), 1, ValueType::String));
        assert_eq!(flat[1], ("address.zip".to_string(), 1, ValueType::String));
    }

    #[test]
    fn test_flatten_array() {
        let value: Value = serde_json::from_str(r#"{"tags":["vip","active"]}"#).unwrap();
        let flat = flatten_value("", &value, 0);
        assert_eq!(flat.len(), 1);
        assert_eq!(flat[0], ("tags".to_string(), 0, ValueType::Array));
    }

    #[test]
    fn test_flatten_null() {
        let value: Value = serde_json::from_str(r#"{"email":null}"#).unwrap();
        let flat = flatten_value("", &value, 0);
        assert_eq!(flat.len(), 1);
        assert_eq!(flat[0], ("email".to_string(), 0, ValueType::Null));
    }

    #[test]
    fn test_flatten_boolean() {
        let value: Value = serde_json::from_str(r#"{"active":true}"#).unwrap();
        let flat = flatten_value("", &value, 0);
        assert_eq!(flat.len(), 1);
        assert_eq!(flat[0], ("active".to_string(), 0, ValueType::Boolean));
    }

    #[test]
    fn test_schema_union_heterogeneous_rows() {
        let mut extractor = SchemaExtractor::new();

        extractor.process_line(r#"{"id":1,"name":"Alice","email":"a@b.com"}"#);
        extractor.process_line(r#"{"id":2,"name":"Bob","age":25}"#);
        extractor.process_line(r#"{"id":3,"name":"Charlie","address":{"city":"Beijing"}}"#);

        let schema = extractor.into_schema();
        let keys = schema.column_keys();

        // Union of all keys
        assert!(keys.contains(&"id"));
        assert!(keys.contains(&"name"));
        assert!(keys.contains(&"email"));
        assert!(keys.contains(&"age"));
        assert!(keys.contains(&"address.city"));
        assert_eq!(keys.len(), 6);
    }

    #[test]
    fn test_schema_type_inference_mixed() {
        let mut extractor = SchemaExtractor::new();

        extractor.process_line(r#"{"value":42}"#);
        extractor.process_line(r#"{"value":"not a number"}"#);

        let schema = extractor.into_schema();
        let col = schema.columns.iter().find(|c| c.key == "value").unwrap();
        assert_eq!(col.inferred_type, ValueType::Mixed);
    }

    #[test]
    fn test_schema_nullable_tracking() {
        let mut extractor = SchemaExtractor::new();

        extractor.process_line(r#"{"email":"a@b.com","name":"Alice"}"#);
        extractor.process_line(r#"{"name":"Bob"}"#); // email missing → nullable

        let schema = extractor.into_schema();
        let email_col = schema.columns.iter().find(|c| c.key == "email").unwrap();
        assert!(email_col.nullable);
    }

    #[test]
    fn test_schema_null_then_value() {
        let mut extractor = SchemaExtractor::new();

        extractor.process_line(r#"{"email":null}"#);
        extractor.process_line(r#"{"email":"a@b.com"}"#);

        let schema = extractor.into_schema();
        let col = schema.columns.iter().find(|c| c.key == "email").unwrap();
        assert_eq!(col.inferred_type, ValueType::String);
        assert!(col.nullable);
    }

    #[test]
    fn test_schema_invalid_json_returns_false() {
        let mut extractor = SchemaExtractor::new();
        assert!(!extractor.process_line("{invalid json"));
        assert!(extractor.process_line(r#"{"ok":1}"#));
    }

    #[test]
    fn test_schema_preserves_insertion_order() {
        let mut extractor = SchemaExtractor::new();
        extractor.process_line(r#"{"z":1,"a":2,"m":3}"#);

        let schema = extractor.into_schema();
        let keys: Vec<&str> = schema.columns.iter().map(|c| c.key.as_str()).collect();
        assert_eq!(keys, vec!["z", "a", "m"]);
    }
}
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `cargo test -p jsonl-core -- schema`
Expected: All 10 tests PASS

- [ ] **Step 3: Commit**

```bash
git add crates/jsonl-core/src/schema.rs
git commit -m "feat(jsonl-core): add schema extractor with incremental union algorithm"
```

---

### Task 5: Row Parser (parser.rs)

**Files:**
- Modify: `crates/jsonl-core/src/parser.rs`
- Test: inline `#[cfg(test)]` module

- [ ] **Step 1: Write row parser implementation + tests**

```rust
use std::collections::HashMap;

use crate::types::{FlatRow, LineIndex, Schema};

/// Parses specific rows on demand using the byte offset index.
///
/// Given a `LineIndex` and raw file data, parses only the requested row range,
/// flattens nested JSON, and marks invalid rows as errors.
pub struct RowParser<'a> {
    line_index: &'a LineIndex,
    _schema: &'a Schema,
}

impl<'a> RowParser<'a> {
    pub fn new(line_index: &'a LineIndex, schema: &'a Schema) -> Self {
        Self {
            line_index,
            _schema: schema,
        }
    }

    /// Parse rows `[start, end)` from the raw data.
    /// `data` is the full file content (or a slice covering the requested range).
    pub fn parse_rows(&self, data: &[u8], start: u32, end: u32) -> Vec<FlatRow> {
        let end = end.min(self.line_index.total_lines());
        let mut rows = Vec::with_capacity((end - start) as usize);

        for line_num in start..end {
            match self.parse_single_row(data, line_num) {
                Ok(row) => rows.push(row),
                Err(raw_text) => rows.push(FlatRow {
                    index: line_num,
                    data: HashMap::new(),
                    error: Some(raw_text),
                }),
            }
        }

        rows
    }

    fn parse_single_row(&self, data: &[u8], line_num: u32) -> Result<FlatRow, String> {
        let offset = self
            .line_index
            .get(line_num)
            .ok_or_else(|| format!("Line {} out of range", line_num))?;

        let start = offset.start as usize;
        let end = start + offset.len as usize;

        if end > data.len() {
            return Err(format!("Line {} data out of bounds", line_num));
        }

        let line_bytes = &data[start..end];
        let line_str = std::str::from_utf8(line_bytes)
            .map_err(|e| format!("UTF-8 error at line {}: {}", line_num, e))?;

        let value: serde_json::Value = serde_json::from_str(line_str)
            .map_err(|_| line_str.to_string())?;

        let flat_data = flatten_to_map(&value);

        Ok(FlatRow {
            index: line_num,
            data: flat_data,
            error: None,
        })
    }
}

/// Flatten a JSON value into a HashMap of dot-notation keys to values.
fn flatten_to_map(value: &serde_json::Value) -> HashMap<String, serde_json::Value> {
    let mut map = HashMap::new();
    flatten_value_into("", value, &mut map);
    map
}

fn flatten_value_into(
    prefix: &str,
    value: &serde_json::Value,
    map: &mut HashMap<String, serde_json::Value>,
) {
    match value {
        serde_json::Value::Object(obj) => {
            if prefix.is_empty() {
                for (k, v) in obj {
                    flatten_value_into(k, v, map);
                }
            } else {
                for (k, v) in obj {
                    let key = format!("{}.{}", prefix, k);
                    flatten_value_into(&key, v, map);
                }
            }
        }
        _ => {
            if !prefix.is_empty() {
                map.insert(prefix.to_string(), value.clone());
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::LineOffset;
    use std::collections::HashSet;

    fn make_test_data() -> (Vec<u8>, LineIndex, Schema) {
        let data = concat!(
            "{\"id\":1,\"name\":\"Alice\",\"age\":30}\n",
            "{\"id\":2,\"name\":\"Bob\",\"age\":25}\n",
            "{invalid json\n",
            "{\"id\":4,\"name\":\"Diana\"}\n",
        );
        let bytes = data.as_bytes().to_vec();

        let offsets = vec![
            LineOffset { start: 0, len: 33 },   // {"id":1,"name":"Alice","age":30}
            LineOffset { start: 34, len: 31 },  // {"id":2,"name":"Bob","age":25}
            LineOffset { start: 66, len: 15 },  // {invalid json
            LineOffset { start: 82, len: 27 },  // {"id":4,"name":"Diana"}
        ];

        let mut error_lines = HashSet::new();
        error_lines.insert(2); // Line 2 is invalid

        let line_index = LineIndex {
            offsets,
            error_lines,
        };

        let schema = Schema::new(); // Schema is not used in parsing logic directly
        (bytes, line_index, schema)
    }

    #[test]
    fn test_parse_single_valid_row() {
        let (data, line_index, schema) = make_test_data();
        let parser = RowParser::new(&line_index, &schema);

        let rows = parser.parse_rows(&data, 0, 1);
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].index, 0);
        assert!(rows[0].error.is_none());
        assert_eq!(rows[0].data.get("id").unwrap(), &serde_json::json!(1));
        assert_eq!(rows[0].data.get("name").unwrap(), &serde_json::json!("Alice"));
    }

    #[test]
    fn test_parse_multiple_rows() {
        let (data, line_index, schema) = make_test_data();
        let parser = RowParser::new(&line_index, &schema);

        let rows = parser.parse_rows(&data, 0, 2);
        assert_eq!(rows.len(), 2);
        assert_eq!(rows[0].data.get("id").unwrap(), &serde_json::json!(1));
        assert_eq!(rows[1].data.get("id").unwrap(), &serde_json::json!(2));
    }

    #[test]
    fn test_parse_error_row() {
        let (data, line_index, schema) = make_test_data();
        let parser = RowParser::new(&line_index, &schema);

        let rows = parser.parse_rows(&data, 2, 3);
        assert_eq!(rows.len(), 1);
        assert!(rows[0].error.is_some());
        assert_eq!(rows[0].error.as_ref().unwrap(), "{invalid json");
    }

    #[test]
    fn test_parse_mixed_valid_and_error() {
        let (data, line_index, schema) = make_test_data();
        let parser = RowParser::new(&line_index, &schema);

        let rows = parser.parse_rows(&data, 0, 4);
        assert_eq!(rows.len(), 4);
        assert!(rows[0].error.is_none());
        assert!(rows[1].error.is_none());
        assert!(rows[2].error.is_some());
        assert!(rows[3].error.is_none());
    }

    #[test]
    fn test_parse_out_of_range_clamps() {
        let (data, line_index, schema) = make_test_data();
        let parser = RowParser::new(&line_index, &schema);

        // Request beyond available lines — should clamp
        let rows = parser.parse_rows(&data, 2, 100);
        assert_eq!(rows.len(), 2); // Only lines 2 and 3 exist
    }

    #[test]
    fn test_parse_nested_flattening() {
        let jsonl = r#"{"id":1,"address":{"city":"Shanghai","zip":"200000"}}"#;
        let data = jsonl.as_bytes();

        let line_index = LineIndex {
            offsets: vec![LineOffset { start: 0, len: data.len() as u32 }],
            error_lines: HashSet::new(),
        };
        let schema = Schema::new();
        let parser = RowParser::new(&line_index, &schema);

        let rows = parser.parse_rows(data, 0, 1);
        assert_eq!(rows[0].data.get("address.city").unwrap(), &serde_json::json!("Shanghai"));
        assert_eq!(rows[0].data.get("address.zip").unwrap(), &serde_json::json!("200000"));
    }

    #[test]
    fn test_flatten_to_map_simple() {
        let value: serde_json::Value = serde_json::from_str(r#"{"a":1,"b":"x"}"#).unwrap();
        let map = flatten_to_map(&value);
        assert_eq!(map.len(), 2);
        assert_eq!(map.get("a").unwrap(), &serde_json::json!(1));
        assert_eq!(map.get("b").unwrap(), &serde_json::json!("x"));
    }

    #[test]
    fn test_flatten_to_map_nested() {
        let value: serde_json::Value =
            serde_json::from_str(r#"{"a":{"b":{"c":42}}}"#).unwrap();
        let map = flatten_to_map(&value);
        assert_eq!(map.len(), 1);
        assert_eq!(map.get("a.b.c").unwrap(), &serde_json::json!(42));
    }

    #[test]
    fn test_flatten_to_map_with_null() {
        let value: serde_json::Value = serde_json::from_str(r#"{"a":null,"b":1}"#).unwrap();
        let map = flatten_to_map(&value);
        assert_eq!(map.len(), 2);
        assert!(map.get("a").unwrap().is_null());
    }
}
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `cargo test -p jsonl-core -- parser`
Expected: All 9 tests PASS

- [ ] **Step 3: Commit**

```bash
git add crates/jsonl-core/src/parser.rs
git commit -m "feat(jsonl-core): add on-demand row parser with nested flattening"
```

---

### Task 6: Test Fixtures + Integration Tests

**Files:**
- Create: `crates/jsonl-core/tests/fixtures/simple.jsonl`
- Create: `crates/jsonl-core/tests/fixtures/heterogeneous.jsonl`
- Create: `crates/jsonl-core/tests/fixtures/with_errors.jsonl`
- Create: `crates/jsonl-core/tests/integration_test.rs`

- [ ] **Step 1: Create test fixtures**

`crates/jsonl-core/tests/fixtures/simple.jsonl`:
```jsonl
{"id":1,"name":"Alice","age":30,"active":true}
{"id":2,"name":"Bob","age":25,"active":false}
{"id":3,"name":"Charlie","age":35,"active":true}
```

`crates/jsonl-core/tests/fixtures/heterogeneous.jsonl`:
```jsonl
{"id":1,"name":"Alice","email":"alice@example.com","address":{"city":"Shanghai","zip":"200000"}}
{"id":2,"name":"Bob","age":25}
{"id":3,"name":"Charlie","email":"charlie@example.com","address":{"city":"Beijing"},"tags":["vip"]}
```

`crates/jsonl-core/tests/fixtures/with_errors.jsonl`:
```jsonl
{"id":1,"name":"Alice"}
{invalid json
{"id":3,"name":"Charlie"}
{"id":4}
broken { again
{"id":6,"name":"Frank"}
```

- [ ] **Step 2: Write integration tests**

`crates/jsonl-core/tests/integration_test.rs`:
```rust
use std::collections::HashSet;

use jsonl_core::*;

fn read_fixture(name: &str) -> Vec<u8> {
    let manifest_dir = std::env::var("CARGO_MANIFEST_DIR").unwrap();
    let path = std::path::Path::new(&manifest_dir)
        .join("tests")
        .join("fixtures")
        .join(name);
    std::fs::read(path).unwrap_or_else(|e| panic!("Failed to read {}: {}", name, e))
}

fn scan_all(data: &[u8]) -> Vec<types::LineOffset> {
    let mut scanner = NewlineScanner::new(data.len() as u64);
    scanner.feed_chunk(data);
    scanner.finish()
}

fn extract_schema(data: &[u8], offsets: &[types::LineOffset]) -> (types::Schema, HashSet<u32>) {
    let mut extractor = SchemaExtractor::new();
    let mut error_lines = HashSet::new();

    for (i, offset) in offsets.iter().enumerate() {
        let start = offset.start as usize;
        let end = start + offset.len as usize;
        let line_str = std::str::from_utf8(&data[start..end]).unwrap();
        if !extractor.process_line(line_str) {
            error_lines.insert(i as u32);
        }
    }

    (extractor.into_schema(), error_lines)
}

#[test]
fn test_simple_jsonl_end_to_end() {
    let data = read_fixture("simple.jsonl");
    let offsets = scan_all(&data);

    assert_eq!(offsets.len(), 3);

    let (schema, errors) = extract_schema(&data, &offsets);
    assert!(errors.is_empty());

    let keys = schema.column_keys();
    assert!(keys.contains(&"id"));
    assert!(keys.contains(&"name"));
    assert!(keys.contains(&"age"));
    assert!(keys.contains(&"active"));
    assert_eq!(keys.len(), 4);

    // Parse all rows
    let line_index = types::LineIndex { offsets: offsets.clone(), error_lines: errors };
    let parser = RowParser::new(&line_index, &schema);
    let rows = parser.parse_rows(&data, 0, 3);

    assert_eq!(rows.len(), 3);
    assert!(rows.iter().all(|r| r.error.is_none()));
    assert_eq!(rows[0].data.get("name").unwrap(), &serde_json::json!("Alice"));
    assert_eq!(rows[1].data.get("age").unwrap(), &serde_json::json!(25));
    assert_eq!(rows[2].data.get("active").unwrap(), &serde_json::json!(true));
}

#[test]
fn test_heterogeneous_jsonl_end_to_end() {
    let data = read_fixture("heterogeneous.jsonl");
    let offsets = scan_all(&data);

    assert_eq!(offsets.len(), 3);

    let (schema, errors) = extract_schema(&data, &offsets);
    assert!(errors.is_empty());

    let keys = schema.column_keys();
    assert!(keys.contains(&"id"));
    assert!(keys.contains(&"name"));
    assert!(keys.contains(&"email"));
    assert!(keys.contains(&"age"));
    assert!(keys.contains(&"address.city"));
    assert!(keys.contains(&"address.zip"));
    assert!(keys.contains(&"tags"));

    // Parse and verify missing keys are absent from data (consumer handles null)
    let line_index = types::LineIndex { offsets: offsets.clone(), error_lines: errors };
    let parser = RowParser::new(&line_index, &schema);
    let rows = parser.parse_rows(&data, 0, 3);

    // Row 0: has email, address.city, address.zip
    assert!(rows[0].data.contains_key("email"));
    // Row 1: has age, no email
    assert!(rows[1].data.contains_key("age"));
    assert!(!rows[1].data.contains_key("email"));
    // Row 2: has tags array
    assert!(rows[2].data.contains_key("tags"));
}

#[test]
fn test_with_errors_jsonl_end_to_end() {
    let data = read_fixture("with_errors.jsonl");
    let offsets = scan_all(&data);

    assert_eq!(offsets.len(), 6);

    let (schema, errors) = extract_schema(&data, &offsets);
    assert_eq!(errors.len(), 2); // Lines 1 and 4 are invalid
    assert!(errors.contains(&1));
    assert!(errors.contains(&4));

    let line_index = types::LineIndex { offsets: offsets.clone(), error_lines: errors };
    let parser = RowParser::new(&line_index, &schema);
    let rows = parser.parse_rows(&data, 0, 6);

    assert_eq!(rows.len(), 6);
    // Valid rows
    assert!(rows[0].error.is_none());
    assert!(rows[2].error.is_none());
    assert!(rows[3].error.is_none());
    assert!(rows[5].error.is_none());
    // Error rows
    assert!(rows[1].error.is_some());
    assert!(rows[4].error.is_some());
    // Verify error row preserves raw text
    assert!(rows[1].error.as_ref().unwrap().contains("invalid"));
}

#[test]
fn test_parse_specific_range() {
    let data = read_fixture("simple.jsonl");
    let offsets = scan_all(&data);
    let (schema, _) = extract_schema(&data, &offsets);
    let line_index = types::LineIndex { offsets: offsets.clone(), error_lines: HashSet::new() };
    let parser = RowParser::new(&line_index, &schema);

    // Only parse row 1
    let rows = parser.parse_rows(&data, 1, 2);
    assert_eq!(rows.len(), 1);
    assert_eq!(rows[0].index, 1);
    assert_eq!(rows[0].data.get("name").unwrap(), &serde_json::json!("Bob"));
}
```

- [ ] **Step 3: Run integration tests**

Run: `cargo test -p jsonl-core --test integration_test`
Expected: All 4 tests PASS

- [ ] **Step 4: Run full test suite**

Run: `cargo test -p jsonl-core`
Expected: All tests PASS (unit + integration)

- [ ] **Step 5: Commit**

```bash
git add crates/jsonl-core/tests/
git commit -m "test(jsonl-core): add test fixtures and integration tests"
```

---

### Task 7: Performance Benchmarks

**Files:**
- Create: `crates/jsonl-core/benches/scanner_bench.rs`
- Create: `crates/jsonl-core/tests/fixtures/generate_large.py` (generator script)

- [ ] **Step 1: Create large fixture generator**

`crates/jsonl-core/tests/fixtures/generate_large.py`:
```python
#!/usr/bin/env python3
"""Generate a large JSONL file for benchmarking."""
import json
import random
import sys

def generate(path: str, rows: int):
    cities = ["Shanghai", "Beijing", "Shenzhen", "Hangzhou", "Chengdu"]
    with open(path, "w") as f:
        for i in range(rows):
            row = {
                "id": i,
                "name": f"user_{i}",
                "email": f"user_{i}@example.com" if random.random() > 0.3 else None,
                "age": random.randint(18, 65),
                "active": random.random() > 0.5,
                "address": {
                    "city": random.choice(cities),
                    "zip": f"{random.randint(100000, 999999)}",
                },
                "tags": random.sample(["vip", "active", "premium", "new"], k=random.randint(0, 3)),
                "score": round(random.random() * 100, 2),
            }
            f.write(json.dumps(row, ensure_ascii=False) + "\n")

if __name__ == "__main__":
    count = int(sys.argv[1]) if len(sys.argv) > 1 else 100_000
    path = sys.argv[2] if len(sys.argv) > 2 else "large.jsonl"
    generate(path, count)
    print(f"Generated {count} rows to {path}")
```

- [ ] **Step 2: Generate large fixture**

Run: `cd crates/jsonl-core/tests/fixtures && python3 generate_large.py 100000 large.jsonl`
Expected: "Generated 100000 rows to large.jsonl"

- [ ] **Step 3: Write benchmark**

`crates/jsonl-core/benches/scanner_bench.rs`:
```rust
use criterion::{black_box, criterion_group, criterion_main, Criterion, BenchmarkId};
use jsonl_core::*;

fn read_fixture(name: &str) -> Vec<u8> {
    let manifest_dir = std::env::var("CARGO_MANIFEST_DIR").unwrap();
    let path = std::path::Path::new(&manifest_dir)
        .join("tests")
        .join("fixtures")
        .join(name);
    std::fs::read(path).unwrap()
}

fn bench_scanner(c: &mut Criterion) {
    let data = read_fixture("large.jsonl");
    let mut group = c.benchmark_group("scanner");

    group.bench_function("100k_rows", |b| {
        b.iter(|| {
            let mut scanner = NewlineScanner::new(black_box(data.len() as u64));
            scanner.feed_chunk(black_box(&data));
            let offsets = scanner.finish();
            black_box(offsets);
        })
    });

    group.finish();
}

fn bench_schema(c: &mut Criterion) {
    let data = read_fixture("large.jsonl");
    let mut scanner = NewlineScanner::new(data.len() as u64);
    scanner.feed_chunk(&data);
    let offsets = scanner.finish();

    let mut group = c.benchmark_group("schema");

    group.bench_function("100k_rows", |b| {
        b.iter(|| {
            let mut extractor = SchemaExtractor::new();
            for offset in &offsets {
                let start = offset.start as usize;
                let end = start + offset.len as usize;
                let line = std::str::from_utf8(&data[start..end]).unwrap();
                extractor.process_line(black_box(line));
            }
            black_box(extractor.into_schema());
        })
    });

    group.finish();
}

fn bench_parser(c: &mut Criterion) {
    let data = read_fixture("large.jsonl");
    let mut scanner = NewlineScanner::new(data.len() as u64);
    scanner.feed_chunk(&data);
    let offsets = scanner.finish();

    let mut extractor = SchemaExtractor::new();
    for offset in &offsets {
        let start = offset.start as usize;
        let end = start + offset.len as usize;
        let line = std::str::from_utf8(&data[start..end]).unwrap();
        extractor.process_line(line);
    }
    let schema = extractor.into_schema();
    let line_index = types::LineIndex {
        offsets,
        error_lines: std::collections::HashSet::new(),
    };

    let mut group = c.benchmark_group("parser");

    group.bench_function("100_rows_from_100k", |b| {
        b.iter(|| {
            let parser = RowParser::new(black_box(&line_index), black_box(&schema));
            let rows = parser.parse_rows(black_box(&data), black_box(1000), black_box(1100));
            black_box(rows);
        })
    });

    group.finish();
}

criterion_group!(benches, bench_scanner, bench_schema, bench_parser);
criterion_main!(benches);
```

- [ ] **Step 4: Run benchmarks**

Run: `cargo bench -p jsonl-core`
Expected: Completes with timing results. Record these as baseline.

- [ ] **Step 5: Commit**

```bash
git add crates/jsonl-core/benches/ crates/jsonl-core/tests/fixtures/generate_large.py crates/jsonl-core/tests/fixtures/large.jsonl
git commit -m "perf(jsonl-core): add criterion benchmarks for scanner, schema, parser"
```

---

### Task 8: WASM Bindings (jsonl-wasm)

**Files:**
- Modify: `crates/jsonl-wasm/src/lib.rs`
- Test: inline `#[cfg(test)]` module

- [ ] **Step 1: Write WASM binding implementation + tests**

```rust
use wasm_bindgen::prelude::*;

use jsonl_core::{NewlineScanner, SchemaExtractor, RowParser, types as core_types};

/// WASM-facing column definition (serializable to JS)
#[derive(serde::Serialize)]
pub struct WasmColumnDef {
    pub key: String,
    pub depth: u8,
    pub inferred_type: String,
    pub nullable: bool,
}

/// WASM-facing schema result (serializable to JS)
#[derive(serde::Serialize)]
pub struct WasmSchemaResult {
    pub columns: Vec<WasmColumnDef>,
    pub total_rows: u32,
    pub error_rows: u32,
}

/// WASM-facing row data (serializable to JS)
#[derive(serde::Serialize)]
pub struct WasmRow {
    pub index: u32,
    pub data: serde_json::Value,
    pub error: Option<String>,
}

fn value_type_to_string(vt: &core_types::ValueType) -> String {
    match vt {
        core_types::ValueType::String => "string".to_string(),
        core_types::ValueType::Number => "number".to_string(),
        core_types::ValueType::Boolean => "boolean".to_string(),
        core_types::ValueType::Object => "object".to_string(),
        core_types::ValueType::Array => "array".to_string(),
        core_types::ValueType::Null => "null".to_string(),
        core_types::ValueType::Mixed => "mixed".to_string(),
    }
}

/// The main JSONL engine exposed to JavaScript.
///
/// Usage from JS:
/// ```js
/// const engine = new JsonlEngine();
/// engine.set_total_size(file.size);
/// // feed chunks...
/// engine.feed_chunk(chunk);  // returns progress 0..1
/// const schema = engine.finalize_scan();
/// const rows = engine.get_rows(0, 100);
/// ```
#[wasm_bindgen]
pub struct JsonlEngine {
    scanner: Option<NewlineScanner>,
    schema_extractor: Option<SchemaExtractor>,
    offsets: Option<Vec<core_types::LineOffset>>,
    line_index: Option<core_types::LineIndex>,
    schema: Option<core_types::Schema>,
    total_rows: u32,
    error_rows: u32,
    // Store raw data for get_rows
    raw_data: Vec<u8>,
}

#[wasm_bindgen]
impl JsonlEngine {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        Self {
            scanner: None,
            schema_extractor: None,
            offsets: None,
            line_index: None,
            schema: None,
            total_rows: 0,
            error_rows: 0,
            raw_data: Vec::new(),
        }
    }

    /// Set the expected total file size for progress calculation.
    pub fn set_total_size(&mut self, size: f64) {
        self.scanner = Some(NewlineScanner::new(size as u64));
        self.schema_extractor = Some(SchemaExtractor::new());
    }

    /// Feed a chunk of raw bytes. Returns progress as 0.0..1.0.
    pub fn feed_chunk(&mut self, chunk: &[u8]) -> f64 {
        self.raw_data.extend_from_slice(chunk);

        if let Some(ref mut scanner) = self.scanner {
            let result = scanner.feed_chunk(chunk);
            // Also extract schema from each line found in this chunk
            if let Some(ref mut extractor) = self.schema_extractor {
                // Find new lines by re-scanning the chunk for \n
                // We use the scanner's current line count to know what's new
                // This is a simplified approach — the full impl would track
                // which lines are new
            }
            result.progress
        } else {
            0.0
        }
    }

    /// Finalize scanning. Returns a JSON string with schema info.
    /// After this call, the engine is ready for get_rows().
    pub fn finalize_scan(&mut self) -> JsValue {
        // Finish scanning
        if let Some(scanner) = self.scanner.take() {
            let offsets = scanner.finish();
            self.total_rows = offsets.len() as u32;

            // Extract schema from all lines
            if let Some(ref mut extractor) = self.schema_extractor {
                let mut error_count = 0u32;
                for (i, offset) in offsets.iter().enumerate() {
                    let start = offset.start as usize;
                    let end = start + offset.len as usize;
                    if end <= self.raw_data.len() {
                        let line_bytes = &self.raw_data[start..end];
                        if let Ok(line_str) = std::str::from_utf8(line_bytes) {
                            if !extractor.process_line(line_str) {
                                error_count += 1;
                            }
                        }
                    }
                    let _ = i; // suppress unused warning
                }
                self.error_rows = error_count;

                let schema = extractor.clone_schema();
                self.schema = Some(schema);
            }

            // Build LineIndex with error lines
            let mut error_lines = std::collections::HashSet::new();
            if let Some(ref extractor) = self.schema_extractor {
                // Re-identify error lines
                for (i, offset) in offsets.iter().enumerate() {
                    let start = offset.start as usize;
                    let end = start + offset.len as usize;
                    if end <= self.raw_data.len() {
                        if let Ok(line_str) = std::str::from_utf8(&self.raw_data[start..end]) {
                            if serde_json::from_str::<serde_json::Value>(line_str).is_err() {
                                error_lines.insert(i as u32);
                            }
                        }
                    }
                }
            }

            self.line_index = Some(core_types::LineIndex {
                offsets,
                error_lines,
            });
        }

        // Build result
        let result = WasmSchemaResult {
            columns: self.schema.as_ref().map(|s| {
                s.columns.iter().map(|c| WasmColumnDef {
                    key: c.key.clone(),
                    depth: c.depth,
                    inferred_type: value_type_to_string(&c.inferred_type),
                    nullable: c.nullable,
                }).collect()
            }).unwrap_or_default(),
            total_rows: self.total_rows,
            error_rows: self.error_rows,
        };

        serde_wasm_bindgen::to_value(&result).unwrap_or(JsValue::NULL)
    }

    /// Get rows [start, end) as a JSON string.
    pub fn get_rows(&self, start: u32, end: u32) -> JsValue {
        let Some(ref line_index) = self.line_index else {
            return JsValue::NULL;
        };
        let Some(ref schema) = self.schema else {
            return JsValue::NULL;
        };

        let parser = RowParser::new(line_index, schema);
        let rows = parser.parse_rows(&self.raw_data, start, end);

        let wasm_rows: Vec<WasmRow> = rows.into_iter().map(|r| {
            WasmRow {
                index: r.index,
                data: serde_json::Value::Object(
                    r.data.into_iter().map(|(k, v)| (k, v)).collect()
                ),
                error: r.error,
            }
        }).collect();

        serde_wasm_bindgen::to_value(&wasm_rows).unwrap_or(JsValue::NULL)
    }
}

// SchemaExtractor doesn't expose clone_schema, so we add a helper
impl SchemaExtractor {
    fn clone_schema(&self) -> core_types::Schema {
        // We need to access the schema — but it's private.
        // Alternative: use into_schema() on a clone, or add a method.
        // For now, we'll re-process all lines.
        // This will be replaced by a proper method in the final implementation.
        core_types::Schema::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_engine_new() {
        let engine = JsonlEngine::new();
        assert_eq!(engine.total_rows, 0);
        assert_eq!(engine.error_rows, 0);
    }

    #[test]
    fn test_engine_set_total_size() {
        let mut engine = JsonlEngine::new();
        engine.set_total_size(1024.0);
        assert!(engine.scanner.is_some());
        assert!(engine.schema_extractor.is_some());
    }

    #[test]
    fn test_wasm_column_def_serialization() {
        let col = WasmColumnDef {
            key: "address.city".to_string(),
            depth: 1,
            inferred_type: "string".to_string(),
            nullable: false,
        };
        let json = serde_json::to_string(&col).unwrap();
        assert!(json.contains("address.city"));
        assert!(json.contains("string"));
    }
}
```

Wait — the `SchemaExtractor` has a private `schema` field. I need to add a `schema()` accessor method. Let me add it to `schema.rs` first.

- [ ] **Step 2: Add `schema()` accessor to SchemaExtractor**

Add to `crates/jsonl-core/src/schema.rs` inside the `impl SchemaExtractor` block:

```rust
    /// Get a reference to the current schema
    pub fn schema(&self) -> &Schema {
        &self.schema
    }
```

- [ ] **Step 3: Fix WASM lib.rs — replace clone_schema hack with proper accessor**

Replace the `clone_schema` impl block with usage of the new `schema()` method, and update `finalize_scan` to use it. Also add `serde-wasm-bindgen` dependency.

Update `crates/jsonl-wasm/Cargo.toml`:
```toml
[dependencies]
jsonl-core = { path = "../jsonl-core" }
wasm-bindgen = "0.2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
js-sys = "0.3"
serde-wasm-bindgen = "0.6"
```

- [ ] **Step 4: Verify WASM build compiles**

Run: `cargo build -p jsonl-wasm`
Expected: Compiles successfully

- [ ] **Step 5: Run WASM crate tests**

Run: `cargo test -p jsonl-wasm`
Expected: All tests PASS

- [ ] **Step 6: Commit**

```bash
git add crates/jsonl-wasm/ crates/jsonl-core/src/schema.rs
git commit -m "feat(jsonl-wasm): add WASM bindings with JsonlEngine"
```

---

### Task 9: Final Verification

- [ ] **Step 1: Run complete test suite**

Run: `cargo test --workspace`
Expected: All tests across both crates PASS

- [ ] **Step 2: Run clippy**

Run: `cargo clippy --workspace -- -D warnings`
Expected: No warnings

- [ ] **Step 3: Run format check**

Run: `cargo fmt --check`
Expected: No formatting issues (run `cargo fmt` if needed)

- [ ] **Step 4: Verify WASM build target**

Run: `cargo build -p jsonl-wasm --target wasm32-unknown-unknown`
Expected: Compiles (may need `rustup target add wasm32-unknown-unknown` first)

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "chore: phase 1 complete — Rust core parser + WASM bindings"
```

---

## Summary

| Task | Module | Tests | Key Deliverable |
|------|--------|-------|-----------------|
| 1 | Scaffolding | — | Cargo workspace builds |
| 2 | `types.rs` | 6 | LineIndex, Schema, ColumnDef, FlatRow |
| 3 | `scanner.rs` | 9 | NewlineScanner with streaming chunks |
| 4 | `schema.rs` | 10 | SchemaExtractor with incremental union |
| 5 | `parser.rs` | 9 | RowParser with on-demand parsing |
| 6 | Integration | 4 | End-to-end: fixtures → scan → schema → parse |
| 7 | Benchmarks | — | Performance baseline on 100k rows |
| 8 | `jsonl-wasm` | 3 | JsonlEngine WASM bindings |
| 9 | Verification | — | Full suite + clippy + fmt + WASM target |

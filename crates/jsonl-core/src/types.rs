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
    use serde_json::json;

    #[test]
    fn test_line_index_new() {
        let offsets = vec![
            LineOffset { start: 0, len: 42 },
            LineOffset { start: 43, len: 17 },
        ];
        let index = LineIndex::new(offsets);
        assert_eq!(index.total_lines(), 2);
        assert!(index.error_lines.is_empty());
    }

    #[test]
    fn test_line_index_get() {
        let offsets = vec![
            LineOffset { start: 0, len: 42 },
            LineOffset { start: 43, len: 17 },
            LineOffset { start: 61, len: 99 },
        ];
        let index = LineIndex::new(offsets);

        let first = index.get(0).unwrap();
        assert_eq!(first.start, 0);
        assert_eq!(first.len, 42);

        let second = index.get(1).unwrap();
        assert_eq!(second.start, 43);
        assert_eq!(second.len, 17);

        assert!(index.get(2).is_some());
        assert!(index.get(3).is_none());
    }

    #[test]
    fn test_line_index_byte_range() {
        let offsets = vec![
            LineOffset { start: 0, len: 10 },
            LineOffset { start: 11, len: 20 },
            LineOffset { start: 32, len: 5 },
        ];
        let index = LineIndex::new(offsets);

        // Range [0, 2): bytes from line 0 through line 1
        let range = index.byte_range(0, 2).unwrap();
        assert_eq!(range, (0, 31)); // 11 + 20

        // Range [1, 3): bytes from line 1 through line 2
        let range = index.byte_range(1, 3).unwrap();
        assert_eq!(range, (11, 37)); // 32 + 5

        // Invalid: end_line == 0
        assert!(index.byte_range(0, 0).is_none());

        // Invalid: start_line >= end_line
        assert!(index.byte_range(2, 1).is_none());

        // Invalid: end_line > total lines
        assert!(index.byte_range(0, 4).is_none());

        // Invalid: start_line == end_line
        assert!(index.byte_range(1, 1).is_none());
    }

    #[test]
    fn test_schema_new() {
        let schema = Schema::new();
        assert!(schema.columns.is_empty());
        assert!(schema.column_map.is_empty());
        assert!(schema.column_keys().is_empty());
    }

    #[test]
    fn test_schema_default() {
        let schema = Schema::default();
        assert!(schema.columns.is_empty());
    }

    #[test]
    fn test_flat_row_creation() {
        let mut data = HashMap::new();
        data.insert("name".to_string(), json!("Alice"));
        data.insert("age".to_string(), json!(30));

        let row = FlatRow {
            index: 0,
            data,
            error: None,
        };

        assert_eq!(row.index, 0);
        assert!(row.error.is_none());
        assert_eq!(row.data.get("name").unwrap(), &json!("Alice"));
        assert_eq!(row.data.get("age").unwrap(), &json!(30));
    }

    #[test]
    fn test_flat_row_error() {
        let row = FlatRow {
            index: 5,
            data: HashMap::new(),
            error: Some("invalid JSON at byte 1234".to_string()),
        };

        assert_eq!(row.index, 5);
        assert!(row.data.is_empty());
        assert_eq!(row.error.as_deref(), Some("invalid JSON at byte 1234"));
    }
}

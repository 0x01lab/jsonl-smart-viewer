use std::collections::HashMap;

use crate::types::{FlatRow, LineIndex, Schema};

/// On-demand row parser that uses a pre-built `LineIndex` to extract and
/// flatten specific JSONL rows from raw file bytes.
pub struct RowParser<'a> {
    line_index: &'a LineIndex,
    _schema: &'a Schema,
}

impl<'a> RowParser<'a> {
    /// Create a new parser bound to the given line index and schema.
    pub fn new(line_index: &'a LineIndex, schema: &'a Schema) -> Self {
        Self {
            line_index,
            _schema: schema,
        }
    }

    /// Parse rows in the range `[start, end)` from `data`.
    ///
    /// The range is clamped to `[0, total_lines)`, so requesting beyond the
    /// available lines simply returns fewer results.
    pub fn parse_rows(&self, data: &[u8], start: u32, end: u32) -> Vec<FlatRow> {
        let total = self.line_index.total_lines();
        let clamped_end = end.min(total);
        let mut rows = Vec::with_capacity((clamped_end.saturating_sub(start)) as usize);

        for line_num in start..clamped_end {
            match self.parse_single_row(data, line_num) {
                Ok(row) => rows.push(row),
                Err(row) => rows.push(row),
            }
        }

        rows
    }

    /// Parse a single row by line number.
    ///
    /// Returns `Ok(FlatRow)` for valid JSON and `Err(FlatRow)` for invalid
    /// JSON (the error variant contains the raw text in the `error` field).
    fn parse_single_row(&self, data: &[u8], line_num: u32) -> Result<FlatRow, FlatRow> {
        let offset = match self.line_index.get(line_num) {
            Some(o) => o,
            None => {
                return Err(FlatRow {
                    index: line_num,
                    data: HashMap::new(),
                    error: Some(format!("line {} out of range", line_num)),
                });
            }
        };

        let start = offset.start as usize;
        let end = start + offset.len as usize;
        let line_bytes = &data[start..end];

        let line_text = match std::str::from_utf8(line_bytes) {
            Ok(s) => s,
            Err(_) => {
                return Err(FlatRow {
                    index: line_num,
                    data: HashMap::new(),
                    error: Some(format!("UTF-8 decode error at line {}", line_num)),
                });
            }
        };

        match serde_json::from_str::<serde_json::Value>(line_text) {
            Ok(value) => {
                let map = flatten_to_map(&value);
                Ok(FlatRow {
                    index: line_num,
                    data: map,
                    error: None,
                })
            }
            Err(_) => Err(FlatRow {
                index: line_num,
                data: HashMap::new(),
                error: Some(line_text.to_string()),
            }),
        }
    }
}

/// Flatten a JSON value into a `HashMap<String, Value>` with dot-notation keys.
///
/// Objects are recursed into; arrays and primitives become direct entries.
fn flatten_to_map(value: &serde_json::Value) -> HashMap<String, serde_json::Value> {
    let mut map = HashMap::new();

    // Non-object root values: skip (nothing to flatten into columns)
    if let serde_json::Value::Object(obj) = value {
        for (key, child) in obj {
            flatten_value_into(key, child, &mut map);
        }
    }

    map
}

/// Recursively flatten a value into `map` with dot-notation prefix.
fn flatten_value_into(
    prefix: &str,
    value: &serde_json::Value,
    map: &mut HashMap<String, serde_json::Value>,
) {
    match value {
        serde_json::Value::Object(obj) => {
            if obj.is_empty() {
                map.insert(prefix.to_string(), value.clone());
            } else {
                for (key, child) in obj {
                    let nested_key = format!("{}.{}", prefix, key);
                    flatten_value_into(&nested_key, child, map);
                }
            }
        }
        _ => {
            map.insert(prefix.to_string(), value.clone());
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::LineOffset;
    use serde_json::json;

    /// Build test data: 4-line JSONL (2 valid, 1 invalid, 1 valid)
    /// with a manually constructed `LineIndex`.
    fn make_test_data() -> (Vec<u8>, LineIndex, Schema) {
        let lines: [&str; 4] = [
            r#"{"id":1,"name":"Alice"}"#,
            r#"{"id":2,"name":"Bob"}"#,
            r#"not json at all"#,
            r#"{"id":4,"name":"Dave"}"#,
        ];

        let content = lines.join("\n");
        let bytes = content.into_bytes();

        // Build offsets by scanning the joined string
        let mut offsets = Vec::new();
        let mut pos: u64 = 0;
        for line in &lines {
            let len = line.len() as u32;
            offsets.push(LineOffset { start: pos, len });
            pos += len as u64 + 1; // +1 for '\n'
        }

        let line_index = LineIndex::new(offsets);
        let schema = Schema::new();

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
        assert_eq!(rows[0].data.get("id").unwrap(), &json!(1));
        assert_eq!(rows[0].data.get("name").unwrap(), &json!("Alice"));
    }

    #[test]
    fn test_parse_multiple_rows() {
        let (data, line_index, schema) = make_test_data();
        let parser = RowParser::new(&line_index, &schema);

        let rows = parser.parse_rows(&data, 0, 2);
        assert_eq!(rows.len(), 2);

        assert_eq!(rows[0].index, 0);
        assert_eq!(rows[0].data.get("id").unwrap(), &json!(1));
        assert_eq!(rows[0].data.get("name").unwrap(), &json!("Alice"));

        assert_eq!(rows[1].index, 1);
        assert_eq!(rows[1].data.get("id").unwrap(), &json!(2));
        assert_eq!(rows[1].data.get("name").unwrap(), &json!("Bob"));
    }

    #[test]
    fn test_parse_error_row() {
        let (data, line_index, schema) = make_test_data();
        let parser = RowParser::new(&line_index, &schema);

        let rows = parser.parse_rows(&data, 2, 3);
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].index, 2);
        assert!(rows[0].error.is_some());
        assert_eq!(rows[0].error.as_deref(), Some("not json at all"));
        assert!(rows[0].data.is_empty());
    }

    #[test]
    fn test_parse_mixed_valid_and_error() {
        let (data, line_index, schema) = make_test_data();
        let parser = RowParser::new(&line_index, &schema);

        let rows = parser.parse_rows(&data, 0, 4);
        assert_eq!(rows.len(), 4);

        // Row 0: valid
        assert!(rows[0].error.is_none());
        assert_eq!(rows[0].data.get("id").unwrap(), &json!(1));

        // Row 1: valid
        assert!(rows[1].error.is_none());
        assert_eq!(rows[1].data.get("id").unwrap(), &json!(2));

        // Row 2: invalid
        assert!(rows[2].error.is_some());
        assert!(rows[2].data.is_empty());

        // Row 3: valid
        assert!(rows[3].error.is_none());
        assert_eq!(rows[3].data.get("id").unwrap(), &json!(4));
    }

    #[test]
    fn test_parse_out_of_range_clamps() {
        let (data, line_index, schema) = make_test_data();
        let parser = RowParser::new(&line_index, &schema);

        // Request rows 2..10 — only 4 lines exist, so clamped to 2..4
        let rows = parser.parse_rows(&data, 2, 10);
        assert_eq!(rows.len(), 2); // lines 2 and 3 only
        assert_eq!(rows[0].index, 2);
        assert_eq!(rows[1].index, 3);

        // Request rows 4..8 — all beyond available, clamped to empty
        let rows = parser.parse_rows(&data, 4, 8);
        assert!(rows.is_empty());
    }

    #[test]
    fn test_parse_nested_flattening() {
        // Build a single line with nested JSON
        let line = r#"{"id":1,"address":{"city":"Shanghai","zip":"200000"}}"#;
        let bytes = line.as_bytes();
        let offsets = vec![LineOffset {
            start: 0,
            len: line.len() as u32,
        }];
        let line_index = LineIndex::new(offsets);
        let schema = Schema::new();
        let parser = RowParser::new(&line_index, &schema);

        let rows = parser.parse_rows(&bytes, 0, 1);
        assert_eq!(rows.len(), 1);
        assert!(rows[0].error.is_none());
        assert_eq!(rows[0].data.get("id").unwrap(), &json!(1));
        assert_eq!(
            rows[0].data.get("address.city").unwrap(),
            &json!("Shanghai")
        );
        assert_eq!(rows[0].data.get("address.zip").unwrap(), &json!("200000"));
    }

    #[test]
    fn test_flatten_to_map_simple() {
        let value = json!({"a": 1, "b": "x"});
        let map = flatten_to_map(&value);
        assert_eq!(map.len(), 2);
        assert_eq!(map.get("a").unwrap(), &json!(1));
        assert_eq!(map.get("b").unwrap(), &json!("x"));
    }

    #[test]
    fn test_flatten_to_map_nested() {
        let value = json!({"a": {"b": {"c": 42}}});
        let map = flatten_to_map(&value);
        assert_eq!(map.len(), 1);
        assert_eq!(map.get("a.b.c").unwrap(), &json!(42));
    }

    #[test]
    fn test_flatten_to_map_with_null() {
        let value = json!({"a": null, "b": 1});
        let map = flatten_to_map(&value);
        assert_eq!(map.len(), 2);
        assert!(map.get("a").unwrap().is_null());
        assert_eq!(map.get("b").unwrap(), &json!(1));
    }
}

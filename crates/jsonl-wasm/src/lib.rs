use std::collections::HashMap;

use wasm_bindgen::prelude::*;
use jsonl_core::{NewlineScanner, SchemaExtractor, RowParser, types as core_types};

/// WASM-facing column definition
#[derive(serde::Serialize, serde::Deserialize)]
pub struct WasmColumnDef {
    pub key: String,
    pub depth: u8,
    pub inferred_type: String,
    pub nullable: bool,
}

/// WASM-facing schema result
#[derive(serde::Serialize)]
pub struct WasmSchemaResult {
    pub columns: Vec<WasmColumnDef>,
    pub total_rows: u32,
    pub error_rows: u32,
}

/// WASM-facing row data
#[derive(serde::Serialize)]
pub struct WasmRow {
    pub index: u32,
    pub data: serde_json::Value,
    pub error: Option<String>,
}

fn value_type_to_string(vt: &core_types::ValueType) -> String {
    match vt {
        core_types::ValueType::String => "String".to_string(),
        core_types::ValueType::Number => "Number".to_string(),
        core_types::ValueType::Boolean => "Boolean".to_string(),
        core_types::ValueType::Object => "Object".to_string(),
        core_types::ValueType::Array => "Array".to_string(),
        core_types::ValueType::Null => "Null".to_string(),
        core_types::ValueType::Mixed => "Mixed".to_string(),
    }
}

#[wasm_bindgen]
pub struct JsonlEngine {
    scanner: Option<NewlineScanner>,
    schema_extractor: Option<SchemaExtractor>,
    offsets: Option<Vec<core_types::LineOffset>>,
    line_index: Option<core_types::LineIndex>,
    schema: Option<core_types::Schema>,
    total_rows: u32,
    error_rows: u32,
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

    /// Set the expected total file size. Creates the NewlineScanner and SchemaExtractor.
    pub fn set_total_size(&mut self, size: f64) {
        self.scanner = Some(NewlineScanner::new(size as u64));
        self.schema_extractor = Some(SchemaExtractor::new());
    }

    /// Feed a chunk of bytes. Appends to internal buffer and scans for newlines.
    /// Returns progress as a fraction 0.0..1.0.
    pub fn feed_chunk(&mut self, chunk: &[u8]) -> f64 {
        self.raw_data.extend_from_slice(chunk);
        if let Some(ref mut scanner) = self.scanner {
            let result = scanner.feed_chunk(chunk);
            result.progress
        } else {
            0.0
        }
    }

    /// Finalize the scan: finish newline scanning, extract schema from all rows,
    /// build line index, and return the schema result as a JS value.
    pub fn finalize_scan(&mut self) -> JsValue {
        // Step 1: Finish scanner to get offsets
        let offsets = match self.scanner.take() {
            Some(scanner) => scanner.finish(),
            None => Vec::new(),
        };
        self.offsets = Some(offsets.clone());

        // Step 2: Iterate all offsets, extract each line, process_line on SchemaExtractor
        let mut error_lines = std::collections::HashSet::new();
        let mut error_count: u32 = 0;

        if let Some(ref mut extractor) = self.schema_extractor {
            for (i, offset) in offsets.iter().enumerate() {
                let start = offset.start as usize;
                let end = start + offset.len as usize;
                if end <= self.raw_data.len() {
                    let line_bytes = &self.raw_data[start..end];
                    if let Ok(line_text) = std::str::from_utf8(line_bytes) {
                        if !extractor.process_line(line_text) {
                            error_lines.insert(i as u32);
                            error_count += 1;
                        }
                    } else {
                        error_lines.insert(i as u32);
                        error_count += 1;
                    }
                }
            }
        }

        self.total_rows = offsets.len() as u32;
        self.error_rows = error_count;

        // Step 3: Build LineIndex with error_lines
        let line_index = core_types::LineIndex {
            offsets,
            error_lines,
        };
        self.line_index = Some(line_index);

        // Extract the schema from the extractor
        let schema = match self.schema_extractor.take() {
            Some(extractor) => extractor.into_schema(),
            None => core_types::Schema::new(),
        };

        let wasm_columns: Vec<WasmColumnDef> = schema
            .columns
            .iter()
            .map(|col| WasmColumnDef {
                key: col.key.clone(),
                depth: col.depth,
                inferred_type: value_type_to_string(&col.inferred_type),
                nullable: col.nullable,
            })
            .collect();

        self.schema = Some(schema);

        let result = WasmSchemaResult {
            columns: wasm_columns,
            total_rows: self.total_rows,
            error_rows: self.error_rows,
        };

        serde_wasm_bindgen::to_value(&result).unwrap_or(JsValue::NULL)
    }

    /// Parse rows in the range [start, end) and return them as a JS value.
    pub fn get_rows(&self, start: u32, end: u32) -> JsValue {
        let line_index = match &self.line_index {
            Some(li) => li,
            None => return JsValue::NULL,
        };
        let schema = match &self.schema {
            Some(s) => s,
            None => return JsValue::NULL,
        };

        let parser = RowParser::new(line_index, schema);
        let flat_rows = parser.parse_rows(&self.raw_data, start, end);

        let wasm_rows: Vec<WasmRow> = flat_rows
            .into_iter()
            .map(|fr| {
                let data_value = hashmap_to_json_object(&fr.data);
                WasmRow {
                    index: fr.index,
                    data: data_value,
                    error: fr.error,
                }
            })
            .collect();

        serde_wasm_bindgen::to_value(&wasm_rows).unwrap_or(JsValue::NULL)
    }
}

/// Convert a HashMap<String, serde_json::Value> to a serde_json::Value::Object
fn hashmap_to_json_object(map: &HashMap<String, serde_json::Value>) -> serde_json::Value {
    let mut obj = serde_json::Map::with_capacity(map.len());
    for (k, v) in map {
        obj.insert(k.clone(), v.clone());
    }
    serde_json::Value::Object(obj)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_engine_new() {
        let engine = JsonlEngine::new();
        assert!(engine.scanner.is_none());
        assert!(engine.schema_extractor.is_none());
        assert!(engine.offsets.is_none());
        assert!(engine.line_index.is_none());
        assert!(engine.schema.is_none());
        assert_eq!(engine.total_rows, 0);
        assert_eq!(engine.error_rows, 0);
        assert!(engine.raw_data.is_empty());
    }

    #[test]
    fn test_engine_set_total_size() {
        let mut engine = JsonlEngine::new();
        engine.set_total_size(1024.0);

        assert!(engine.scanner.is_some());
        assert!(engine.schema_extractor.is_some());
        assert_eq!(engine.total_rows, 0);
        assert_eq!(engine.error_rows, 0);
    }

    #[test]
    fn test_wasm_column_def_serialization() {
        let col = WasmColumnDef {
            key: "address.city".to_string(),
            depth: 1,
            inferred_type: "String".to_string(),
            nullable: true,
        };

        let json = serde_json::to_string(&col).unwrap();
        assert!(json.contains("\"key\":\"address.city\""));
        assert!(json.contains("\"depth\":1"));
        assert!(json.contains("\"inferred_type\":\"String\""));
        assert!(json.contains("\"nullable\":true"));

        // Verify round-trip deserialization
        let deserialized: WasmColumnDef = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.key, "address.city");
        assert_eq!(deserialized.depth, 1);
        assert_eq!(deserialized.inferred_type, "String");
        assert!(deserialized.nullable);
    }
}

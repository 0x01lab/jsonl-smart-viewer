use crate::types::{ColumnDef, Schema, ValueType};
use serde_json::Value;

/// Incrementally builds a Schema from JSON lines.
///
/// Processes JSONL rows one at a time, extracting dot-notation keys and
/// tracking value types across the entire file. Supports:
/// - Nested object flattening (`{"a":{"b":1}}` → key `"a.b"`)
/// - Type conflict detection (value is Number in one row, String in another → Mixed)
/// - Nullable tracking (field missing in some rows, or explicitly null)
/// - Insertion-order preservation of columns
pub struct SchemaExtractor {
    schema: Schema,
}

impl SchemaExtractor {
    /// Create a new, empty schema extractor.
    pub fn new() -> Self {
        Self {
            schema: Schema::new(),
        }
    }

    /// Process a raw JSON line string. Returns `true` if the line was valid JSON,
    /// `false` if it could not be parsed.
    pub fn process_line(&mut self, line: &str) -> bool {
        match serde_json::from_str::<Value>(line) {
            Ok(value) => {
                self.process_value(&value);
                true
            }
            Err(_) => false,
        }
    }

    /// Process a pre-parsed JSON value.
    pub fn process_value(&mut self, value: &Value) {
        let flat = flatten_value("", value, 0);
        self.merge_flat_keys(&flat);
    }

    /// Returns the number of columns discovered so far.
    pub fn column_count(&self) -> usize {
        self.schema.columns.len()
    }

    /// Returns a reference to the current schema.
    pub fn schema(&self) -> &Schema {
        &self.schema
    }

    /// Consume the extractor and return the final Schema.
    pub fn into_schema(self) -> Schema {
        self.schema
    }

    /// Merge a set of flattened keys from one row into the accumulated schema.
    ///
    /// - New key: add to columns + column_map.
    /// - Existing key with same type: no change.
    /// - Existing key with Null → other type: update type, keep nullable=true.
    /// - Existing key with other type → Null: set nullable=true.
    /// - Existing key with conflicting non-null types: set Mixed.
    fn merge_flat_keys(&mut self, keys: &[(String, u8, ValueType)]) {
        // Track which columns appeared in this row so we can mark missing ones as nullable
        let mut seen_keys = std::collections::HashSet::new();

        for (key, depth, value_type) in keys {
            seen_keys.insert(key.as_str());

            if let Some(&idx) = self.schema.column_map.get(key.as_str()) {
                let col = &mut self.schema.columns[idx];

                match (&col.inferred_type, value_type) {
                    // Same type — no change
                    (existing, new) if existing == new => {}
                    // Existing is Null, new is something else — upgrade type, keep nullable
                    (ValueType::Null, _) => {
                        col.inferred_type = value_type.clone();
                        col.nullable = true;
                    }
                    // New value is Null — mark nullable
                    (_, ValueType::Null) => {
                        col.nullable = true;
                    }
                    // Conflicting non-null types — set Mixed
                    _ => {
                        col.inferred_type = ValueType::Mixed;
                        col.nullable = true;
                    }
                }
            } else {
                // New column
                let nullable = value_type == &ValueType::Null;
                let idx = self.schema.columns.len();
                self.schema.columns.push(ColumnDef {
                    key: key.clone(),
                    depth: *depth,
                    inferred_type: value_type.clone(),
                    nullable,
                });
                self.schema.column_map.insert(key.clone(), idx);
            }
        }

        // Any existing column not seen in this row is nullable
        for col in &mut self.schema.columns {
            if !seen_keys.contains(col.key.as_str()) {
                col.nullable = true;
            }
        }
    }
}

impl Default for SchemaExtractor {
    fn default() -> Self {
        Self::new()
    }
}

/// Recursively flatten a JSON value into dot-notation key tuples.
///
/// Returns a vector of `(key, depth, ValueType)`.
///
/// - Root level (empty prefix): iterate object fields with field name as key, depth 0.
/// - Nested Object: recurse with `prefix.field`, depth+1.
/// - Empty Object: return `(prefix, depth, Object)`.
/// - Array: return `(prefix, depth, Array)` — no recursion into items.
/// - Primitives: return `(prefix, depth, Type)`.
/// - Null at root level (empty prefix): skip entirely.
fn flatten_value(prefix: &str, value: &Value, depth: u8) -> Vec<(String, u8, ValueType)> {
    match value {
        Value::Object(map) => {
            if prefix.is_empty() {
                // Root level: iterate fields directly
                let mut result = Vec::new();
                for (field_key, field_val) in map {
                    let mut entries = flatten_value(field_key, field_val, 0);
                    result.append(&mut entries);
                }
                result
            } else if map.is_empty() {
                // Empty nested object
                vec![(prefix.to_string(), depth, ValueType::Object)]
            } else {
                // Nested object: recurse with dot-notation
                let mut result = Vec::new();
                for (field_key, field_val) in map {
                    let nested_prefix = format!("{}.{}", prefix, field_key);
                    let mut entries = flatten_value(&nested_prefix, field_val, depth + 1);
                    result.append(&mut entries);
                }
                result
            }
        }
        Value::Array(_) => {
            if prefix.is_empty() {
                // Root-level array: skip (don't add to schema)
                vec![]
            } else {
                vec![(prefix.to_string(), depth, ValueType::Array)]
            }
        }
        Value::String(_) => {
            if prefix.is_empty() {
                vec![]
            } else {
                vec![(prefix.to_string(), depth, ValueType::String)]
            }
        }
        Value::Number(_) => {
            if prefix.is_empty() {
                vec![]
            } else {
                vec![(prefix.to_string(), depth, ValueType::Number)]
            }
        }
        Value::Bool(_) => {
            if prefix.is_empty() {
                vec![]
            } else {
                vec![(prefix.to_string(), depth, ValueType::Boolean)]
            }
        }
        Value::Null => {
            if prefix.is_empty() {
                // Null at root level: skip
                vec![]
            } else {
                vec![(prefix.to_string(), depth, ValueType::Null)]
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn test_flatten_simple_object() {
        let value = json!({"id": 1, "name": "Alice"});
        let flat = flatten_value("", &value, 0);
        assert_eq!(flat.len(), 2);

        let keys: Vec<&str> = flat.iter().map(|(k, _, _)| k.as_str()).collect();
        assert!(keys.contains(&"id"));
        assert!(keys.contains(&"name"));

        let id_entry = flat.iter().find(|(k, _, _)| k == "id").unwrap();
        assert_eq!(id_entry.2, ValueType::Number);

        let name_entry = flat.iter().find(|(k, _, _)| k == "name").unwrap();
        assert_eq!(name_entry.2, ValueType::String);
    }

    #[test]
    fn test_flatten_nested_object() {
        let value = json!({"address": {"city": "Shanghai", "zip": "200000"}});
        let flat = flatten_value("", &value, 0);
        assert_eq!(flat.len(), 2);

        let keys: Vec<&str> = flat.iter().map(|(k, _, _)| k.as_str()).collect();
        assert!(keys.contains(&"address.city"));
        assert!(keys.contains(&"address.zip"));

        let city = flat.iter().find(|(k, _, _)| k == "address.city").unwrap();
        assert_eq!(city.1, 1); // depth 1
        assert_eq!(city.2, ValueType::String);

        let zip = flat.iter().find(|(k, _, _)| k == "address.zip").unwrap();
        assert_eq!(zip.1, 1); // depth 1
        assert_eq!(zip.2, ValueType::String);
    }

    #[test]
    fn test_flatten_array() {
        let value = json!({"tags": ["vip", "active"]});
        let flat = flatten_value("", &value, 0);
        assert_eq!(flat.len(), 1);

        assert_eq!(flat[0].0, "tags");
        assert_eq!(flat[0].2, ValueType::Array);
    }

    #[test]
    fn test_flatten_null() {
        let value = json!({"email": null});
        let flat = flatten_value("", &value, 0);
        assert_eq!(flat.len(), 1);

        assert_eq!(flat[0].0, "email");
        assert_eq!(flat[0].2, ValueType::Null);
    }

    #[test]
    fn test_flatten_boolean() {
        let value = json!({"active": true});
        let flat = flatten_value("", &value, 0);
        assert_eq!(flat.len(), 1);

        assert_eq!(flat[0].0, "active");
        assert_eq!(flat[0].2, ValueType::Boolean);
    }

    #[test]
    fn test_schema_union_heterogeneous_rows() {
        let mut extractor = SchemaExtractor::new();

        assert!(extractor.process_line(r#"{"id": 1, "name": "Alice"}"#));
        assert!(extractor.process_line(r#"{"id": 2, "email": "bob@test.com"}"#));
        assert!(extractor.process_line(r#"{"id": 3, "age": 30, "city": "Shanghai"}"#));

        // Union of all keys: id, name, email, age, city = 5 columns
        // But name is only in row 1, email only in row 2, age/city only in row 3
        // id is in all 3 rows
        assert_eq!(extractor.column_count(), 5);

        let schema = extractor.into_schema();
        let keys = schema.column_keys();

        assert!(keys.contains(&"id"));
        assert!(keys.contains(&"name"));
        assert!(keys.contains(&"email"));
        assert!(keys.contains(&"age"));
        assert!(keys.contains(&"city"));

        // id is in all rows — not nullable
        let id_col = schema.columns.iter().find(|c| c.key == "id").unwrap();
        assert!(!id_col.nullable);

        // name is missing from rows 2 and 3 — nullable
        let name_col = schema.columns.iter().find(|c| c.key == "name").unwrap();
        assert!(name_col.nullable);
    }

    #[test]
    fn test_schema_type_inference_mixed() {
        let mut extractor = SchemaExtractor::new();

        assert!(extractor.process_line(r#"{"value": 42}"#));
        assert!(extractor.process_line(r#"{"value": "string"}"#));

        let schema = extractor.into_schema();
        let col = schema.columns.iter().find(|c| c.key == "value").unwrap();

        assert_eq!(col.inferred_type, ValueType::Mixed);
        assert!(col.nullable);
    }

    #[test]
    fn test_schema_nullable_tracking() {
        let mut extractor = SchemaExtractor::new();

        assert!(extractor.process_line(r#"{"id": 1, "email": "a@b.com"}"#));
        assert!(extractor.process_line(r#"{"id": 2}"#));

        let schema = extractor.into_schema();

        // id is in both rows — not nullable
        let id_col = schema.columns.iter().find(|c| c.key == "id").unwrap();
        assert!(!id_col.nullable);

        // email is missing from row 2 — nullable
        let email_col = schema.columns.iter().find(|c| c.key == "email").unwrap();
        assert!(email_col.nullable);
    }

    #[test]
    fn test_schema_null_then_value() {
        let mut extractor = SchemaExtractor::new();

        assert!(extractor.process_line(r#"{"email": null}"#));
        assert!(extractor.process_line(r#"{"email": "user@test.com"}"#));

        let schema = extractor.into_schema();
        let col = schema.columns.iter().find(|c| c.key == "email").unwrap();

        // After seeing null then string, type should be String, nullable=true
        assert_eq!(col.inferred_type, ValueType::String);
        assert!(col.nullable);
    }

    #[test]
    fn test_schema_invalid_json_returns_false() {
        let mut extractor = SchemaExtractor::new();

        assert!(extractor.process_line(r#"{"valid": true}"#));
        assert!(!extractor.process_line(r#"this is not json"#));
        assert!(!extractor.process_line(r#"{broken json"#));
        assert!(extractor.process_line(r#"{"also_valid": 1}"#));

        // Only the 2 valid lines should have contributed columns
        assert_eq!(extractor.column_count(), 2);
    }

    #[test]
    fn test_schema_preserves_insertion_order() {
        // Use multiple rows where each introduces new keys to verify
        // that columns are stored in the order they are first seen.
        // (Note: serde_json's default Map uses BTreeMap, so key order
        // within a single JSON object is alphabetical. We test cross-row
        // insertion order instead.)
        let mut extractor = SchemaExtractor::new();

        assert!(extractor.process_line(r#"{"a": 1}"#));
        assert!(extractor.process_line(r#"{"b": 2}"#));
        assert!(extractor.process_line(r#"{"c": 3}"#));

        let schema = extractor.into_schema();
        let keys = schema.column_keys();

        // Each row introduces one new key in order: a, b, c
        assert_eq!(keys, vec!["a", "b", "c"]);
    }
}

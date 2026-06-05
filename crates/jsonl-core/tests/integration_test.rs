use jsonl_core::types;
use jsonl_core::*;
use std::collections::HashSet;

/// Read a test fixture file from tests/fixtures/{name}.
fn read_fixture(name: &str) -> Vec<u8> {
    let path = format!("tests/fixtures/{}", name);
    std::fs::read(&path).unwrap_or_else(|e| panic!("failed to read fixture '{}': {}", path, e))
}

/// Scan all lines from raw bytes and return line offsets.
fn scan_all(data: &[u8]) -> Vec<types::LineOffset> {
    let mut scanner = NewlineScanner::new(data.len() as u64);
    scanner.feed_chunk(data);
    scanner.finish()
}

/// Extract schema from the given data using the provided offsets.
/// Returns the schema and the set of line indices that failed to parse.
fn extract_schema(data: &[u8], offsets: &[types::LineOffset]) -> (types::Schema, HashSet<u32>) {
    let mut extractor = SchemaExtractor::new();
    let mut error_lines = HashSet::new();

    for (i, offset) in offsets.iter().enumerate() {
        let start = offset.start as usize;
        let end = start + offset.len as usize;
        let line_text = std::str::from_utf8(&data[start..end]).unwrap();
        if !extractor.process_line(line_text) {
            error_lines.insert(i as u32);
        }
    }

    (extractor.into_schema(), error_lines)
}

// ---------------------------------------------------------------------------
// Test 1: simple.jsonl — 3 homogeneous rows, 4 columns, no errors
// ---------------------------------------------------------------------------
#[test]
fn test_simple_jsonl_end_to_end() {
    let data = read_fixture("simple.jsonl");
    let offsets = scan_all(&data);

    // Should find exactly 3 lines
    assert_eq!(offsets.len(), 3);

    // Extract schema — should have 4 columns, no error lines
    let (schema, error_lines) = extract_schema(&data, &offsets);
    assert!(
        error_lines.is_empty(),
        "expected no error lines, got {:?}",
        error_lines
    );

    let keys = schema.column_keys();
    assert_eq!(keys.len(), 4);

    // Verify all expected columns exist
    assert!(keys.contains(&"id"), "missing column 'id'");
    assert!(keys.contains(&"name"), "missing column 'name'");
    assert!(keys.contains(&"age"), "missing column 'age'");
    assert!(keys.contains(&"active"), "missing column 'active'");

    // Parse all rows and verify data
    let line_index = types::LineIndex::new(offsets);
    let parser = RowParser::new(&line_index, &schema);
    let rows = parser.parse_rows(&data, 0, 3);

    assert_eq!(rows.len(), 3);

    // Row 0: Alice
    assert!(rows[0].error.is_none());
    assert_eq!(rows[0].data.get("id").unwrap(), &serde_json::json!(1));
    assert_eq!(
        rows[0].data.get("name").unwrap(),
        &serde_json::json!("Alice")
    );
    assert_eq!(rows[0].data.get("age").unwrap(), &serde_json::json!(30));
    assert_eq!(
        rows[0].data.get("active").unwrap(),
        &serde_json::json!(true)
    );

    // Row 1: Bob
    assert!(rows[1].error.is_none());
    assert_eq!(rows[1].data.get("id").unwrap(), &serde_json::json!(2));
    assert_eq!(rows[1].data.get("name").unwrap(), &serde_json::json!("Bob"));
    assert_eq!(rows[1].data.get("age").unwrap(), &serde_json::json!(25));
    assert_eq!(
        rows[1].data.get("active").unwrap(),
        &serde_json::json!(false)
    );

    // Row 2: Charlie
    assert!(rows[2].error.is_none());
    assert_eq!(rows[2].data.get("id").unwrap(), &serde_json::json!(3));
    assert_eq!(
        rows[2].data.get("name").unwrap(),
        &serde_json::json!("Charlie")
    );
    assert_eq!(rows[2].data.get("age").unwrap(), &serde_json::json!(35));
    assert_eq!(
        rows[2].data.get("active").unwrap(),
        &serde_json::json!(true)
    );
}

// ---------------------------------------------------------------------------
// Test 2: heterogeneous.jsonl — varying schemas, nested objects, arrays
// ---------------------------------------------------------------------------
#[test]
fn test_heterogeneous_jsonl_end_to_end() {
    let data = read_fixture("heterogeneous.jsonl");
    let offsets = scan_all(&data);

    // Should find exactly 3 lines
    assert_eq!(offsets.len(), 3);

    // Extract schema
    let (schema, error_lines) = extract_schema(&data, &offsets);
    assert!(
        error_lines.is_empty(),
        "expected no error lines, got {:?}",
        error_lines
    );

    let keys = schema.column_keys();
    // Should have at least 7 columns:
    //   id, name, email, address.city, address.zip, age, tags
    assert!(
        keys.len() >= 7,
        "expected at least 7 columns, got {}: {:?}",
        keys.len(),
        keys
    );

    // Verify key nested and special columns
    assert!(keys.contains(&"id"), "missing column 'id'");
    assert!(keys.contains(&"name"), "missing column 'name'");
    assert!(keys.contains(&"email"), "missing column 'email'");
    assert!(
        keys.contains(&"address.city"),
        "missing column 'address.city'"
    );
    assert!(
        keys.contains(&"address.zip"),
        "missing column 'address.zip'"
    );
    assert!(keys.contains(&"age"), "missing column 'age'");
    assert!(keys.contains(&"tags"), "missing column 'tags'");

    // Parse rows and verify missing-key handling
    let line_index = types::LineIndex::new(offsets);
    let parser = RowParser::new(&line_index, &schema);
    let rows = parser.parse_rows(&data, 0, 3);

    assert_eq!(rows.len(), 3);

    // Row 0 (Alice): has id, name, email, address.city, address.zip — missing age, tags
    assert!(rows[0].error.is_none());
    assert_eq!(rows[0].data.get("id").unwrap(), &serde_json::json!(1));
    assert_eq!(
        rows[0].data.get("name").unwrap(),
        &serde_json::json!("Alice")
    );
    assert_eq!(
        rows[0].data.get("address.city").unwrap(),
        &serde_json::json!("Shanghai")
    );
    assert_eq!(
        rows[0].data.get("address.zip").unwrap(),
        &serde_json::json!("200000")
    );
    assert!(
        rows[0].data.get("age").is_none(),
        "row 0 should not have 'age'"
    );
    assert!(
        rows[0].data.get("tags").is_none(),
        "row 0 should not have 'tags'"
    );

    // Row 1 (Bob): has id, name, age — missing email, address.*, tags
    assert!(rows[1].error.is_none());
    assert_eq!(rows[1].data.get("id").unwrap(), &serde_json::json!(2));
    assert_eq!(rows[1].data.get("name").unwrap(), &serde_json::json!("Bob"));
    assert_eq!(rows[1].data.get("age").unwrap(), &serde_json::json!(25));
    assert!(
        rows[1].data.get("email").is_none(),
        "row 1 should not have 'email'"
    );
    assert!(
        rows[1].data.get("address.city").is_none(),
        "row 1 should not have 'address.city'"
    );

    // Row 2 (Charlie): has id, name, email, address.city, tags — missing address.zip, age
    assert!(rows[2].error.is_none());
    assert_eq!(rows[2].data.get("id").unwrap(), &serde_json::json!(3));
    assert_eq!(
        rows[2].data.get("email").unwrap(),
        &serde_json::json!("charlie@example.com")
    );
    assert_eq!(
        rows[2].data.get("address.city").unwrap(),
        &serde_json::json!("Beijing")
    );
    assert!(
        rows[2].data.get("address.zip").is_none(),
        "row 2 should not have 'address.zip'"
    );
    assert!(
        rows[2].data.get("age").is_none(),
        "row 2 should not have 'age'"
    );
}

// ---------------------------------------------------------------------------
// Test 3: with_errors.jsonl — 6 lines, 2 invalid, error rows have raw text
// ---------------------------------------------------------------------------
#[test]
fn test_with_errors_jsonl_end_to_end() {
    let data = read_fixture("with_errors.jsonl");
    let offsets = scan_all(&data);

    // Should find exactly 6 lines
    assert_eq!(offsets.len(), 6);

    // Extract schema — should identify 2 error lines
    let (schema, error_lines) = extract_schema(&data, &offsets);
    assert_eq!(
        error_lines.len(),
        2,
        "expected 2 error lines, got {:?}",
        error_lines
    );
    assert!(
        error_lines.contains(&1),
        "line 1 '{{invalid json' should be an error line"
    );
    assert!(
        error_lines.contains(&4),
        "line 4 'broken {{ again' should be an error line"
    );

    // Parse all rows
    let line_index = types::LineIndex::new(offsets);
    let parser = RowParser::new(&line_index, &schema);
    let rows = parser.parse_rows(&data, 0, 6);

    assert_eq!(rows.len(), 6);

    // Row 0 (valid): {"id":1,"name":"Alice"}
    assert!(rows[0].error.is_none());
    assert_eq!(rows[0].data.get("id").unwrap(), &serde_json::json!(1));
    assert_eq!(
        rows[0].data.get("name").unwrap(),
        &serde_json::json!("Alice")
    );

    // Row 1 (invalid): {invalid json
    assert!(rows[1].error.is_some());
    assert!(rows[1].data.is_empty(), "error row should have empty data");
    assert!(
        rows[1].error.as_deref().unwrap().contains("invalid"),
        "error text should contain original line content"
    );

    // Row 2 (valid): {"id":3,"name":"Charlie"}
    assert!(rows[2].error.is_none());
    assert_eq!(rows[2].data.get("id").unwrap(), &serde_json::json!(3));
    assert_eq!(
        rows[2].data.get("name").unwrap(),
        &serde_json::json!("Charlie")
    );

    // Row 3 (valid): {"id":4}
    assert!(rows[3].error.is_none());
    assert_eq!(rows[3].data.get("id").unwrap(), &serde_json::json!(4));
    assert!(
        rows[3].data.get("name").is_none(),
        "row 3 should not have 'name'"
    );

    // Row 4 (invalid): broken { again
    assert!(rows[4].error.is_some());
    assert!(rows[4].data.is_empty());
    assert!(
        rows[4].error.as_deref().unwrap().contains("broken"),
        "error text should contain original line content"
    );

    // Row 5 (valid): {"id":6,"name":"Frank"}
    assert!(rows[5].error.is_none());
    assert_eq!(rows[5].data.get("id").unwrap(), &serde_json::json!(6));
    assert_eq!(
        rows[5].data.get("name").unwrap(),
        &serde_json::json!("Frank")
    );
}

// ---------------------------------------------------------------------------
// Test 4: parse specific range — only row 1 from simple.jsonl (Bob)
// ---------------------------------------------------------------------------
#[test]
fn test_parse_specific_range() {
    let data = read_fixture("simple.jsonl");
    let offsets = scan_all(&data);

    assert_eq!(offsets.len(), 3);

    let (schema, _) = extract_schema(&data, &offsets);
    let line_index = types::LineIndex::new(offsets);
    let parser = RowParser::new(&line_index, &schema);

    // Parse only row index 1 — should be Bob
    let rows = parser.parse_rows(&data, 1, 2);
    assert_eq!(rows.len(), 1);

    assert!(rows[0].error.is_none());
    assert_eq!(rows[0].index, 1);
    assert_eq!(rows[0].data.get("id").unwrap(), &serde_json::json!(2));
    assert_eq!(rows[0].data.get("name").unwrap(), &serde_json::json!("Bob"));
    assert_eq!(rows[0].data.get("age").unwrap(), &serde_json::json!(25));
    assert_eq!(
        rows[0].data.get("active").unwrap(),
        &serde_json::json!(false)
    );
}

use jsonl_core::*;
use jsonl_core::types;
use std::collections::HashSet;

/// Test parsing a real Claude Code session JSONL file
fn read_claude_session() -> Vec<u8> {
    let path = std::path::Path::new("/Users/leo/.claude/projects/-Users-leo-project-exio/5e8ea1e5-e410-4ce1-b33e-d5e2d5f2f3ef.jsonl");
    std::fs::read(path).expect("Failed to read Claude session file")
}

#[test]
fn test_parse_claude_session() {
    let data = read_claude_session();

    // Step 1: Scan for lines
    let mut scanner = NewlineScanner::new(data.len() as u64);
    scanner.feed_chunk(&data);
    let offsets = scanner.finish();
    println!("📊 Scanned {} lines from {} bytes", offsets.len(), data.len());

    // Step 2: Extract schema
    let mut extractor = SchemaExtractor::new();
    let mut error_lines = HashSet::new();

    for (i, offset) in offsets.iter().enumerate() {
        let start = offset.start as usize;
        let end = start + offset.len as usize;
        if end <= data.len() {
            if let Ok(line_str) = std::str::from_utf8(&data[start..end]) {
                if !extractor.process_line(line_str) {
                    error_lines.insert(i as u32);
                }
            }
        }
    }

    let schema = extractor.into_schema();
    println!("\n📋 Schema: {} columns discovered", schema.columns.len());
    println!("   Error lines: {}/{}", error_lines.len(), offsets.len());

    // Print all columns with types
    println!("\n┌─────────────────────────────────────────────────────────────────────┐");
    println!("│ {:<40} │ {:<8} │ {:<6} │", "Column Key", "Type", "Null?");
    println!("├─────────────────────────────────────────────────────────────────────┤");
    for col in &schema.columns {
        println!("│ {:<40} │ {:<8} │ {:<6} │", col.key, format!("{:?}", col.inferred_type), if col.nullable { "Yes" } else { "" });
    }
    println!("└─────────────────────────────────────────────────────────────────────┘");

    // Step 3: Parse all rows and show summary
    let line_index = types::LineIndex {
        offsets: offsets.clone(),
        error_lines: error_lines.clone(),
    };
    let parser = RowParser::new(&line_index, &schema);
    let rows = parser.parse_rows(&data, 0, offsets.len() as u32);

    println!("\n📝 Parsed {} rows:", rows.len());
    let mut type_counts: std::collections::HashMap<String, u32> = std::collections::HashMap::new();
    for row in &rows {
        if let Some(_) = &row.error {
            *type_counts.entry("error".to_string()).or_insert(0) += 1;
        } else if let Some(t) = row.data.get("type").and_then(|v| v.as_str()) {
            *type_counts.entry(t.to_string()).or_insert(0) += 1;
        }
    }

    println!("\n   Row types distribution:");
    let mut sorted_types: Vec<_> = type_counts.iter().collect();
    sorted_types.sort_by(|a, b| b.1.cmp(a.1));
    for (t, count) in &sorted_types {
        println!("   {:<30} ×{}", t, count);
    }

    // Step 4: Show first 3 non-error rows as samples
    println!("\n🔍 Sample rows (first 3 non-error):");
    let mut shown = 0;
    for row in &rows {
        if row.error.is_none() && shown < 3 {
            let row_type = row.data.get("type").and_then(|v| v.as_str()).unwrap_or("?");
            let uuid = row.data.get("uuid").and_then(|v| v.as_str()).unwrap_or("?");
            let ts = row.data.get("timestamp").and_then(|v| v.as_str()).unwrap_or("?");
            println!("\n   Row #{}:", row.index);
            println!("     type: {}", row_type);
            println!("     uuid: {}…", &uuid[..uuid.len().min(8)]);
            println!("     timestamp: {}", ts);

            // Show nested message content if present
            if let Some(msg) = row.data.get("message") {
                if let Some(role) = msg.get("role").and_then(|v| v.as_str()) {
                    println!("     message.role: {}", role);
                }
                if let Some(content) = msg.get("content") {
                    if let Some(text) = content.as_str() {
                        let preview = if text.len() > 100 { &text[..100] } else { text };
                        println!("     message.content: {}…", preview.replace('\n', "\\n"));
                    } else if let Some(arr) = content.as_array() {
                        println!("     message.content: [{} parts]", arr.len());
                        for (i, part) in arr.iter().take(3).enumerate() {
                            let part_type = part.get("type").and_then(|v| v.as_str()).unwrap_or("?");
                            if part_type == "text" {
                                let text = part.get("text").and_then(|v| v.as_str()).unwrap_or("");
                                let preview = if text.len() > 80 { &text[..80] } else { text };
                                println!("       [{}] text: {}…", i, preview.replace('\n', "\\n"));
                            } else if part_type == "tool_use" {
                                let name = part.get("name").and_then(|v| v.as_str()).unwrap_or("?");
                                println!("       [{}] tool_use: {}", i, name);
                            } else {
                                println!("       [{}] {}", i, part_type);
                            }
                        }
                    }
                }
            }

            shown += 1;
        }
    }

    // Assertions
    assert_eq!(offsets.len(), 33, "Should find 33 lines");
    assert!(schema.columns.len() > 10, "Should discover many columns from heterogeneous data");
    assert_eq!(rows.len(), 33, "Should parse all 33 rows");

    // Verify type distribution
    assert!(type_counts.contains_key("user"), "Should have user messages");
    assert!(type_counts.contains_key("assistant"), "Should have assistant messages");
    assert!(type_counts.contains_key("attachment"), "Should have attachments");
}

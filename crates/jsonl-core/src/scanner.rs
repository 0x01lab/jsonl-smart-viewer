use crate::types::LineOffset;

/// Result returned after feeding a chunk to the scanner.
#[derive(Debug, Clone, Copy)]
pub struct ScanResult {
    /// Number of new lines discovered in this chunk.
    pub new_lines: u32,
    /// Progress as a fraction 0.0..1.0 (bytes_processed / total_size).
    pub progress: f64,
}

/// Streaming newline scanner that builds a byte-offset index over arbitrary
/// chunked input.
///
/// Usage:
///   1. Create with `NewlineScanner::new(total_file_size)`.
///   2. Call `feed_chunk(chunk)` for each chunk read from the file.
///   3. Call `finish()` to collect the final `Vec<LineOffset>`.
pub struct NewlineScanner {
    offsets: Vec<LineOffset>,
    /// Byte offset where the current (incomplete) line started.
    current_line_start: u64,
    /// Total bytes fed so far across all chunks.
    bytes_processed: u64,
    /// Expected total file size (used for progress calculation).
    total_size: u64,
}

impl NewlineScanner {
    /// Create a new scanner. `total_size` is the expected file size in bytes
    /// and is only used for progress reporting.
    pub fn new(total_size: u64) -> Self {
        Self {
            offsets: Vec::new(),
            current_line_start: 0,
            bytes_processed: 0,
            total_size,
        }
    }

    /// Feed a chunk of bytes. Scans for `\n` (0x0A) delimiters and records
    /// `(start_byte_offset, length)` for each non-empty line found.
    ///
    /// Empty lines (a bare `\n` with no content bytes) are skipped.
    pub fn feed_chunk(&mut self, chunk: &[u8]) -> ScanResult {
        let lines_before = self.offsets.len() as u32;
        let chunk_start = self.bytes_processed;

        for (i, &byte) in chunk.iter().enumerate() {
            if byte == b'\n' {
                let line_start = self.current_line_start;
                let abs_offset = chunk_start + i as u64;
                let line_len = (abs_offset - line_start) as u32;

                // Only record non-empty lines
                if line_len > 0 {
                    self.offsets.push(LineOffset {
                        start: line_start,
                        len: line_len,
                    });
                }

                // Next line begins right after this `\n`
                self.current_line_start = abs_offset + 1;
            }
        }

        self.bytes_processed += chunk.len() as u64;

        ScanResult {
            new_lines: self.offsets.len() as u32 - lines_before,
            progress: self.progress(),
        }
    }

    /// Finish scanning. Handles the case where the last line does not end
    /// with `\n` by recording it as a final line offset.
    ///
    /// Returns the complete vector of line offsets.
    pub fn finish(mut self) -> Vec<LineOffset> {
        // If there are bytes after the last `\n`, record the trailing line.
        if self.bytes_processed > self.current_line_start {
            let line_len = (self.bytes_processed - self.current_line_start) as u32;
            self.offsets.push(LineOffset {
                start: self.current_line_start,
                len: line_len,
            });
        }
        self.offsets
    }

    /// Current progress as a fraction 0.0..1.0.
    pub fn progress(&self) -> f64 {
        if self.total_size == 0 {
            if self.bytes_processed == 0 {
                0.0
            } else {
                1.0
            }
        } else {
            (self.bytes_processed as f64 / self.total_size as f64).min(1.0)
        }
    }

    /// Number of lines found so far.
    pub fn lines_found(&self) -> u32 {
        self.offsets.len() as u32
    }

    /// Total bytes fed so far.
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
        let result = scanner.feed_chunk(b"hello");
        assert_eq!(result.new_lines, 0);
        let offsets = scanner.finish();
        assert_eq!(offsets.len(), 1);
        assert_eq!(offsets[0].start, 0);
        assert_eq!(offsets[0].len, 5);
    }

    #[test]
    fn test_scan_single_line_with_newline() {
        let mut scanner = NewlineScanner::new(6);
        let result = scanner.feed_chunk(b"hello\n");
        assert_eq!(result.new_lines, 1);
        assert_eq!(result.progress, 1.0);
        let offsets = scanner.finish();
        assert_eq!(offsets.len(), 1);
        assert_eq!(offsets[0].start, 0);
        assert_eq!(offsets[0].len, 5);
    }

    #[test]
    fn test_scan_multiple_lines() {
        let mut scanner = NewlineScanner::new(12);
        let result = scanner.feed_chunk(b"hello\nworld\n");
        assert_eq!(result.new_lines, 2);
        let offsets = scanner.finish();
        assert_eq!(offsets.len(), 2);
        assert_eq!(offsets[0].start, 0);
        assert_eq!(offsets[0].len, 5);
        assert_eq!(offsets[1].start, 6);
        assert_eq!(offsets[1].len, 5);
    }

    #[test]
    fn test_scan_last_line_no_newline() {
        let mut scanner = NewlineScanner::new(11);
        scanner.feed_chunk(b"hello\nworld");
        let offsets = scanner.finish();
        assert_eq!(offsets.len(), 2);
        // First line: "hello" at offset 0, length 5
        assert_eq!(offsets[0].start, 0);
        assert_eq!(offsets[0].len, 5);
        // Second line: "world" at offset 6, length 5 (finish handles trailing)
        assert_eq!(offsets[1].start, 6);
        assert_eq!(offsets[1].len, 5);
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
        assert_eq!(offsets[0].start, 0);
        assert_eq!(offsets[0].len, 5);
        assert_eq!(offsets[1].start, 6);
        assert_eq!(offsets[1].len, 5);
    }

    #[test]
    fn test_scan_skips_empty_lines() {
        let mut scanner = NewlineScanner::new(6);
        // "a\n\n\nb\n" — bytes: a=0, \n=1, \n=2, \n=3, b=4, \n=5
        let result = scanner.feed_chunk(b"a\n\n\nb\n");
        assert_eq!(result.new_lines, 2);
        let offsets = scanner.finish();
        assert_eq!(offsets.len(), 2);
        // "a" at offset 0, length 1
        assert_eq!(offsets[0].start, 0);
        assert_eq!(offsets[0].len, 1);
        // "b" at offset 4, length 1
        assert_eq!(offsets[1].start, 4);
        assert_eq!(offsets[1].len, 1);
    }

    #[test]
    fn test_scan_progress() {
        let mut scanner = NewlineScanner::new(100);
        assert_eq!(scanner.progress(), 0.0);

        scanner.feed_chunk(b"abcde"); // 5 bytes
        assert_eq!(scanner.bytes_processed(), 5);
        // Progress should be 0.05
        let diff = (scanner.progress() - 0.05).abs();
        assert!(diff < f64::EPSILON, "progress should be 0.05, got {}", scanner.progress());

        scanner.feed_chunk(&[0u8; 45]); // 45 more bytes = 50 total
        let diff = (scanner.progress() - 0.5).abs();
        assert!(diff < f64::EPSILON, "progress should be 0.5, got {}", scanner.progress());
    }

    #[test]
    fn test_scan_real_jsonl() {
        let lines = vec![
            r#"{"name":"Alice","age":30}"#,
            r#"{"name":"Bob","age":25,"city":"NYC"}"#,
            r#"{"name":"Charlie","age":35,"active":true}"#,
        ];
        let content = lines.iter().map(|l| l.to_string()).collect::<Vec<_>>().join("\n") + "\n";
        let bytes = content.as_bytes();

        let mut scanner = NewlineScanner::new(bytes.len() as u64);
        scanner.feed_chunk(bytes);

        let offsets = scanner.finish();
        assert_eq!(offsets.len(), 3);

        // Verify each line starts at the correct byte offset and has correct length
        assert_eq!(offsets[0].start, 0);
        assert_eq!(offsets[0].len, lines[0].len() as u32);

        assert_eq!(offsets[1].start, lines[0].len() as u64 + 1); // +1 for '\n'
        assert_eq!(offsets[1].len, lines[1].len() as u32);

        assert_eq!(offsets[2].start, offsets[1].start + lines[1].len() as u64 + 1);
        assert_eq!(offsets[2].len, lines[2].len() as u32);

        // Verify we can reconstruct the original lines from offsets
        for (i, offset) in offsets.iter().enumerate() {
            let line_bytes = &bytes[offset.start as usize..(offset.start + offset.len as u64) as usize];
            let line_str = std::str::from_utf8(line_bytes).unwrap();
            assert_eq!(line_str, lines[i]);
        }
    }
}

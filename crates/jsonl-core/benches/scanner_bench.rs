use criterion::{black_box, criterion_group, criterion_main, Criterion};
use jsonl_core::types::LineIndex;
use jsonl_core::{NewlineScanner, RowParser, SchemaExtractor};

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
    let line_index = LineIndex::new(offsets);

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

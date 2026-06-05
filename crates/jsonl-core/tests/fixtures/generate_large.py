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

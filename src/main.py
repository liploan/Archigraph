import argparse
import sys
import json
import re
from src.config import OUTPUT_DIR, verify_credentials, KEEP_RAW_SNAPSHOTS
from src.ingestor import (
    get_wayback_snapshots,
    fetch_snapshot_html,
    clean_html_content,
    delete_raw_snapshot,
    get_domain,
    build_cache_id,
)
from src.extractor import extract_org_structure
from src.diff_engine import enrich_snapshots_with_diffs
from src.db_seeder import TemporalGraphSeeder


def main():
    parser = argparse.ArgumentParser(description="Archigraph Ingestion, Temporal Diff & Graph Seeding CLI")
    parser.add_argument("--url", required=True, help="Target leadership/team page URL (e.g. https://example.com/team)")
    parser.add_argument("--limit", type=int, default=5, help="Maximum number of historical snapshots to parse")
    parser.add_argument("--force-extract", action="store_true", help="Force LLM extraction even if output JSON already exists")
    parser.add_argument("--seed-neo4j", action="store_true", help="Sync extracted temporal snapshots and diffs into Neo4j")
    
    args = parser.parse_args()
    
    print("====================================================")
    print("         Archigraph Temporal Pipeline CLI           ")
    print("====================================================")
    print(f"Target URL: {args.url}")
    print(f"Limit Snapshots: {args.limit}")
    print("====================================================")
    
    try:
        verify_credentials()
        print("✔ API key verification succeeded.")
    except ValueError as e:
        print(f"✘ API Key Verification Failed:\n{e}")
        sys.exit(1)
        
    domain = get_domain(args.url)
    cache_id = build_cache_id(args.url, domain)
    safe_cache_id = re.sub(r'[^a-zA-Z0-9-]', '_', cache_id)
    print(f"Resolving snapshots for domain: {domain} (cache key: {cache_id})")
    
    snapshots = get_wayback_snapshots(args.url, limit=args.limit)
    if not snapshots:
        print(f"No valid historical snapshots found for {args.url}.")
        sys.exit(0)
        
    print(f"Found {len(snapshots)} unique historical snapshots. Starting pipeline...")
    
    extracted_results = []
    output_files_by_ts = {}

    for idx, snap in enumerate(snapshots, 1):
        timestamp = snap["timestamp"]
        archive_url = snap["archive_url"]
        
        output_file = OUTPUT_DIR / f"{safe_cache_id}_{timestamp}_extracted.json"
        output_files_by_ts[timestamp] = output_file
        
        print(f"\n[{idx}/{len(snapshots)}] Processing Snapshot Timestamp: {timestamp}")
        
        # Check if already extracted
        if output_file.exists() and not args.force_extract:
            print(f"  ✔ Already extracted. Loading existing data: {output_file.name}")
            try:
                with open(output_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    print(f"    - Loaded {len(data.get('entities', []))} entities.")
                    extracted_results.append(data)
                continue
            except Exception as e:
                print(f"    - Error loading existing file, will re-extract: {e}")
            
        # 1. Fetch raw HTML
        raw_html = fetch_snapshot_html(archive_url, timestamp, cache_id)
        if not raw_html:
            print("  ✘ Failed to retrieve HTML. Skipping.")
            continue
            
        # 2. Clean HTML
        print("  - Cleaning HTML structure...")
        cleaned_text = clean_html_content(raw_html)
        if not cleaned_text:
            print("  ✘ Cleaned content is empty. Skipping.")
            continue
            
        # Debug size of cleaned text
        print(f"  - Cleaned text size: {len(cleaned_text)} characters.")
        
        # 3. LLM Extraction
        print("  - Extracting organizational entities via Gemini...")
        snapshot_result = extract_org_structure(cleaned_text, timestamp, domain)
        if not snapshot_result:
            print("  ✘ Structured LLM extraction failed.")
            continue
            
        result_dict = snapshot_result.model_dump()
        extracted_results.append(result_dict)

        # 4. Save structured result
        try:
            with open(output_file, 'w', encoding='utf-8') as f:
                json.dump(result_dict, f, indent=2, ensure_ascii=False)
            print(f"  ✔ Successfully extracted {len(snapshot_result.entities)} entities.")
            print(f"    Saved to: {output_file.relative_to(OUTPUT_DIR.parent.parent)}")
            
            # Disk space cleanup
            if not KEEP_RAW_SNAPSHOTS:
                delete_raw_snapshot(timestamp, cache_id)
        except Exception as e:
            print(f"  ✘ Error saving extraction output: {e}")

    if extracted_results:
        extracted_results.sort(key=lambda s: s.get("snapshot_timestamp", ""))
        enriched_results = enrich_snapshots_with_diffs(extracted_results)
        print("\n----------------------------------------------------")
        print("Temporal Diff & Entity Resolution Summary:")
        for idx, snap in enumerate(enriched_results):
            ts = snap.get("snapshot_timestamp", "current")
            out_path = output_files_by_ts.get(ts)
            if out_path:
                try:
                    with open(out_path, 'w', encoding='utf-8') as f:
                        json.dump(snap, f, indent=2, ensure_ascii=False)
                except Exception as e:
                    print(f"  Warning: Could not update enriched snapshot {out_path.name}: {e}")
            if idx == 0 or not snap.get("diff_summary"):
                print(f"  • [{ts}] Baseline snapshot ({len(snap.get('entities', []))} people)")
            else:
                counts = snap["diff_summary"]["counts"]
                print(
                    f"  • [{ts}] +{counts['joined']} Joined | "
                    f"↑{counts['promoted']} Promoted | "
                    f"⇄{counts['moved']} Moved | "
                    f"−{counts['departed']} Departed"
                )

        if args.seed_neo4j:
            print("\n----------------------------------------------------")
            print("Syncing enriched snapshots to Neo4j...")
            seeder = TemporalGraphSeeder()
            try:
                seeder.sync_snapshots(enriched_results)
            finally:
                seeder.close()

    print("\n====================================================")
    print("Pipeline run completed!")
    print(f"Extracted JSON snapshots stored in: {OUTPUT_DIR.relative_to(OUTPUT_DIR.parent.parent)}")
    print("====================================================")

if __name__ == "__main__":
    main()

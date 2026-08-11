import argparse
import sys
import json
import re
from urllib.parse import urlparse
from src.config import OUTPUT_DIR, verify_credentials, KEEP_RAW_SNAPSHOTS
from src.ingestor import get_wayback_snapshots, fetch_snapshot_html, clean_html_content, delete_raw_snapshot
from src.extractor import extract_org_structure

def get_domain(url: str) -> str:
    parsed = urlparse(url)
    domain = parsed.netloc
    if domain.startswith("www."):
        domain = domain[4:]
    return domain

def main():
    parser = argparse.ArgumentParser(description="Archigraph Ingestion & Extraction Prototype CLI")
    parser.add_argument("--url", required=True, help="Target leadership/team page URL (e.g. https://example.com/team)")
    parser.add_argument("--limit", type=int, default=5, help="Maximum number of historical snapshots to parse")
    parser.add_argument("--force-extract", action="store_true", help="Force LLM extraction even if output JSON already exists")
    
    args = parser.parse_args()
    
    print("====================================================")
    print("         Archigraph Phase 1 Prototype CLI           ")
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
    print(f"Resolving snapshots for domain: {domain}")
    
    snapshots = get_wayback_snapshots(args.url, limit=args.limit)
    if not snapshots:
        print(f"No valid historical snapshots found for {args.url}.")
        sys.exit(0)
        
    print(f"Found {len(snapshots)} unique historical snapshots. Starting pipeline...")
    
    for idx, snap in enumerate(snapshots, 1):
        timestamp = snap["timestamp"]
        archive_url = snap["archive_url"]
        
        safe_domain = re.sub(r'[^a-zA-Z0-9]', '_', domain)
        output_file = OUTPUT_DIR / f"{safe_domain}_{timestamp}_extracted.json"
        
        print(f"\n[{idx}/{len(snapshots)}] Processing Snapshot Timestamp: {timestamp}")
        
        # Check if already extracted
        if output_file.exists() and not args.force_extract:
            print(f"  ✔ Already extracted. Loading existing data: {output_file.name}")
            try:
                with open(output_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    print(f"    - Loaded {len(data.get('entities', []))} entities.")
            except Exception as e:
                print(f"    - Error loading existing file, will re-extract: {e}")
            continue
            
        # 1. Fetch raw HTML
        raw_html = fetch_snapshot_html(archive_url, timestamp, domain)
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
            
        # 4. Save structured result
        try:
            with open(output_file, 'w', encoding='utf-8') as f:
                # Use model_dump() for pydantic v2 compatibility
                json.dump(snapshot_result.model_dump(), f, indent=2, ensure_ascii=False)
            print(f"  ✔ Successfully extracted {len(snapshot_result.entities)} entities.")
            print(f"    Saved to: {output_file.relative_to(OUTPUT_DIR.parent.parent)}")
            
            # Disk space cleanup
            if not KEEP_RAW_SNAPSHOTS:
                delete_raw_snapshot(timestamp, domain)
        except Exception as e:
            print(f"  ✘ Error saving extraction output: {e}")
            
    print("\n====================================================")
    print("Pipeline run completed!")
    print(f"Extracted JSON snapshots stored in: {OUTPUT_DIR.relative_to(OUTPUT_DIR.parent.parent)}")
    print("====================================================")

if __name__ == "__main__":
    main()

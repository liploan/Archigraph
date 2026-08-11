import re
from pathlib import Path
from flask import Flask, request, jsonify, send_from_directory
from src.config import verify_credentials, OUTPUT_DIR, KEEP_RAW_SNAPSHOTS
from src.ingestor import get_wayback_snapshots, fetch_snapshot_html, clean_html_content, delete_raw_snapshot
from src.extractor import extract_org_structure

app = Flask(__name__, static_folder="static")

@app.route("/")
def index():
    return send_from_directory("static", "index.html")

@app.route("/static/<path:path>")
def serve_static(path):
    return send_from_directory("static", path)

def get_domain(url: str) -> str:
    from urllib.parse import urlparse
    parsed = urlparse(url)
    domain = parsed.netloc
    if domain.startswith("www."):
        domain = domain[4:]
    return domain

@app.route("/api/extract", methods=["POST"])
def api_extract():
    data = request.get_json() or {}
    url = data.get("url")
    limit = int(data.get("limit", 2))
    force_extract = bool(data.get("force_extract", False))
    
    if not url:
        return jsonify({"error": "Missing target URL parameter."}), 400
        
    try:
        verify_credentials()
    except ValueError as e:
        return jsonify({"error": str(e)}), 500
        
    domain = get_domain(url)
    print(f"[API] Resolving snapshots for domain: {domain}")
    
    snapshots = get_wayback_snapshots(url, limit=limit)
    if not snapshots:
        return jsonify({"error": f"No valid snapshots found for {url}."}), 404
        
    results = []
    
    for snap in snapshots:
        timestamp = snap["timestamp"]
        archive_url = snap["archive_url"]
        
        safe_domain = re.sub(r'[^a-zA-Z0-9]', '_', domain)
        output_file = OUTPUT_DIR / f"{safe_domain}_{timestamp}_extracted.json"
        
        # Load from disk if already extracted
        if output_file.exists() and not force_extract:
            try:
                import json
                with open(output_file, 'r', encoding='utf-8') as f:
                    extracted_data = json.load(f)
                    results.append(extracted_data)
                    continue
            except Exception as e:
                print(f"[API] Error loading existing JSON, re-extracting: {e}")
                
        # Scrape and extract
        raw_html = fetch_snapshot_html(archive_url, timestamp, domain)
        if not raw_html:
            continue
            
        cleaned_text = clean_html_content(raw_html)
        if not cleaned_text:
            continue
            
        snapshot_result = extract_org_structure(cleaned_text, timestamp, domain)
        if snapshot_result:
            # Convert pydantic model to dict
            result_dict = snapshot_result.model_dump()
            
            # Save it locally for caching
            try:
                import json
                with open(output_file, 'w', encoding='utf-8') as f:
                    json.dump(result_dict, f, indent=2, ensure_ascii=False)
            except Exception as e:
                print(f"[API] Error saving extraction to cache: {e}")
                
            results.append(result_dict)
            
            # Disk space cleanup
            if not KEEP_RAW_SNAPSHOTS:
                delete_raw_snapshot(timestamp, domain)
            
    if not results:
        return jsonify({"error": "Failed to extract organizational entities from any snapshots."}), 500
        
    return jsonify({
        "success": True,
        "domain": domain,
        "snapshots_processed": len(results),
        "data": results
    })

if __name__ == "__main__":
    # Run locally on port 5000
    app.run(host="127.0.0.1", port=5000, debug=True)

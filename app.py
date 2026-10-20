import hashlib
import hmac
import json
import re
import threading
import time
from collections import defaultdict, deque
from datetime import datetime, timezone
from functools import lru_cache
from urllib.parse import urlparse

from flask import Flask, request, jsonify, send_from_directory
from werkzeug.middleware.proxy_fix import ProxyFix

from src.config import (
    verify_credentials, OUTPUT_DIR, DEMO_DIR, KEEP_RAW_SNAPSHOTS,
    ENABLE_LIVE_EXTRACTION, ACCESS_TOKEN, MAX_EXTRACTIONS_PER_DAY,
    MAX_SNAPSHOTS_PER_REQUEST, FLASK_DEBUG,
)
from src.ingestor import get_wayback_snapshots, fetch_snapshot_html, clean_html_content, delete_raw_snapshot
from src.extractor import extract_org_structure
from src.diff_engine import enrich_snapshots_with_diffs, find_warm_path
from src.security import validate_public_url, UnsafeURLError

import os

app = Flask(__name__, static_folder="static")

# When deployed behind a reverse proxy (Render, Fly, nginx) the real client IP is in
# X-Forwarded-For. Only trust as many proxy hops as you actually have.
_proxy_hops = int(os.getenv("TRUSTED_PROXY_HOPS", "0"))
if _proxy_hops > 0:
    app.wsgi_app = ProxyFix(app.wsgi_app, x_for=_proxy_hops)

# --------------------------------------------------------------------------
# Abuse controls (in-memory; run a single gunicorn worker so counters are shared)
# --------------------------------------------------------------------------
RATE_LIMIT_REQUESTS = 6
RATE_LIMIT_WINDOW_SECONDS = 600
_rate_lock = threading.Lock()
_rate_hits = defaultdict(deque)

_budget_lock = threading.Lock()
_budget = {"day": None, "used": 0}


def _rate_limited(ip: str) -> bool:
    now = time.time()
    with _rate_lock:
        hits = _rate_hits[ip]
        while hits and now - hits[0] > RATE_LIMIT_WINDOW_SECONDS:
            hits.popleft()
        if len(hits) >= RATE_LIMIT_REQUESTS:
            return True
        hits.append(now)
        return False


def _reserve_extraction() -> bool:
    """Reserve one Gemini-backed extraction against today's budget."""
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    with _budget_lock:
        if _budget["day"] != today:
            _budget["day"] = today
            _budget["used"] = 0
        if _budget["used"] >= MAX_EXTRACTIONS_PER_DAY:
            return False
        _budget["used"] += 1
        return True


@app.after_request
def add_security_headers(resp):
    resp.headers.setdefault("X-Content-Type-Options", "nosniff")
    resp.headers.setdefault("X-Frame-Options", "DENY")
    resp.headers.setdefault("Referrer-Policy", "no-referrer")
    if request.path.startswith("/api/"):
        resp.headers.setdefault("Cache-Control", "no-store")
    return resp


# --------------------------------------------------------------------------
# Pages & health
# --------------------------------------------------------------------------
@app.route("/")
def index():
    return send_from_directory("static", "index.html")


@app.route("/healthz")
def healthz():
    return jsonify({"status": "ok"})


@app.route("/api/config")
def api_config():
    """Tells the frontend which capabilities this deployment has enabled."""
    return jsonify({
        "live_extraction": ENABLE_LIVE_EXTRACTION,
        "token_required": bool(ACCESS_TOKEN),
        "max_snapshots": MAX_SNAPSHOTS_PER_REQUEST,
    })


# --------------------------------------------------------------------------
# Demos (static fixtures: no network, no API key, no cost)
# --------------------------------------------------------------------------
@lru_cache(maxsize=1)
def _load_manifest() -> dict:
    with open(DEMO_DIR / "manifest.json", "r", encoding="utf-8") as f:
        return json.load(f)


DEMO_NOTES = {
    "illustrative": (
        "Illustrative sample data. These org charts were assembled by hand to show the "
        "product, not extracted from verified sources, and may contain inaccuracies."
    ),
    "extracted": (
        "Extracted automatically from an archive.org snapshot using Gemini. "
        "Unverified; reporting lines are inferred from page layout."
    ),
}


@lru_cache(maxsize=16)
def _load_demo(key: str):
    entry = _load_manifest().get(key)
    if not entry:
        return None
    snapshots = []
    for path in sorted(DEMO_DIR.glob(f"{entry['prefix']}_*_extracted.json")):
        with open(path, "r", encoding="utf-8") as f:
            snapshots.append(json.load(f))
    snapshots.sort(key=lambda s: s.get("snapshot_timestamp", ""))
    snapshots = enrich_snapshots_with_diffs(snapshots)
    return {
        "success": True,
        "domain": entry["domain"],
        "snapshots_processed": len(snapshots),
        "sample_data": entry["kind"],
        "note": DEMO_NOTES.get(entry["kind"], ""),
        "data": snapshots,
    }


@app.route("/api/demo/<key>")
def api_demo(key):
    payload = _load_demo(key)  # key is looked up in the manifest, never used as a path
    if payload is None or not payload["data"]:
        return jsonify({"error": "Unknown demo."}), 404
    return jsonify(payload)


# --------------------------------------------------------------------------
# Live extraction
# --------------------------------------------------------------------------
def get_domain(url: str) -> str:
    parsed = urlparse(url)
    domain = parsed.hostname or ""
    if domain.startswith("www."):
        domain = domain[4:]
    return domain


def _cache_id(url: str, domain: str) -> str:
    """Cache key that includes the URL path, so /about and /careers never collide."""
    parsed = urlparse(url)
    normalized = f"{parsed.hostname}{parsed.path.rstrip('/')}"
    digest = hashlib.sha1(normalized.encode("utf-8")).hexdigest()[:10]
    return f"{domain}-{digest}"


@app.route("/api/extract", methods=["POST"])
def api_extract():
    if not ENABLE_LIVE_EXTRACTION:
        return jsonify({"error": "Live extraction is disabled on this deployment. Try one of the demos."}), 403

    if ACCESS_TOKEN:
        supplied = request.headers.get("X-Access-Token", "")
        if not hmac.compare_digest(supplied.encode("utf-8"), ACCESS_TOKEN.encode("utf-8")):
            return jsonify({"error": "A valid access token is required for live extraction."}), 401

    if _rate_limited(request.remote_addr or "unknown"):
        return jsonify({"error": "Rate limit exceeded. Please wait a few minutes."}), 429

    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify({"error": "Request body must be a JSON object."}), 400

    try:
        url = validate_public_url(data.get("url"))
    except UnsafeURLError as e:
        return jsonify({"error": str(e)}), 400

    try:
        limit = int(data.get("limit", 2))
    except (TypeError, ValueError):
        return jsonify({"error": "limit must be an integer."}), 400
    limit = max(1, min(limit, MAX_SNAPSHOTS_PER_REQUEST))
    force_extract = bool(data.get("force_extract", False))

    try:
        verify_credentials()
    except ValueError:
        app.logger.error("GEMINI_API_KEY is not configured.")
        return jsonify({"error": "Live extraction is not configured on this server."}), 503

    domain = get_domain(url)
    app.logger.info("[API] Resolving snapshots for %s", domain)

    snapshots = get_wayback_snapshots(url, limit=limit)
    if not snapshots:
        return jsonify({"error": "No valid snapshots found for that URL."}), 404

    results = []
    budget_exhausted = False
    cache_id = _cache_id(url, domain)

    for snap in snapshots:
        timestamp = snap["timestamp"]
        archive_url = snap["archive_url"]
        output_file = OUTPUT_DIR / f"{re.sub(r'[^a-zA-Z0-9-]', '_', cache_id)}_{timestamp}_extracted.json"

        # Load from disk if already extracted (free: no Gemini call)
        if output_file.exists() and not force_extract:
            try:
                with open(output_file, "r", encoding="utf-8") as f:
                    results.append(json.load(f))
                    continue
            except Exception as e:
                app.logger.warning("Error loading cached JSON, re-extracting: %s", e)

        if not _reserve_extraction():
            budget_exhausted = True
            break

        raw_html = fetch_snapshot_html(archive_url, timestamp, cache_id)
        if not raw_html:
            continue

        cleaned_text = clean_html_content(raw_html)
        if not cleaned_text:
            continue

        snapshot_result = extract_org_structure(cleaned_text, timestamp, domain)
        if snapshot_result:
            result_dict = snapshot_result.model_dump()
            try:
                with open(output_file, "w", encoding="utf-8") as f:
                    json.dump(result_dict, f, indent=2, ensure_ascii=False)
            except Exception as e:
                app.logger.warning("Error saving extraction to cache: %s", e)

            results.append(result_dict)

            # Disk space cleanup
            if not KEEP_RAW_SNAPSHOTS:
                delete_raw_snapshot(timestamp, cache_id)

    if not results:
        if budget_exhausted:
            return jsonify({"error": "Today's live-extraction budget has been used up. Please try a demo or come back tomorrow."}), 429
        return jsonify({"error": "Failed to extract organizational entities from any snapshots."}), 502

    results.sort(key=lambda s: s.get("snapshot_timestamp", ""))
    results = enrich_snapshots_with_diffs(results)

    return jsonify({
        "success": True,
        "domain": domain,
        "snapshots_processed": len(results),
        "sample_data": None,
        "note": "Partial result: daily extraction budget reached." if budget_exhausted else "",
        "data": results,
    })


@app.route("/api/warm-path", methods=["POST"])
def api_warm_path():
    """Compute the shortest warm introduction path between two entities in a snapshot."""
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify({"error": "Request body must be a JSON object."}), 400

    entities = data.get("entities")
    source_id = data.get("source_id")
    target_id = data.get("target_id")
    if not isinstance(entities, list) or not source_id or not target_id:
        return jsonify({"error": "entities, source_id, and target_id are required."}), 400

    path = find_warm_path(entities, str(source_id), str(target_id))
    if path is None:
        return jsonify({"error": "No connection path found between the selected people."}), 404
    return jsonify({"success": True, "path": path})


if __name__ == "__main__":
    # Local development only. In production use gunicorn (see Dockerfile).
    app.run(
        host="127.0.0.1",
        port=int(os.getenv("PORT", "5001")),
        debug=FLASK_DEBUG,
    )

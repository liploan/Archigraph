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
from src.ingestor import (
    get_wayback_snapshots, fetch_snapshot_html, clean_html_content,
    delete_raw_snapshot, get_domain, build_cache_id,
)
from src.alerts import generate_watchlist_alerts
from src.extractor import extract_org_structure
from src.diff_engine import enrich_snapshots_with_diffs, find_warm_path
from src.intelligence import (
    SAMPLE_INVESTOR_NETWORK,
    enrich_snapshots_with_intelligence,
    match_network_against_snapshots,
    simulate_key_person_departure,
)
from src.job_signals import enrich_job_postings_for_snapshot, fetch_public_ats_jobs
from src.portfolio import (
    _group_extracted_dir_by_domain,
    _load_job_fixtures,
    build_portfolio_overview,
)
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


def _ensure_snapshot_source_urls(snapshots: list, domain: str, base_url: str = ""):
    """Ensure every snapshot exposes a verifiable Wayback or live `source_url`."""
    fallback_target = base_url or f"https://{domain}/about"
    for snap in snapshots:
        if snap.get("source_url"):
            continue
        ts = snap.get("snapshot_timestamp") or "current"
        if ts == "current":
            snap["source_url"] = fallback_target
        else:
            snap["source_url"] = f"https://web.archive.org/web/{ts}/{fallback_target}"


def _attach_cross_org_links(snapshots: list, domain: str):
    """Attach cross-company spinout/migration links onto matching active and departed entities."""
    try:
        overview = build_portfolio_overview(DEMO_DIR, OUTPUT_DIR)
        link_map = overview.get("cross_links_index", {}).get(domain.lower(), {})
    except Exception:
        link_map = {}
    if not link_map:
        return
    for snap in snapshots:
        for e in snap.get("entities", []):
            if e.get("id") in link_map:
                e["cross_org_links"] = link_map[e["id"]]
        for dep in (snap.get("diff_summary") or {}).get("departed") or []:
            if dep.get("id") in link_map:
                dep["cross_org_links"] = link_map[dep["id"]]


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
    snapshots = enrich_snapshots_with_intelligence(snapshots)

    job_fixtures = _load_job_fixtures(DEMO_DIR)
    hiring_signals = enrich_job_postings_for_snapshot(
        job_fixtures.get(key, []),
        snapshots[-1].get("entities", []) if snapshots else [],
        org_name=entry["domain"],
    )
    if snapshots:
        snapshots[-1]["hiring_signals"] = hiring_signals
    _ensure_snapshot_source_urls(snapshots, entry["domain"])
    _attach_cross_org_links(snapshots, entry["domain"])

    return {
        "success": True,
        "domain": entry["domain"],
        "snapshots_processed": len(snapshots),
        "sample_data": entry["kind"],
        "note": DEMO_NOTES.get(entry["kind"], ""),
        "hiring_signals": hiring_signals,
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
_cache_id = build_cache_id


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
    safe_cache_slug = re.sub(r"[^a-zA-Z0-9-]", "_", cache_id)
    tried_current = False

    def _process_snapshot(ts: str, fetch_url: str) -> bool:
        nonlocal budget_exhausted, tried_current
        if ts == "current":
            tried_current = True
        output_file = OUTPUT_DIR / f"{safe_cache_slug}_{ts}_extracted.json"

        # Load from disk if already extracted (free: no Gemini call)
        if output_file.exists() and not force_extract:
            try:
                with open(output_file, "r", encoding="utf-8") as f:
                    results.append(json.load(f))
                    return True
            except Exception as e:
                app.logger.warning("Error loading cached JSON, re-extracting: %s", e)

        raw_html = fetch_snapshot_html(fetch_url, ts, cache_id)
        if not raw_html:
            return False

        cleaned_text = clean_html_content(raw_html)
        if not cleaned_text:
            return False

        if not _reserve_extraction():
            budget_exhausted = True
            return False

        snapshot_result = extract_org_structure(cleaned_text, ts, domain)
        if not snapshot_result:
            return False

        result_dict = snapshot_result.model_dump()
        result_dict["source_url"] = fetch_url
        try:
            with open(output_file, "w", encoding="utf-8") as f:
                json.dump(result_dict, f, indent=2, ensure_ascii=False)
        except Exception as e:
            app.logger.warning("Error saving extraction to cache: %s", e)

        results.append(result_dict)

        # Disk space cleanup
        if not KEEP_RAW_SNAPSHOTS:
            delete_raw_snapshot(ts, cache_id)
        return True

    for idx, snap in enumerate(snapshots):
        ok = _process_snapshot(snap["timestamp"], snap["archive_url"])
        if budget_exhausted:
            break
        # If Wayback rate-limits or drops the most recent capture, fall back to the live page
        if not ok and idx == len(snapshots) - 1 and snap["timestamp"] != "current" and not tried_current:
            app.logger.info("[API] Falling back to live URL for latest snapshot of %s", domain)
            _process_snapshot("current", url)
            if budget_exhausted:
                break

    if not results and not budget_exhausted and not tried_current:
        app.logger.info("[API] All archive fetches failed for %s; falling back to live URL", domain)
        _process_snapshot("current", url)

    if not results:
        if budget_exhausted:
            return jsonify({"error": "Today's live-extraction budget has been used up. Please try a demo or come back tomorrow."}), 429
        return jsonify({"error": "Failed to extract organizational entities from any snapshots."}), 502

    results.sort(key=lambda s: s.get("snapshot_timestamp", ""))
    results = enrich_snapshots_with_diffs(results)
    results = enrich_snapshots_with_intelligence(results)

    ats_url = (data.get("ats_url") or "").strip()
    hiring_signals = None
    if ats_url and results:
        try:
            _, raw_jobs = fetch_public_ats_jobs(ats_url)
            hiring_signals = enrich_job_postings_for_snapshot(
                raw_jobs, results[-1].get("entities", []), org_name=domain
            )
            results[-1]["hiring_signals"] = hiring_signals
        except Exception as e:
            app.logger.warning("Optional ATS ingestion skipped for %s: %s", ats_url, e)

    _ensure_snapshot_source_urls(results, domain, base_url=url)
    _attach_cross_org_links(results, domain)

    return jsonify({
        "success": True,
        "domain": domain,
        "snapshots_processed": len(results),
        "sample_data": None,
        "note": "Partial result: daily extraction budget reached." if budget_exhausted else "",
        "hiring_signals": hiring_signals,
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


@app.route("/api/intelligence", methods=["POST"])
def api_intelligence():
    """Compute VC/PE org diligence metrics and executive recruiting poachability signals."""
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify({"error": "Request body must be a JSON object."}), 400

    snapshots = data.get("snapshots")
    if not isinstance(snapshots, list) or not snapshots:
        return jsonify({"error": "A non-empty snapshots array is required."}), 400

    enriched = enrich_snapshots_with_intelligence(snapshots)
    return jsonify({"success": True, "data": enriched})


@app.route("/api/sample-network")
def api_sample_network():
    """Return a curated demo VC & executive-search contact network for instant evaluation."""
    return jsonify({"success": True, "contacts": SAMPLE_INVESTOR_NETWORK})


@app.route("/api/network-match", methods=["POST"])
def api_network_match():
    """Match an uploaded/pasted contact network against active & historical org snapshots."""
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify({"error": "Request body must be a JSON object."}), 400

    contacts = data.get("contacts")
    snapshots = data.get("snapshots")
    domain = str(data.get("domain") or "")
    if not isinstance(contacts, list) or not isinstance(snapshots, list):
        return jsonify({"error": "contacts and snapshots arrays are required."}), 400

    report = match_network_against_snapshots(contacts, snapshots, domain=domain)
    return jsonify({"success": True, "match_report": report})


@app.route("/api/portfolio")
def api_portfolio():
    """Return cross-company screener metrics and cross-org spinout/migration links."""
    overview = build_portfolio_overview(DEMO_DIR, OUTPUT_DIR)
    return jsonify({"success": True, **overview})


@app.route("/api/extracted/<domain_key>")
def api_extracted_domain(domain_key):
    """Load a cached live-extracted organization by domain from the portfolio screener."""
    grouped = _group_extracted_dir_by_domain(OUTPUT_DIR, exclude_domains=set())
    normalized = (domain_key or "").strip().lower()
    snapshots = grouped.get(normalized)
    if not snapshots:
        return jsonify({"error": "Cached organization not found."}), 404

    snapshots = enrich_snapshots_with_diffs(snapshots)
    snapshots = enrich_snapshots_with_intelligence(snapshots)
    hiring_signals = enrich_job_postings_for_snapshot([], snapshots[-1].get("entities", []), org_name=normalized)
    snapshots[-1]["hiring_signals"] = hiring_signals
    _attach_cross_org_links(snapshots, normalized)

    return jsonify({
        "success": True,
        "domain": normalized,
        "snapshots_processed": len(snapshots),
        "sample_data": "extracted",
        "note": DEMO_NOTES["extracted"],
        "hiring_signals": hiring_signals,
        "data": snapshots,
    })


@app.route("/api/jobs/parse", methods=["POST"])
def api_jobs_parse():
    """Fuse job postings (inline array or live Greenhouse/Lever/Ashby URL) with active org nodes."""
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify({"error": "Request body must be a JSON object."}), 400

    entities = data.get("entities")
    if not isinstance(entities, list):
        return jsonify({"error": "entities array is required."}), 400

    domain = str(data.get("domain") or "")
    ats_url = (data.get("ats_url") or "").strip()
    postings = data.get("postings")

    if ats_url:
        if not ENABLE_LIVE_EXTRACTION:
            return jsonify({
                "error": "Live ATS fetching is disabled on this deployment; paste job descriptions directly instead."
            }), 403
        if ACCESS_TOKEN:
            supplied = request.headers.get("X-Access-Token", "")
            if not hmac.compare_digest(supplied.encode("utf-8"), ACCESS_TOKEN.encode("utf-8")):
                return jsonify({"error": "A valid access token is required for live ATS fetching."}), 401
        if _rate_limited(request.remote_addr or "unknown"):
            return jsonify({"error": "Rate limit exceeded. Please wait a few minutes."}), 429
        try:
            _, postings = fetch_public_ats_jobs(ats_url)
        except (ValueError, UnsafeURLError) as e:
            return jsonify({"error": str(e)}), 400
        except Exception:
            return jsonify({"error": "Failed to fetch job board postings from target ATS."}), 502

    if not isinstance(postings, list):
        return jsonify({"error": "Provide a postings array or a supported ats_url."}), 400

    summary = enrich_job_postings_for_snapshot(postings, entities, org_name=domain)
    return jsonify({"success": True, "hiring_signals": summary})


@app.route("/api/alerts")
def api_alerts():
    """Evaluate watchlist rules across tracked organizations and emit Slack/CRM webhook payloads."""
    rules_param = request.args.get("rules")
    enabled_rules = (
        [r.strip() for r in rules_param.split(",") if r.strip()]
        if rules_param is not None
        else None
    )
    feed = generate_watchlist_alerts(DEMO_DIR, OUTPUT_DIR, enabled_rules=enabled_rules)
    return jsonify({"success": True, **feed})


@app.route("/api/simulate-departure", methods=["POST"])
def api_simulate_departure():
    """Simulate key-person departure blast radius, flight-risk cascade, and succession bench."""
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify({"error": "Request body must be a JSON object."}), 400

    entities = data.get("entities")
    target_id = data.get("target_id")
    if not isinstance(entities, list) or not target_id:
        return jsonify({"error": "entities array and target_id are required."}), 400

    sim = simulate_key_person_departure(entities, str(target_id))
    if sim is None:
        return jsonify({"error": "Target leader not found in active snapshot."}), 404
    return jsonify({"success": True, "simulation": sim})


if __name__ == "__main__":
    # Local development only. In production use gunicorn (see Dockerfile).
    app.run(
        host="127.0.0.1",
        port=int(os.getenv("PORT", "5001")),
        debug=FLASK_DEBUG,
    )

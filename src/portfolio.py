"""Cross-Company Portfolio Screener & Alumni Mobility Linker.

Aggregates organizational health metrics, executive poachability counts, and forward
job-board hiring velocity across all tracked organizations, while automatically resolving
cross-company executive movements and stealth founder spinouts (e.g., SpaceX -> Impulse Space).
"""
import json
import re
from collections import defaultdict
from pathlib import Path
from typing import Dict, List, Optional

from src.diff_engine import _names_matchFuzzy, normalize_name
from src.intelligence import FOUNDER_PATTERN, _format_era_label, enrich_snapshots_with_intelligence
from src.job_signals import enrich_job_postings_for_snapshot


def _load_job_fixtures(demo_dir: Path) -> Dict[str, List[dict]]:
    fixture_file = demo_dir / "job_postings.json"
    if not fixture_file.exists():
        return {}
    try:
        with open(fixture_file, "r", encoding="utf-8") as f:
            data = json.load(f)
            return data if isinstance(data, dict) else {}
    except Exception:
        return {}


def _group_extracted_dir_by_domain(extracted_dir: Path, exclude_domains: set) -> Dict[str, List[dict]]:
    """Load non-empty cached live-extracted snapshots grouped by organization domain."""
    grouped: Dict[str, List[dict]] = defaultdict(list)
    if not extracted_dir or not extracted_dir.exists():
        return {}

    for path in sorted(extracted_dir.glob("*_extracted.json")):
        try:
            with open(path, "r", encoding="utf-8") as f:
                snap = json.load(f)
        except Exception:
            continue
        if not isinstance(snap, dict) or not snap.get("entities"):
            continue
        domain = (snap.get("organization_name") or "").strip().lower()
        if not domain or domain in exclude_domains:
            continue
        grouped[domain].append(snap)

    for dom in list(grouped.keys()):
        grouped[dom].sort(key=lambda s: s.get("snapshot_timestamp", ""))
    return dict(grouped)


def build_portfolio_overview(
    demo_dir: Path,
    extracted_dir: Optional[Path] = None,
) -> dict:
    """Build cross-company screener rows and cross-org talent migration/spinout links."""
    manifest_path = demo_dir / "manifest.json"
    manifest = {}
    if manifest_path.exists():
        with open(manifest_path, "r", encoding="utf-8") as f:
            manifest = json.load(f)

    job_fixtures = _load_job_fixtures(demo_dir)
    tracked_orgs: List[dict] = []
    demo_domains = set()

    # 1. Load all Demo organizations
    for key, entry in manifest.items():
        prefix = entry.get("prefix")
        domain = (entry.get("domain") or key).lower()
        demo_domains.add(domain)
        snaps = []
        for p in sorted(demo_dir.glob(f"{prefix}_*_extracted.json")):
            with open(p, "r", encoding="utf-8") as f:
                snaps.append(json.load(f))
        if not snaps:
            continue
        snaps.sort(key=lambda s: s.get("snapshot_timestamp", ""))
        enriched = enrich_snapshots_with_intelligence(snaps)
        latest = enriched[-1]
        jobs = enrich_job_postings_for_snapshot(
            job_fixtures.get(key, []),
            latest.get("entities", []),
            org_name=domain,
        )
        tracked_orgs.append({
            "key": key,
            "load_kind": "demo",
            "label": entry.get("label") or domain,
            "domain": domain,
            "sample_kind": entry.get("kind", "illustrative"),
            "snapshots": enriched,
            "hiring_signals": jobs,
        })

    # 2. Load any non-empty Live Extracted organizations from disk cache
    if extracted_dir:
        extra_orgs = _group_extracted_dir_by_domain(extracted_dir, exclude_domains=demo_domains)
        for domain, snaps in extra_orgs.items():
            enriched = enrich_snapshots_with_intelligence(snaps)
            latest = enriched[-1]
            slug_key = re.sub(r"[^a-z0-9-]+", "-", domain.lower()).strip("-")
            jobs = enrich_job_postings_for_snapshot([], latest.get("entities", []), org_name=domain)
            tracked_orgs.append({
                "key": domain,
                "load_kind": "extracted",
                "label": domain,
                "domain": domain,
                "sample_kind": "extracted",
                "slug_key": slug_key,
                "snapshots": enriched,
                "hiring_signals": jobs,
            })

    # 3. Build Cross-Company Entity Registry to detect Spinouts & Executive Migrations
    # canonical_person_key -> {"norm_name": str, "full_name": str, "orgs": Dict[domain, record]}
    global_people: List[dict] = []

    def get_person_bucket(full_name: str) -> Optional[dict]:
        norm = normalize_name(full_name)
        if not norm:
            return None
        for bucket in global_people:
            if bucket["norm_name"] == norm or _names_matchFuzzy(norm, bucket["norm_name"]):
                return bucket
        new_bucket = {"norm_name": norm, "full_name": full_name, "orgs": {}}
        global_people.append(new_bucket)
        return new_bucket

    for org in tracked_orgs:
        domain = org["domain"]
        snaps = org["snapshots"]
        latest_snap = snaps[-1]
        active_ids = {e["id"] for e in latest_snap.get("entities", [])}

        # Walk snapshots chronologically so latest role & active/departed state win per org
        for snap in snaps:
            era = _format_era_label(snap.get("snapshot_timestamp"))
            raw_ts = snap.get("snapshot_timestamp") or ""
            for e in snap.get("entities", []):
                fname = e.get("full_name") or ""
                bucket = get_person_bucket(fname)
                if not bucket:
                    continue
                is_still_active = e["id"] in active_ids
                prev_rec = bucket["orgs"].get(domain)
                first_ts = prev_rec["first_ts"] if prev_rec else raw_ts
                bucket["orgs"][domain] = {
                    "org_key": org["key"],
                    "load_kind": org["load_kind"],
                    "org_label": org["label"],
                    "domain": domain,
                    "entity_id": e["id"],
                    "full_name": fname,
                    "role_title": e.get("job_title") or "Leader",
                    "department": e.get("department") or "Executive",
                    "status": "active" if is_still_active else "departed",
                    "first_ts": first_ts,
                    "last_era": era,
                }

    cross_company_flows = []
    cross_links_by_domain_and_entity: Dict[str, Dict[str, List[dict]]] = defaultdict(lambda: defaultdict(list))

    for bucket in global_people:
        appearances = list(bucket["orgs"].values())
        if len(appearances) < 2:
            continue

        # Order appearances: departed origins first (or earlier first_ts), active destinations second
        appearances.sort(
            key=lambda a: (
                0 if a["status"] == "departed" else 1,
                a["first_ts"] if a["first_ts"] != "current" else "99999999999999",
            )
        )
        origin = appearances[0]
        dest = appearances[-1]

        dest_is_founder = bool(FOUNDER_PATTERN.search(dest["role_title"])) or bool(
            re.search(r"\bceo\b", dest["role_title"], re.I)
        )
        if origin["status"] == "departed" and dest["status"] == "active" and dest_is_founder:
            flow_type = "spinout_founded"
            badge_label = "Spinout Founded"
            narrative = (
                f"Exited {origin['domain']} ({origin['role_title']}) → "
                f"Founded / Leads {dest['domain']} ({dest['role_title']})"
            )
        elif origin["status"] == "departed" and dest["status"] == "active":
            flow_type = "executive_migration"
            badge_label = "Executive Migration"
            narrative = (
                f"Exited {origin['domain']} ({origin['role_title']}) → "
                f"Joined {dest['domain']} as {dest['role_title']}"
            )
        else:
            flow_type = "multi_org_leader"
            badge_label = "Multi-Org Principal"
            narrative = (
                f"Active across {origin['domain']} ({origin['role_title']}) and "
                f"{dest['domain']} ({dest['role_title']})"
            )

        flow_record = {
            "full_name": bucket["full_name"],
            "flow_type": flow_type,
            "badge_label": badge_label,
            "narrative": narrative,
            "from_org": origin,
            "to_org": dest,
        }
        cross_company_flows.append(flow_record)

        # Register bidirectional cross-org links for individual Node Profile inspection
        for i, app_a in enumerate(appearances):
            for j, app_b in enumerate(appearances):
                if i == j:
                    continue
                cross_links_by_domain_and_entity[app_a["domain"]][app_a["entity_id"]].append({
                    "other_org_key": app_b["org_key"],
                    "other_load_kind": app_b["load_kind"],
                    "other_domain": app_b["domain"],
                    "other_org_label": app_b["org_label"],
                    "other_entity_id": app_b["entity_id"],
                    "other_role": app_b["role_title"],
                    "other_status": app_b["status"],
                    "flow_badge": badge_label,
                })

    # 4. Build Portfolio Screener Company Rows
    company_rows = []
    total_leaders = 0
    total_prime_targets = 0
    total_open_roles = 0
    total_exec_open_roles = 0

    for org in tracked_orgs:
        latest = org["snapshots"][-1]
        intel = latest.get("intelligence") or {}
        vc = intel.get("vc_metrics") or {}
        radar = intel.get("recruiting_radar") or {}
        jobs = org["hiring_signals"] or {}

        headcount = vc.get("headcount") or len(latest.get("entities", []))
        prime_cnt = radar.get("high_priority_count") or 0
        watch_cnt = radar.get("watch_count") or 0
        open_cnt = jobs.get("total_open_roles") or 0
        exec_open_cnt = jobs.get("executive_open_roles") or 0
        top_cand = (radar.get("candidates") or [None])[0]
        top_vel_dept = (jobs.get("department_velocity") or [None])[0]

        total_leaders += headcount
        total_prime_targets += prime_cnt
        total_open_roles += open_cnt
        total_exec_open_roles += exec_open_cnt

        company_rows.append({
            "key": org["key"],
            "load_kind": org["load_kind"],
            "label": org["label"],
            "domain": org["domain"],
            "sample_kind": org["sample_kind"],
            "snapshots_count": len(org["snapshots"]),
            "latest_era": intel.get("era_label") or _format_era_label(latest.get("snapshot_timestamp")),
            "headcount": headcount,
            "retention_rate_pct": vc.get("retention_rate_pct", 100.0),
            "senior_churn_pct": vc.get("senior_churn_pct", 0.0),
            "bench_archetype": vc.get("bench_archetype") or "Baseline Cohort",
            "promo_vs_hire_ratio_pct": vc.get("promo_vs_hire_ratio_pct"),
            "prime_targets_count": prime_cnt,
            "watch_targets_count": watch_cnt,
            "top_poachable": {
                "id": top_cand["id"],
                "full_name": top_cand["full_name"],
                "job_title": top_cand["job_title"],
                "score": top_cand["score"],
                "tier": top_cand["tier"],
            } if top_cand else None,
            "open_roles_count": open_cnt,
            "exec_open_roles_count": exec_open_cnt,
            "ats_provider": jobs.get("ats_provider"),
            "top_hiring_signal": (
                f"{top_vel_dept['department']} ({top_vel_dept['open_roles']})"
                if top_vel_dept else "—"
            ),
            "alumni_count": len(intel.get("alumni_spinout_radar") or []),
        })

    # Default sort: highest prime poachable targets, then open roles, then headcount
    company_rows.sort(
        key=lambda r: (-r["prime_targets_count"], -r["open_roles_count"], -r["headcount"], r["domain"])
    )

    return {
        "portfolio_kpis": {
            "organizations_tracked": len(company_rows),
            "total_leaders_mapped": total_leaders,
            "total_prime_targets": total_prime_targets,
            "total_open_roles": total_open_roles,
            "total_exec_open_roles": total_exec_open_roles,
            "cross_company_flows_count": len(cross_company_flows),
        },
        "companies": company_rows,
        "cross_company_flows": cross_company_flows,
        "cross_links_index": {
            dom: dict(ent_map) for dom, ent_map in cross_links_by_domain_and_entity.items()
        },
    }

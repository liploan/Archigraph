"""Watchlist Alert Engine & Slack / CRM / ATS Webhook Payload Generator.

Evaluates structural transition rules across tracked organizations and produces
actionable push alerts with ready-to-fire Slack Block Kit and CRM/ATS webhook JSON payloads.
"""
from pathlib import Path
from typing import Dict, List, Optional

from src.portfolio import build_portfolio_overview


RULE_DEFINITIONS: List[dict] = [
    {
        "id": "spinout_watch",
        "label": "Spinouts & Migrations",
        "description": "Departed leaders founding new startups or joining tracked peers",
    },
    {
        "id": "c_suite_exit",
        "label": "VP+ & C-Suite Exits",
        "description": "Executive departures creating diligence flags & backchannel openings",
    },
    {
        "id": "prime_poachable",
        "label": "Prime Poachable ≥ 55",
        "description": "Active leaders layered over or orphaned in recent re-orgs",
    },
    {
        "id": "open_vp_gap",
        "label": "Unfilled VP+ Seats",
        "description": "Unbackfilled leadership departures & active executive requisitions",
    },
]


def _build_webhook_payloads(alert: dict) -> dict:
    """Construct Slack Block Kit and CRM/ATS webhook JSON payloads for an alert."""
    sev_tag = alert["severity"].upper()
    slack_payload = {
        "channel": "#archigraph-signals",
        "text": f"[{sev_tag}] {alert['headline']}",
        "blocks": [
            {
                "type": "header",
                "text": {
                    "type": "plain_text",
                    "text": f"Archigraph Signal · {alert['domain']}",
                },
            },
            {
                "type": "section",
                "fields": [
                    {"type": "mrkdwn", "text": f"*Rule:*\n`{alert['rule']}`"},
                    {"type": "mrkdwn", "text": f"*Severity:*\n*{sev_tag}*"},
                    {"type": "mrkdwn", "text": f"*Subject:*\n{alert['subject']}"},
                    {"type": "mrkdwn", "text": f"*Era:*\n{alert['era_label']}"},
                ],
            },
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"*{alert['headline']}*\n{alert['detail']}\n\n*Playbook:* {alert['recommended_action']}",
                },
            },
        ],
    }

    crm_ats_payload = {
        "schema_version": "2026-11",
        "event_id": alert["id"],
        "event_type": f"archigraph.{alert['rule']}",
        "severity": alert["severity"],
        "organization": {
            "domain": alert["domain"],
            "key": alert["org_key"],
            "snapshot_era": alert["era_label"],
        },
        "subject": {
            "entity_id": alert.get("entity_id"),
            "name_or_role": alert["subject"],
            "is_departed": bool(alert.get("is_departed", False)),
        },
        "signal_summary": alert["headline"],
        "evidence": alert["detail"],
        "recommended_playbook": alert["recommended_action"],
    }

    return {
        "slack": slack_payload,
        "crm_ats": crm_ats_payload,
    }


def generate_watchlist_alerts(
    demo_dir: Path,
    extracted_dir: Optional[Path] = None,
    enabled_rules: Optional[List[str]] = None,
) -> dict:
    """Evaluate watchlist trigger rules across all tracked organizations."""
    overview = build_portfolio_overview(demo_dir, extracted_dir)
    active_rule_set = set(enabled_rules) if enabled_rules is not None else {r["id"] for r in RULE_DEFINITIONS}

    alerts: List[dict] = []

    # 1. Cross-Company Spinout & Migration Alerts (highest institutional alpha)
    if "spinout_watch" in active_rule_set:
        for idx, fl in enumerate(overview.get("cross_company_flows") or []):
            dest = fl["to_org"]
            orig = fl["from_org"]
            alert = {
                "id": f"alert-spinout-{idx + 1}",
                "rule": "spinout_watch",
                "rule_label": "Spinout Watch",
                "severity": "critical" if fl["flow_type"] == "spinout_founded" else "high",
                "domain": dest["domain"],
                "org_key": dest["org_key"],
                "load_kind": dest["load_kind"],
                "era_label": dest.get("last_era") or "Current",
                "entity_id": dest["entity_id"],
                "is_departed": False,
                "subject": fl["full_name"],
                "headline": f"{fl['badge_label']}: {fl['full_name']} ({orig['domain']} → {dest['domain']})",
                "detail": fl["narrative"],
                "recommended_action": (
                    f"VC Sourcing: Initiate founder/Series B outreach at {dest['domain']} via {orig['domain']} alumni overlap."
                ),
            }
            alert["webhooks"] = _build_webhook_payloads(alert)
            alerts.append(alert)

    # Re-load per-org snapshots via manifest + cache to inspect detailed entity signals
    # (build_portfolio_overview already validated all non-empty orgs)
    import json
    manifest = {}
    manifest_file = demo_dir / "manifest.json"
    if manifest_file.exists():
        manifest = json.loads(manifest_file.read_text(encoding="utf-8"))

    from src.intelligence import enrich_snapshots_with_intelligence

    for comp in overview.get("companies") or []:
        key = comp["key"]
        load_kind = comp["load_kind"]
        domain = comp["domain"]
        if load_kind == "demo" and key in manifest:
            prefix = manifest[key]["prefix"]
            snaps = sorted(
                [json.loads(p.read_text(encoding="utf-8")) for p in demo_dir.glob(f"{prefix}_*_extracted.json")],
                key=lambda s: s.get("snapshot_timestamp", ""),
            )
        else:
            continue

        if not snaps:
            continue
        enriched = enrich_snapshots_with_intelligence(snaps)
        latest = enriched[-1]
        intel = latest.get("intelligence") or {}
        era_label = intel.get("era_label") or "Current"

        # 2. C-Suite & VP Exits in latest transition
        if "c_suite_exit" in active_rule_set:
            for dep in (intel.get("alumni_spinout_radar") or []):
                if dep.get("departed_timestamp") != latest.get("snapshot_timestamp"):
                    continue
                if dep.get("seniority_rank", 0) < 4:
                    continue
                alert = {
                    "id": f"alert-exit-{key}-{dep['id']}",
                    "rule": "c_suite_exit",
                    "rule_label": "VP+ / C-Suite Exit",
                    "severity": "critical" if dep.get("seniority_rank", 0) >= 6 else "high",
                    "domain": domain,
                    "org_key": key,
                    "load_kind": load_kind,
                    "era_label": era_label,
                    "entity_id": dep["id"],
                    "is_departed": True,
                    "subject": f"{dep['full_name']} (Ex-{dep['last_title']})",
                    "headline": f"Executive Exit at {domain}: {dep['full_name']} ({dep['last_title']})",
                    "detail": f"VC: {dep['vc_angle']} · Exec Search: {dep['recruiting_angle']}.",
                    "recommended_action": (
                        f"Schedule off-list diligence call or advisory/C-suite placement outreach to {dep['full_name']}."
                    ),
                }
                alert["webhooks"] = _build_webhook_payloads(alert)
                alerts.append(alert)

        # 3. Prime Poachable Active Executives (Score >= 55)
        if "prime_poachable" in active_rule_set:
            for cand in (intel.get("recruiting_radar", {}).get("candidates") or []):
                if cand.get("score", 0) < 55:
                    continue
                alert = {
                    "id": f"alert-poach-{key}-{cand['id']}",
                    "rule": "prime_poachable",
                    "rule_label": f"Poachability {cand['score']}/100",
                    "severity": "high" if cand["score"] >= 68 else "medium",
                    "domain": domain,
                    "org_key": key,
                    "load_kind": load_kind,
                    "era_label": era_label,
                    "entity_id": cand["id"],
                    "is_departed": False,
                    "subject": f"{cand['full_name']} ({cand['job_title']})",
                    "headline": f"Prime Target ({cand['score']}/100) at {domain}: {cand['full_name']}",
                    "detail": f"{cand['primary_trigger']} — {cand['primary_detail']}",
                    "recommended_action": (
                        f"Exec Search: Trigger warm outreach to {cand['full_name']} within 60-day post-reorg window."
                    ),
                }
                alert["webhooks"] = _build_webhook_payloads(alert)
                alerts.append(alert)

        # 4. Unfilled VP+ Leadership Seats
        if "open_vp_gap" in active_rule_set:
            for idx_s, seat in enumerate(intel.get("strategic_signals", {}).get("open_leadership_seats") or []):
                alert = {
                    "id": f"alert-gap-{key}-{idx_s + 1}",
                    "rule": "open_vp_gap",
                    "rule_label": "Unfilled VP+ Gap",
                    "severity": "medium",
                    "domain": domain,
                    "org_key": key,
                    "load_kind": load_kind,
                    "era_label": era_label,
                    "entity_id": None,
                    "is_departed": False,
                    "subject": f"{seat['role_title']} ({seat['department']})",
                    "headline": f"Unbackfilled {seat['role_title']} Seat at {domain}",
                    "detail": f"Vacated by {seat['vacated_by']} with no equivalent {seat['department']} VP+ backfill detected.",
                    "recommended_action": (
                        f"Pitch retained {seat['role_title']} search to {domain} CEO/Talent Partner; flag GTM/Product execution gap for IC."
                    ),
                }
                alert["webhooks"] = _build_webhook_payloads(alert)
                alerts.append(alert)

    severity_rank = {"critical": 0, "high": 1, "medium": 2}
    alerts.sort(key=lambda a: (severity_rank.get(a["severity"], 3), a["domain"], a["id"]))

    return {
        "rules": RULE_DEFINITIONS,
        "total_alerts": len(alerts),
        "critical_count": sum(1 for a in alerts if a["severity"] == "critical"),
        "alerts": alerts,
    }

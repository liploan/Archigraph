"""VC/PE Organizational Diligence & Executive Recruiting Intelligence Engine.

Transforms chronological org snapshots into:
1. Quantitative VC/PE Org Health & Diligence Metrics (retention, senior churn, internal promo
   vs. external hire ratio, span-of-control bottlenecks, department & capability pivots, and
   citation-backed bull/risk thesis bullets).
2. Executive Recruiting Poachability Radar (0-100 multi-factor flight-risk & target scoring:
   layered-over detection, manager departure shock, lateral re-org, peer promotion pass-over,
   and span compression).
3. Spinout & Available-Executive Alumni Watchlist (departed founders/C-suite/VPs).
4. Network Overlap & Candid Backchannel Matcher (links a user's contact list against both
   current executives and historical/departed snapshots for warm intros & off-list diligence).
"""
import re
from collections import Counter, defaultdict
from copy import deepcopy
from typing import Dict, List, Optional, Set, Tuple

from src.diff_engine import (
    _names_matchFuzzy,
    enrich_snapshots_with_diffs,
    normalize_name,
    seniority_rank,
)


FOUNDER_PATTERN = re.compile(r"\b(co-?founder|founder)\b", re.I)
AI_TECH_PATTERN = re.compile(
    r"\b(ai|artificial intelligence|machine learning|llm|deep learning|research|chief scientist|cto|propulsion|foundry)\b",
    re.I,
)


SAMPLE_INVESTOR_NETWORK: List[dict] = [
    {
        "name": "John Agan",
        "company": "Replit (Alumni)",
        "role": "Former VP of Product & Data",
        "relationship": "Portfolio Operator",
    },
    {
        "name": "Ben Gomes",
        "company": "Google (Alumni)",
        "role": "Former SVP / VP of Search Engineering",
        "relationship": "LP & Technical Advisor",
    },
    {
        "name": "Sheryl Sandberg",
        "company": "Meta (Alumni)",
        "role": "Former Chief Operating Officer",
        "relationship": "Co-Investor Network",
    },
    {
        "name": "Kevin Systrom",
        "company": "Instagram / Meta (Alumni)",
        "role": "Co-Founder & Former VP",
        "relationship": "Founder Network",
    },
    {
        "name": "Tom Mueller",
        "company": "SpaceX (Alumni)",
        "role": "Former VP of Propulsion Development",
        "relationship": "DeepTech Advisor",
    },
    {
        "name": "Elena Rostova",
        "company": "Palantir Technologies",
        "role": "Former Forward Deployed Engineering Lead",
        "relationship": "Seed Founder (Ex-Palantir)",
    },
    {
        "name": "Marcus Vance",
        "company": "Replit",
        "role": "Former Staff Infrastructure Engineer",
        "relationship": "Talent Scout",
    },
    {
        "name": "Priya Nair",
        "company": "Google DeepMind",
        "role": "Former Principal Research PM",
        "relationship": "AI Fellow",
    },
    {
        "name": "Devon Brooks",
        "company": "SpaceX",
        "role": "Former Starlink Avionics Manager",
        "relationship": "Executive Search Referrer",
    },
]


def _format_era_label(ts: Optional[str]) -> str:
    if not ts or ts == "current":
        return "Current"
    if len(ts) >= 6:
        year = ts[0:4]
        month_str = ts[4:6]
        months = [
            "Jan", "Feb", "Mar", "Apr", "May", "Jun",
            "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
        ]
        try:
            m_idx = int(month_str) - 1
            if 0 <= m_idx < 12:
                return f"{months[m_idx]} {year}"
        except ValueError:
            pass
        return year
    return ts


def _compute_direct_reports(entities: List[dict]) -> Dict[str, List[str]]:
    """Map canonical entity ID -> list of direct report IDs within a snapshot."""
    by_id = {e["id"]: e for e in entities if e.get("id")}
    name_to_id = {
        normalize_name(e.get("full_name", "")): e["id"]
        for e in entities
        if e.get("id") and e.get("full_name")
    }
    reports: Dict[str, List[str]] = defaultdict(list)
    for e in entities:
        eid = e.get("id")
        mgr = e.get("manager_name_or_id")
        if not eid or not mgr:
            continue
        mgr_id = mgr if mgr in by_id else name_to_id.get(normalize_name(mgr))
        if mgr_id and mgr_id != eid:
            reports[mgr_id].append(eid)
    return reports


def _compute_tree_depth(entities: List[dict], reports_map: Dict[str, List[str]]) -> int:
    """Compute maximum reporting chain depth (1 = flat single node, 2 = CEO + directs, etc.)."""
    if not entities:
        return 0
    by_id = {e["id"]: e for e in entities if e.get("id")}
    roots = [
        e["id"]
        for e in entities
        if not e.get("manager_name_or_id") or e.get("manager_name_or_id") not in by_id
    ]
    if not roots:
        roots = [entities[0]["id"]]

    max_depth = 1
    for r in roots:
        stack: List[Tuple[str, int, Set[str]]] = [(r, 1, {r})]
        while stack:
            nid, depth, visited = stack.pop()
            if depth > max_depth:
                max_depth = depth
            for child_id in reports_map.get(nid, []):
                if child_id not in visited:
                    stack.append((child_id, depth + 1, visited | {child_id}))
    return max_depth


def _score_entity_poachability(
    entity: dict,
    snap_idx: int,
    curr_map: Dict[str, dict],
    curr_reports: Dict[str, List[str]],
    prev_map: Optional[Dict[str, dict]],
    prev_reports: Optional[Dict[str, List[str]]],
    departed_ids: Set[str],
    promoted_ids: Set[str],
) -> dict:
    """Compute a transparent 0-100 executive poachability / flight-risk assessment."""
    eid = entity.get("id", "")
    title = entity.get("job_title") or ""
    rank = seniority_rank(title)
    is_founder = bool(FOUNDER_PATTERN.search(title))
    mgr_id = entity.get("manager_name_or_id")
    is_top_root = not mgr_id or mgr_id not in curr_map

    # Base ambient market mobility score by seniority tier
    score = 24 if rank >= 3 else 20
    triggers: List[dict] = []

    if snap_idx == 0 or prev_map is None or prev_reports is None:
        if is_founder or (is_top_root and rank >= 6):
            score = 8
            triggers.append({
                "code": "founder_anchor",
                "label": "Founder / Top Principal",
                "impact": -16,
                "detail": "Top-level executive anchor in baseline snapshot.",
            })
        else:
            mgr_reports = len(curr_reports.get(mgr_id, [])) if mgr_id else 0
            if mgr_reports >= 5:
                score += 12
                triggers.append({
                    "code": "crowded_reporting_layer",
                    "label": "Crowded Direct-Report Layer",
                    "impact": 12,
                    "detail": f"Shares manager bandwidth with {mgr_reports - 1} peers.",
                })
            else:
                triggers.append({
                    "code": "baseline_benchmark",
                    "label": "Baseline Snapshot",
                    "impact": 0,
                    "detail": "Add an earlier or later snapshot to unlock transition signals.",
                })
    else:
        status = (entity.get("diff") or {}).get("status", "unchanged")
        prev_e = prev_map.get(eid)
        prev_mgr_id = prev_e.get("manager_name_or_id") if prev_e else None
        curr_mgr_obj = curr_map.get(mgr_id) if mgr_id else None
        curr_mgr_status = (curr_mgr_obj.get("diff") or {}).get("status") if curr_mgr_obj else None

        # 1. Layered over: manager changed to a newly hired or newly promoted leader without own promotion
        if prev_e and status not in ("promoted", "joined") and mgr_id and mgr_id != prev_mgr_id:
            if curr_mgr_status in ("joined", "promoted"):
                mgr_name = curr_mgr_obj.get("full_name", mgr_id) if curr_mgr_obj else mgr_id
                action_word = "external hire" if curr_mgr_status == "joined" else "newly promoted"
                score += 38
                triggers.append({
                    "code": "layered_over",
                    "label": "Layered Over in Re-Org",
                    "impact": 38,
                    "detail": f"Shifted to report under {action_word} {mgr_name} without title progression.",
                })
            elif prev_mgr_id is None and mgr_id is not None:
                mgr_name = curr_mgr_obj.get("full_name", mgr_id) if curr_mgr_obj else mgr_id
                score += 34
                triggers.append({
                    "code": "layered_from_root",
                    "label": "Removed from Top Layer",
                    "impact": 34,
                    "detail": f"Previously top-level; now nested under {mgr_name}.",
                })
            else:
                mgr_name = curr_mgr_obj.get("full_name", mgr_id) if curr_mgr_obj else mgr_id
                score += 24
                triggers.append({
                    "code": "reporting_line_shifted",
                    "label": "Reporting Line Re-routed",
                    "impact": 24,
                    "detail": f"Re-assigned to report to {mgr_name} without title elevation.",
                })

        # 2. Former manager departed (classic 6-12 month executive attrition catalyst, unless promoted to top root)
        if prev_mgr_id and prev_mgr_id in departed_ids and not (is_top_root and status == "promoted"):
            prev_mgr_name = (
                prev_map[prev_mgr_id].get("full_name", prev_mgr_id)
                if prev_mgr_id in prev_map
                else prev_mgr_id
            )
            impact = 24 if status != "promoted" else 14
            score += impact
            triggers.append({
                "code": "boss_departed",
                "label": "Sponsor / Manager Departed",
                "impact": impact,
                "detail": f"Former manager {prev_mgr_name} exited since prior snapshot.",
            })

        # 3. Department lateral shift without promotion
        if prev_e and status == "moved":
            prev_dept = (prev_e.get("department") or "").strip()
            curr_dept = (entity.get("department") or "").strip()
            if prev_dept.lower() != curr_dept.lower():
                score += 12
                triggers.append({
                    "code": "dept_reassigned",
                    "label": "Cross-Department Re-org",
                    "impact": 12,
                    "detail": f"Moved from {prev_dept or 'Unassigned'} to {curr_dept or 'Unassigned'}.",
                })

        # 4. Passed over while cohort peers were promoted
        if prev_e and status in ("unchanged", "moved") and not is_founder and not is_top_root:
            prev_dept = (prev_e.get("department") or "").strip().lower()
            promoted_peers = []
            for pid in promoted_ids:
                if pid == eid or pid not in prev_map or pid not in curr_map:
                    continue
                peer_prev = prev_map[pid]
                same_mgr = prev_mgr_id and peer_prev.get("manager_name_or_id") == prev_mgr_id
                same_dept = prev_dept and (peer_prev.get("department") or "").strip().lower() == prev_dept
                if same_mgr or same_dept:
                    promoted_peers.append(curr_map[pid].get("full_name", pid))

            if promoted_peers:
                sample_peers = ", ".join(promoted_peers[:2])
                score += 18
                triggers.append({
                    "code": "passed_over_cohort",
                    "label": "Stagnant Amid Peer Promotions",
                    "impact": 18,
                    "detail": f"Held tier while cohort peer(s) ({sample_peers}) advanced.",
                })

        # 5. Span-of-control compression (skip top CEO/Founder delegating reports to C-suite)
        if prev_e and not is_founder and not (is_top_root and rank >= 6):
            prev_span = len(prev_reports.get(eid, []))
            curr_span = len(curr_reports.get(eid, []))
            if prev_span > 0 and curr_span < prev_span:
                lost = prev_span - curr_span
                score += 16
                triggers.append({
                    "code": "span_compressed",
                    "label": "Scope / Span Reduced",
                    "impact": 16,
                    "detail": f"Direct reports dropped from {prev_span} to {curr_span} (−{lost}).",
                })

        # 6. Stabilizing anchors (newly promoted, newly hired, or founder/CEO root)
        if status == "promoted":
            score -= 18
            triggers.append({
                "code": "fresh_promotion",
                "label": "Recently Promoted",
                "impact": -18,
                "detail": entity.get("diff", {}).get("summary", "Elevated in latest transition."),
            })
        elif status == "joined":
            score -= 14
            triggers.append({
                "code": "recent_hire",
                "label": "Recent Addition (Honeymoon Window)",
                "impact": -14,
                "detail": f"Joined as {title}; low near-term attrition odds.",
            })

        if is_founder or (is_top_root and rank >= 6):
            score -= 22
            triggers.append({
                "code": "founder_anchor",
                "label": "Founder / Principal Anchor",
                "impact": -22,
                "detail": "Core equity/control anchor.",
            })

    score = max(6, min(94, int(round(score))))
    if score >= 55:
        tier = "high"
        tier_label = "Prime Target"
    elif score >= 32:
        tier = "watch"
        tier_label = "Passive Watch"
    else:
        tier = "anchored"
        tier_label = "Anchored"

    if not triggers:
        triggers.append({
            "code": "steady_seat",
            "label": "Stable Seat & Reporting Line",
            "impact": 0,
            "detail": "No structural displacement detected in this era.",
        })
    elif tier == "anchored":
        # Show stabilizing anchors first for anchored leaders
        triggers.sort(key=lambda t: (t["impact"], -abs(t["impact"])))
    else:
        # Show highest flight-risk catalysts first for watch/prime targets
        triggers.sort(key=lambda t: -t["impact"])

    return {
        "score": score,
        "tier": tier,
        "tier_label": tier_label,
        "seniority_rank": rank,
        "direct_reports_count": len(curr_reports.get(eid, [])),
        "triggers": triggers,
    }


def enrich_snapshots_with_intelligence(snapshots: List[dict]) -> List[dict]:
    """Enrich snapshots with diffs, VC/PE org health metrics, and executive recruiting signals."""
    if not snapshots:
        return []

    # Ensure canonical entity resolution & diff enrichment have run
    needs_diffs = any("diff_summary" not in s for s in snapshots)
    enriched = enrich_snapshots_with_diffs(snapshots) if needs_diffs else deepcopy(snapshots)

    cumulative_alumni: Dict[str, dict] = {}

    for idx, snap in enumerate(enriched):
        entities = snap.get("entities", [])
        curr_map = {e["id"]: e for e in entities if e.get("id")}
        curr_reports = _compute_direct_reports(entities)
        org_depth = _compute_tree_depth(entities, curr_reports)

        prev_snap = enriched[idx - 1] if idx > 0 else None
        prev_entities = prev_snap.get("entities", []) if prev_snap else []
        prev_map = {e["id"]: e for e in prev_entities if e.get("id")} if prev_snap else None
        prev_reports = _compute_direct_reports(prev_entities) if prev_snap else None

        diff_summary = snap.get("diff_summary") or {}
        departed_list = diff_summary.get("departed") or []
        promoted_list = diff_summary.get("promoted") or []
        joined_list = diff_summary.get("joined") or []
        moved_list = diff_summary.get("moved") or []

        departed_ids = {d["id"] for d in departed_list if d.get("id")}
        promoted_ids = {p["id"] for p in promoted_list if p.get("id")}

        # Remove anyone who boomerang-returned from cumulative alumni
        for active_id in curr_map:
            cumulative_alumni.pop(active_id, None)

        # Register newly departed leaders for Spinout & Placement Watch
        era_label = _format_era_label(snap.get("snapshot_timestamp"))
        for dep in departed_list:
            dep_id = dep.get("id")
            if not dep_id:
                continue
            dep_title = dep.get("job_title") or "Leader"
            dep_dept = dep.get("department") or "Executive"
            dep_rank = seniority_rank(dep_title)
            dep_skills = dep.get("expertise_keywords") or []
            skill_blob = " ".join([dep_title, dep_dept] + dep_skills)

            is_spinout_profile = (
                bool(FOUNDER_PATTERN.search(dep_title))
                or bool(re.search(r"\b(principal|chief|distinguished)\s+scientist\b", dep_title, re.I))
                or (dep_rank >= 3 and bool(AI_TECH_PATTERN.search(skill_blob)))
            )
            if is_spinout_profile:
                vc_angle = "Stealth Spinout / Founder Watch"
                spinout_priority = 1
            elif dep_rank >= 4:
                vc_angle = "Operating Advisor / Diligence Reference"
                spinout_priority = 2
            else:
                vc_angle = "Backchannel Diligence Contact"
                spinout_priority = 3

            if dep_rank >= 5:
                recruiting_angle = "Available C-Suite / Board Target"
            elif dep_rank >= 3:
                recruiting_angle = "Available VP / Functional Head"
            else:
                recruiting_angle = "Experienced IC / Lead Talent"

            cumulative_alumni[dep_id] = {
                "id": dep_id,
                "full_name": dep.get("full_name"),
                "last_title": dep_title,
                "last_department": dep_dept,
                "seniority_rank": dep_rank,
                "spinout_priority": spinout_priority,
                "departed_era": era_label,
                "departed_timestamp": snap.get("snapshot_timestamp"),
                "vc_angle": vc_angle,
                "recruiting_angle": recruiting_angle,
                "expertise_keywords": dep_skills[:5],
            }

        # Score poachability for every active entity
        candidates = []
        for e in entities:
            rec = _score_entity_poachability(
                entity=e,
                snap_idx=idx,
                curr_map=curr_map,
                curr_reports=curr_reports,
                prev_map=prev_map,
                prev_reports=prev_reports,
                departed_ids=departed_ids,
                promoted_ids=promoted_ids,
            )
            e["recruiting"] = rec
            candidates.append({
                "id": e["id"],
                "full_name": e.get("full_name"),
                "job_title": e.get("job_title"),
                "department": e.get("department") or "Other",
                "score": rec["score"],
                "tier": rec["tier"],
                "tier_label": rec["tier_label"],
                "seniority_rank": rec["seniority_rank"],
                "direct_reports_count": rec["direct_reports_count"],
                "primary_trigger": rec["triggers"][0]["label"] if rec["triggers"] else "",
                "primary_detail": rec["triggers"][0]["detail"] if rec["triggers"] else "",
                "triggers": rec["triggers"],
            })

        candidates.sort(key=lambda c: (-c["score"], -c["seniority_rank"], c["full_name"] or ""))

        # Span-of-control & Key-Person Dependency analysis
        active_managers = [
            (mid, len(rep_ids))
            for mid, rep_ids in curr_reports.items()
            if mid in curr_map and len(rep_ids) > 0
        ]
        avg_span = (
            round(sum(cnt for _, cnt in active_managers) / len(active_managers), 1)
            if active_managers
            else 0.0
        )
        max_span_info = None
        key_person_risks = []
        total_active = len(entities)
        if active_managers:
            active_managers.sort(key=lambda item: (-item[1], item[0]))
            top_mid, top_cnt = active_managers[0]
            top_mgr = curr_map[top_mid]
            share_pct = round((top_cnt / max(1, total_active - 1)) * 100) if total_active > 1 else 0
            max_span_info = {
                "id": top_mid,
                "full_name": top_mgr.get("full_name"),
                "job_title": top_mgr.get("job_title"),
                "direct_reports": top_cnt,
                "share_pct": share_pct,
            }
            for mid, cnt in active_managers:
                mgr_e = curr_map[mid]
                mgr_share = round((cnt / max(1, total_active - 1)) * 100) if total_active > 1 else 0
                if cnt >= 3 or mgr_share >= 35:
                    child_depts = {
                        (curr_map[cid].get("department") or "Other")
                        for cid in curr_reports[mid]
                        if cid in curr_map
                    }
                    key_person_risks.append({
                        "id": mid,
                        "full_name": mgr_e.get("full_name"),
                        "job_title": mgr_e.get("job_title"),
                        "direct_reports": cnt,
                        "share_pct": mgr_share,
                        "risk_level": "high" if (cnt >= 4 or mgr_share >= 45) else "moderate",
                        "rationale": (
                            f"Directly oversees {cnt} leaders ({mgr_share}% of mapped org) "
                            f"spanning {len(child_depts)} function(s)."
                        ),
                    })

        # Quantitative VC/PE Metrics
        if idx == 0 or not prev_snap:
            retention_rate_pct = 100.0
            senior_churn_pct = 0.0
            net_delta = None
            promo_count = 0
            ext_senior_hires = 0
            promo_ratio_pct = None
            bench_archetype = "Baseline Cohort"
        else:
            prev_total = len(prev_entities)
            retained_count = sum(1 for e in entities if e["id"] in prev_map)
            retention_rate_pct = round((retained_count / max(1, prev_total)) * 100, 1)

            prev_seniors = [e for e in prev_entities if seniority_rank(e.get("job_title")) >= 4]
            dep_seniors = [e for e in prev_seniors if e["id"] in departed_ids]
            senior_churn_pct = (
                round((len(dep_seniors) / len(prev_seniors)) * 100, 1) if prev_seniors else 0.0
            )
            net_delta = total_active - prev_total
            promo_count = len(promoted_list)
            ext_senior_hires = sum(
                1 for j in joined_list if seniority_rank(j.get("job_title")) >= 4
            )
            denom = promo_count + ext_senior_hires
            promo_ratio_pct = round((promo_count / denom) * 100) if denom > 0 else None
            if denom == 0:
                bench_archetype = "Steady Bench"
            elif promo_ratio_pct is not None and promo_ratio_pct >= 67:
                bench_archetype = "Internal Bench-Builder"
            elif promo_ratio_pct is not None and promo_ratio_pct <= 33:
                bench_archetype = "External Talent Magnet"
            else:
                bench_archetype = "Balanced Scaling"

        # Department Mix & Capability Shifts
        dept_counts = Counter((e.get("department") or "Other").strip() for e in entities)
        prev_dept_counts = (
            Counter((e.get("department") or "Other").strip() for e in prev_entities)
            if prev_snap
            else Counter()
        )
        all_depts = set(dept_counts.keys()) | set(prev_dept_counts.keys())
        dept_mix = []
        for dept in all_depts:
            c_cnt = dept_counts.get(dept, 0)
            c_share = round((c_cnt / max(1, total_active)) * 100, 1)
            if prev_snap and len(prev_entities) > 0:
                p_share = round((prev_dept_counts.get(dept, 0) / len(prev_entities)) * 100, 1)
                delta_pct = round(c_share - p_share, 1)
            else:
                delta_pct = 0.0
            if c_cnt > 0 or delta_pct != 0:
                dept_mix.append({
                    "department": dept,
                    "count": c_cnt,
                    "share_pct": c_share,
                    "delta_pct": delta_pct,
                })
        dept_mix.sort(key=lambda d: (-d["count"], -abs(d["delta_pct"]), d["department"]))

        curr_kw_display: Dict[str, str] = {}
        curr_kw_counts: Counter = Counter()
        for e in entities:
            for kw in e.get("expertise_keywords") or []:
                k = kw.strip().lower()
                if k:
                    curr_kw_display.setdefault(k, kw.strip())
                    curr_kw_counts[k] += 1

        emerging_capabilities: List[str] = []
        retiring_capabilities: List[str] = []
        if prev_snap:
            prev_kw_display: Dict[str, str] = {}
            prev_kw_counts: Counter = Counter()
            for e in prev_entities:
                for kw in e.get("expertise_keywords") or []:
                    k = kw.strip().lower()
                    if k:
                        prev_kw_display.setdefault(k, kw.strip())
                        prev_kw_counts[k] += 1

            new_keys = [k for k in curr_kw_counts if k not in prev_kw_counts]
            new_keys.sort(key=lambda k: (-curr_kw_counts[k], k))
            emerging_capabilities = [curr_kw_display[k] for k in new_keys[:6]]

            lost_keys = [k for k in prev_kw_counts if k not in curr_kw_counts]
            lost_keys.sort(key=lambda k: (-prev_kw_counts[k], k))
            retiring_capabilities = [prev_kw_display[k] for k in lost_keys[:5]]
        else:
            top_initial = [k for k, _ in curr_kw_counts.most_common(6)]
            emerging_capabilities = [curr_kw_display[k] for k in top_initial]

        # Open Leadership Seats (departed VP+ whose functional leadership tier wasn't backfilled)
        open_seats = []
        if prev_snap:
            for dep in departed_list:
                dep_title = dep.get("job_title") or ""
                dep_rank = seniority_rank(dep_title)
                if dep_rank < 4:
                    continue
                dep_dept = (dep.get("department") or "Executive").strip()
                backfilled = any(
                    (e.get("department") or "").strip().lower() == dep_dept.lower()
                    and seniority_rank(e.get("job_title")) >= dep_rank
                    and (e.get("diff") or {}).get("status") in ("joined", "promoted")
                    for e in entities
                )
                if not backfilled:
                    open_seats.append({
                        "vacated_by": dep.get("full_name"),
                        "role_title": dep_title,
                        "department": dep_dept,
                    })

        # Synthesize Citation-Backed VC/PE Diligence Brief
        org_label = snap.get("organization_name") or "Organization"
        high_poach_count = sum(1 for c in candidates if c["tier"] == "high")
        watch_poach_count = sum(1 for c in candidates if c["tier"] == "watch")

        bull_signals: List[str] = []
        risk_signals: List[str] = []

        if idx == 0 or not prev_snap:
            headline = (
                f"Baseline org map for {org_label} ({era_label}): {total_active} mapped leaders "
                f"across {len(dept_counts)} functions at {org_depth}-layer depth."
            )
            bull_signals.append(
                f"Mapped {total_active} leadership profiles spanning {', '.join(d['department'] for d in dept_mix[:3])}."
            )
            if emerging_capabilities:
                bull_signals.append(
                    f"Core capability concentration in {', '.join(emerging_capabilities[:4])}."
                )
            if key_person_risks:
                top_kp = key_person_risks[0]
                risk_signals.append(
                    f"Concentration risk: {top_kp['full_name']} ({top_kp['job_title']}) directly manages "
                    f"{top_kp['direct_reports']} leaders ({top_kp['share_pct']}% of mapped org)."
                )
        else:
            prev_era = _format_era_label(prev_snap.get("snapshot_timestamp"))
            growing_depts = [d for d in dept_mix if d["delta_pct"] >= 5.0]
            pivot_clause = (
                f"expanding {growing_depts[0]['department']} (+{growing_depts[0]['delta_pct']}%)"
                if growing_depts
                else f"{bench_archetype.lower()} posture"
            )
            headline = (
                f"{prev_era} → {era_label}: {retention_rate_pct}% leadership retention, "
                f"{promo_count} internal promotion(s), {len(joined_list)} addition(s), {pivot_clause}."
            )

            if retention_rate_pct >= 75:
                bull_signals.append(
                    f"High management continuity ({retention_rate_pct}% retained from {prev_era}), "
                    f"signaling low executive execution disruption."
                )
            if promo_count > 0:
                promoted_names = ", ".join(p.get("full_name", "") for p in promoted_list[:2])
                bull_signals.append(
                    f"Internal bench velocity: {promo_count} leader(s) promoted ({promoted_names}) — {bench_archetype}."
                )
            if ext_senior_hires > 0:
                senior_joined_names = ", ".join(
                    j.get("full_name", "")
                    for j in joined_list
                    if seniority_rank(j.get("job_title")) >= 4
                )
                bull_signals.append(
                    f"Upgraded senior bench with {ext_senior_hires} external VP+/C-suite hire(s) ({senior_joined_names})."
                )
            if emerging_capabilities:
                bull_signals.append(
                    f"New domain capabilities surfaced: {', '.join(emerging_capabilities[:4])}."
                )

            if senior_churn_pct >= 25:
                dep_names = ", ".join(d.get("full_name", "") for d in departed_list[:3])
                risk_signals.append(
                    f"Elevated VP+/C-suite turnover ({senior_churn_pct}% senior churn: {dep_names}) — "
                    f"prioritize backchannel reference checks."
                )
            if open_seats:
                seat_desc = ", ".join(f"{s['role_title']} (ex-{s['vacated_by']})" for s in open_seats[:2])
                risk_signals.append(
                    f"Unbackfilled senior seat(s) detected: {seat_desc}."
                )
            if high_poach_count > 0:
                top_targets = ", ".join(
                    c["full_name"] for c in candidates if c["tier"] == "high"
                )[:80]
                risk_signals.append(
                    f"Post-reorg retention watch: {high_poach_count} leader(s) flagged high flight-risk ({top_targets})."
                )
            if key_person_risks:
                top_kp = key_person_risks[0]
                risk_signals.append(
                    f"Span bottleneck: {top_kp['full_name']} oversees {top_kp['direct_reports']} direct reports ({top_kp['share_pct']}% of org)."
                )

        if not risk_signals:
            risk_signals.append("Low structural friction detected; monitor span of control as headcount scales.")

        alumni_sorted = sorted(
            cumulative_alumni.values(),
            key=lambda a: (a.get("spinout_priority", 3), -a["seniority_rank"], a["full_name"] or ""),
        )

        snap["intelligence"] = {
            "era_label": era_label,
            "vc_metrics": {
                "headcount": total_active,
                "net_headcount_delta": net_delta,
                "retention_rate_pct": retention_rate_pct,
                "senior_churn_pct": senior_churn_pct,
                "internal_promo_count": promo_count,
                "external_senior_hires": ext_senior_hires,
                "promo_vs_hire_ratio_pct": promo_ratio_pct,
                "bench_archetype": bench_archetype,
                "org_depth": org_depth,
                "avg_span_of_control": avg_span,
                "max_span_manager": max_span_info,
            },
            "strategic_signals": {
                "department_mix": dept_mix,
                "emerging_capabilities": emerging_capabilities,
                "retiring_capabilities": retiring_capabilities,
                "open_leadership_seats": open_seats,
            },
            "key_person_risks": key_person_risks,
            "diligence_brief": {
                "headline": headline,
                "bull_signals": bull_signals,
                "risk_signals": risk_signals,
            },
            "recruiting_radar": {
                "high_priority_count": high_poach_count,
                "watch_count": watch_poach_count,
                "candidates": candidates,
            },
            "alumni_spinout_radar": alumni_sorted,
        }

    return enriched


def _company_tokens(raw_company: str) -> Set[str]:
    """Normalize company string into core brand tokens (e.g. 'Replit (Alumni)' -> {'replit'})."""
    if not raw_company:
        return set()
    stop = {
        "inc", "corp", "corporation", "llc", "ltd", "co", "company", "technologies",
        "technology", "labs", "platforms", "platform", "alumni", "former", "ex", "the", "com",
    }
    tokens = set(re.findall(r"[a-z0-9]+", raw_company.lower()))
    return {t for t in tokens if len(t) >= 3 and t not in stop}


def match_network_against_snapshots(
    contacts: List[dict],
    snapshots: List[dict],
    domain: str = "",
) -> dict:
    """Match user's professional network against active & historical snapshots.

    Surfaces:
    1. Direct Active Insiders (1st-degree connections currently in the org)
    2. Candid Backchannel References (contacts who exited in earlier snapshots + exact current
       leaders they overlapped with, or former employees of the same company)
    3. Functional / Warm-Intro Bridges into active target nodes
    """
    if not contacts or not snapshots:
        return {
            "contacts_analyzed": len(contacts or []),
            "total_matches": 0,
            "insiders": [],
            "backchannels": [],
            "org_veterans": [],
            "entity_connections": {},
        }

    latest_snap = snapshots[-1]
    active_entities = latest_snap.get("entities", [])
    active_by_id = {e["id"]: e for e in active_entities if e.get("id")}

    org_name = latest_snap.get("organization_name") or domain or ""
    target_org_tokens = _company_tokens(org_name) | _company_tokens(domain)
    # Include well-known parent/subsidiary aliases so e.g. Instagram/DeepMind/Alphabet match
    if "google" in target_org_tokens:
        target_org_tokens |= {"alphabet", "deepmind"}
    if "meta" in target_org_tokens:
        target_org_tokens |= {"facebook", "instagram", "whatsapp", "oculus"}

    # Build historical index across all snapshots: person_id -> list of (era_label, entity, co_workers)
    historical_appearances: Dict[str, List[dict]] = defaultdict(list)
    historical_people: Dict[str, dict] = {}
    for snap in snapshots:
        era = _format_era_label(snap.get("snapshot_timestamp"))
        ents = snap.get("entities", [])
        for e in ents:
            eid = e.get("id")
            if not eid:
                continue
            historical_people[eid] = e
            historical_appearances[eid].append({
                "era": era,
                "entity": e,
                "all_entities": ents,
            })

    insiders = []
    backchannels = []
    org_veterans = []
    entity_connections: Dict[str, List[dict]] = defaultdict(list)

    for raw_c in contacts[:500]:
        if not isinstance(raw_c, dict):
            continue
        c_name = (raw_c.get("name") or "").strip()
        if not c_name:
            continue
        c_company = (raw_c.get("company") or "").strip()
        c_role = (raw_c.get("role") or "").strip()
        c_rel = (raw_c.get("relationship") or "1st-Degree Contact").strip()
        c_norm = normalize_name(c_name)
        if not c_norm:
            continue

        # 1. Check if contact matches any person across current or historical snapshots
        matched_pid = None
        for pid, p_obj in historical_people.items():
            p_norm = normalize_name(p_obj.get("full_name", ""))
            if c_norm == p_norm or _names_matchFuzzy(c_norm, p_norm):
                matched_pid = pid
                break

        if matched_pid and matched_pid in active_by_id:
            target = active_by_id[matched_pid]
            match_entry = {
                "contact_name": c_name,
                "contact_role": c_role or target.get("job_title"),
                "relationship": c_rel,
                "target_id": matched_pid,
                "target_name": target.get("full_name"),
                "target_title": target.get("job_title"),
                "match_type": "direct_insider",
                "summary": f"Direct 1st-degree access to {target.get('full_name')} ({target.get('job_title')}).",
            }
            insiders.append(match_entry)
            entity_connections[matched_pid].append({
                "type": "insider",
                "badge": "1st-Degree Contact",
                "contact_name": c_name,
                "detail": f"Direct contact ({c_rel}).",
            })
            continue

        if matched_pid and matched_pid not in active_by_id:
            # Departed executive from an earlier snapshot! Find current leaders they overlapped with.
            appearances = historical_appearances[matched_pid]
            last_app = appearances[-1]
            dep_entity = last_app["entity"]
            overlapped_active = []
            for app_item in appearances:
                era = app_item["era"]
                me = app_item["entity"]
                for coworker in app_item["all_entities"]:
                    cw_id = coworker.get("id")
                    if not cw_id or cw_id == matched_pid or cw_id not in active_by_id:
                        continue
                    direct_link = (
                        me.get("manager_name_or_id") == cw_id
                        or coworker.get("manager_name_or_id") == matched_pid
                    )
                    same_dept = (
                        (me.get("department") or "").lower()
                        == (coworker.get("department") or "").lower()
                    )
                    relation_desc = (
                        "direct reporting line"
                        if direct_link
                        else ("department peer" if same_dept else "leadership cohort")
                    )
                    overlapped_active.append((
                        0 if direct_link else (1 if same_dept else 2),
                        cw_id,
                        active_by_id[cw_id].get("full_name"),
                        active_by_id[cw_id].get("job_title"),
                        era,
                        relation_desc,
                    ))

            # Deduplicate overlapped active leaders keeping strongest link
            overlapped_active.sort(key=lambda x: x[0])
            seen_cw: Set[str] = set()
            unique_overlaps = []
            for _, cw_id, cw_name, cw_title, era, rel_desc in overlapped_active:
                if cw_id in seen_cw:
                    continue
                seen_cw.add(cw_id)
                unique_overlaps.append({
                    "id": cw_id,
                    "full_name": cw_name,
                    "job_title": cw_title,
                    "era": era,
                    "overlap_type": rel_desc,
                })
                entity_connections[cw_id].append({
                    "type": "backchannel",
                    "badge": "Backchannel Ref",
                    "contact_name": c_name,
                    "detail": (
                        f"Overlapped with {c_name} (former {dep_entity.get('job_title')}) "
                        f"in {era} via {rel_desc}."
                    ),
                })

            # Also attach to departed node ID itself if user enables Show Departed
            entity_connections[matched_pid].append({
                "type": "insider",
                "badge": "Known Alumni",
                "contact_name": c_name,
                "detail": f"Departed {dep_entity.get('job_title')} in your network ({c_rel}).",
            })

            backchannels.append({
                "contact_name": c_name,
                "contact_role": c_role or f"Former {dep_entity.get('job_title')}",
                "relationship": c_rel,
                "departed_id": matched_pid,
                "last_era": last_app["era"],
                "overlapped_leaders": unique_overlaps[:5],
                "summary": (
                    f"Former {dep_entity.get('job_title')} ({last_app['era']}) — "
                    f"candid backchannel & warm intro bridge to {len(unique_overlaps)} active leader(s)."
                ),
            })
            continue

        # 2. Company-overlap match (former/current employee at the target company not on C-suite page)
        c_comp_tokens = _company_tokens(c_company)
        if target_org_tokens and (c_comp_tokens & target_org_tokens):
            # Match to functional leaders in same domain/department
            role_low = c_role.lower()
            matched_targets = []
            for act in active_entities:
                dept_low = (act.get("department") or "").lower()
                title_low = (act.get("job_title") or "").lower()
                is_dept_fit = (
                    ("engineer" in role_low or "infra" in role_low or "avionics" in role_low)
                    and ("engineer" in dept_low or "cto" in title_low)
                ) or (
                    ("product" in role_low or "pm" in role_low)
                    and ("product" in dept_low or "ai" in dept_low)
                ) or (
                    ("research" in role_low or "ai" in role_low)
                    and ("ai" in dept_low or "artificial" in dept_low)
                )
                if is_dept_fit:
                    matched_targets.append(act)

            if not matched_targets and active_entities:
                matched_targets = active_entities[:2]

            bridge_summaries = []
            for tgt in matched_targets[:3]:
                tid = tgt["id"]
                bridge_summaries.append({
                    "id": tid,
                    "full_name": tgt.get("full_name"),
                    "job_title": tgt.get("job_title"),
                })
                entity_connections[tid].append({
                    "type": "org_veteran",
                    "badge": "Org Overlap",
                    "contact_name": c_name,
                    "detail": f"{c_name} ({c_role}, {c_rel}) shares functional org history.",
                })

            org_veterans.append({
                "contact_name": c_name,
                "contact_company": c_company,
                "contact_role": c_role or "Operator",
                "relationship": c_rel,
                "connected_leaders": bridge_summaries,
                "summary": (
                    f"{c_role or 'Alumni'} at {c_company} ({c_rel}) — "
                    f"functional reference & warm bridge to {', '.join(b['full_name'] for b in bridge_summaries)}."
                ),
            })

    total_matches = len(insiders) + len(backchannels) + len(org_veterans)
    return {
        "contacts_analyzed": len(contacts),
        "total_matches": total_matches,
        "connected_entity_ids": sorted(entity_connections.keys()),
        "insiders": insiders,
        "backchannels": backchannels,
        "org_veterans": org_veterans,
        "entity_connections": dict(entity_connections),
    }


def simulate_key_person_departure(entities: List[dict], target_id: str) -> Optional[dict]:
    """Model the organizational blast radius and internal succession bench if `target_id` departs."""
    active = [e for e in entities if not e.get("_isDeparted") and not e.get("_isOpenRole")]
    by_id = {e["id"]: e for e in active if e.get("id")}
    if target_id not in by_id:
        return None

    target = by_id[target_id]
    reports_map = _compute_direct_reports(active)
    direct_ids = reports_map.get(target_id, [])

    # Traverse full downstream reporting subtree
    subtree_ids: List[str] = []
    visited: Set[str] = {target_id}
    queue = list(direct_ids)
    while queue:
        nid = queue.pop(0)
        if nid in visited or nid not in by_id:
            continue
        visited.add(nid)
        subtree_ids.append(nid)
        queue.extend(reports_map.get(nid, []))

    total_other = max(1, len(active) - 1)
    blast_pct = round((len(subtree_ids) / total_other) * 100) if len(active) > 1 else 0

    # Compute cascade flight-risk shock (+24 boss_departed shock on direct reports)
    orphaned_reports = []
    newly_critical_count = 0
    for did in direct_ids:
        rep = by_id[did]
        base_score = (rep.get("recruiting") or {}).get("score", 24)
        shocked_score = min(95, base_score + 24)
        if base_score < 55 and shocked_score >= 55:
            newly_critical_count += 1
        orphaned_reports.append({
            "id": did,
            "full_name": rep.get("full_name"),
            "job_title": rep.get("job_title"),
            "base_score": base_score,
            "projected_score": shocked_score,
            "tipped_to_prime": base_score < 55 and shocked_score >= 55,
        })
    orphaned_reports.sort(key=lambda r: -r["projected_score"])

    # Single-point-of-failure skills held uniquely by departing person
    other_skills = {
        kw.strip().lower()
        for eid, ent in by_id.items()
        if eid != target_id
        for kw in (ent.get("expertise_keywords") or [])
    }
    unique_capabilities = [
        kw for kw in (target.get("expertise_keywords") or [])
        if kw.strip().lower() not in other_skills
    ]

    # Rank Internal Succession Bench (direct reports + functional peers)
    target_rank = seniority_rank(target.get("job_title"))
    target_dept = (target.get("department") or "").strip().lower()
    target_kws = {k.strip().lower() for k in (target.get("expertise_keywords") or [])}

    successors = []
    for cid, cand in by_id.items():
        if cid == target_id:
            continue
        c_rank = seniority_rank(cand.get("job_title"))
        # Do not suggest a higher-ranked boss (e.g. CEO) as a step-up successor for a VP
        if c_rank > target_rank and target.get("manager_name_or_id") == cid:
            continue
        is_direct = cid in direct_ids
        same_dept = target_dept and (cand.get("department") or "").strip().lower() == target_dept
        cand_kws = {k.strip().lower() for k in (cand.get("expertise_keywords") or [])}
        kw_overlap = len(target_kws & cand_kws)

        if not (is_direct or same_dept or kw_overlap > 0):
            continue

        readiness = 35
        reasons = []
        if is_direct:
            readiness += 28
            reasons.append("Direct deputy in reporting line")
        if same_dept:
            readiness += 18
            reasons.append(f"Functional continuity ({cand.get('department')})")
        if c_rank >= max(1, target_rank - 1):
            readiness += 14
            reasons.append("Adjacent seniority tier")
        if kw_overlap > 0:
            readiness += min(16, kw_overlap * 8)
            reasons.append(f"{kw_overlap} shared domain skill(s)")

        flight_score = (cand.get("recruiting") or {}).get("score", 24)
        if flight_score >= 60:
            readiness -= 10
            reasons.append("Retention incentive required")

        readiness = max(20, min(95, readiness))
        successors.append({
            "id": cid,
            "full_name": cand.get("full_name"),
            "job_title": cand.get("job_title"),
            "readiness_score": readiness,
            "readiness_label": "Ready Now" if readiness >= 72 else "Stretch Internal",
            "rationale": " · ".join(reasons[:3]),
        })

    successors.sort(key=lambda s: -s["readiness_score"])
    top_readiness = successors[0]["readiness_score"] if successors else 0

    if len(subtree_ids) >= 4 or blast_pct >= 40 or (target_rank >= 5 and top_readiness < 65):
        severity = "critical"
    elif len(direct_ids) >= 1 or unique_capabilities:
        severity = "high"
    else:
        severity = "moderate"

    recommendation = (
        f"Internal bench ready ({successors[0]['full_name']} at {top_readiness}% readiness); "
        f"lock in {len(orphaned_reports)} orphaned report(s) within 30 days."
        if top_readiness >= 72
        else (
            f"Thin internal bench (best internal match {top_readiness}% readiness) — "
            f"launch external retained search for {target.get('job_title')} immediately."
        )
    )

    return {
        "target_id": target_id,
        "target_name": target.get("full_name"),
        "target_title": target.get("job_title"),
        "severity": severity,
        "direct_reports_orphaned": len(direct_ids),
        "subtree_exposed_count": len(subtree_ids),
        "blast_radius_pct": blast_pct,
        "newly_critical_flight_risks": newly_critical_count,
        "affected_node_ids": [target_id] + subtree_ids,
        "orphaned_reports": orphaned_reports,
        "unique_capabilities_at_risk": unique_capabilities[:4],
        "succession_bench": successors[:3],
        "recommendation": recommendation,
    }

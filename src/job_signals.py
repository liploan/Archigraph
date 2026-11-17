"""Public Job-Board Signal Ingestion & Reporting-Line Fusion (Greenhouse / Lever / Ashby).

Extracts forward-looking hiring velocity, open executive seats, strategic roadmap keywords,
and explicit reporting-line clues ("reports directly to the CTO") from job postings, then
links open roles directly underneath their hiring managers in the organizational graph.
"""
import html
import re
from collections import Counter
from typing import Dict, List, Optional, Tuple
from urllib.parse import urlparse

from src.diff_engine import normalize_name, seniority_rank
from src.security import UnsafeURLError, safe_get, validate_public_url


# Regex patterns capturing explicit reporting lines inside job descriptions
REPORTING_PATTERNS: List[re.Pattern] = [
    re.compile(
        r"(?:report(?:s|ing)?\s+(?:directly\s+)?(?:to|into)|work(?:ing)?\s+directly\s+under)\s+"
        r"(?:our\s+|the\s+)?([\w/&,\-'\s]{2,60}?)(?:[.,;|\n]|\s+(?:you\s+will|to\s+lead|to\s+build|to\s+scale|to\s+accelerate|and\s+will|who\s+|in\s+this))",
        re.I,
    ),
    re.compile(
        r"this\s+(?:role|position)\s+reports\s+(?:directly\s+)?(?:to|into)\s+(?:our\s+|the\s+)?"
        r"([\w/&,\-'\s]{2,60}?)(?:[.,;|\n]|$)",
        re.I,
    ),
]

# Strategic technical / GTM capability terms to detect product roadmap inflections in JDs
ROADMAP_VOCAB: List[Tuple[str, re.Pattern]] = [
    ("AI Agents", re.compile(r"\bagentic|ai\s+agents?|autonomous\s+agents?\b", re.I)),
    ("CUDA / Custom Kernels", re.compile(r"\bcuda|triton\s+kernels?|gpu\s+clusters?\b", re.I)),
    ("Multi-Tenant Sandboxes", re.compile(r"\bsandbox(?:es|ing)?|microvms?|firecracker\b", re.I)),
    ("Enterprise RBAC & SSO", re.compile(r"\brbac|saml|sso|enterprise\s+governance|soc\s*2\b", re.I)),
    ("FedRAMP / Sovereign Cloud", re.compile(r"\bfedramp|il5|il6|air-?gapped|sovereign\b", re.I)),
    ("Multimodal Foundation Models", re.compile(r"\bmultimodal|vision-language|audio\s+generation\b", re.I)),
    ("Custom Silicon / ASIC", re.compile(r"\basic|silicon|fpga|chip\s+tapeout\b", re.I)),
    ("Orbital / Propulsion Hardware", re.compile(r"\bpropulsion|thrusters?|orbital\s+transfer|avionics|starship|direct-to-cell\b", re.I)),
    ("PLG & Enterprise Monetization", re.compile(r"\bmonetization|usage-based\s+billing|enterprise\s+gtm|arr\b", re.I)),
    ("RAG & Ontology Graphs", re.compile(r"\bontology|knowledge\s+graph|rag\b", re.I)),
]


def _strip_html(raw: str) -> str:
    if not raw:
        return ""
    unescaped = html.unescape(raw)
    cleaned = re.sub(r"<[^>]+>", " ", unescaped)
    return re.sub(r"\s+", " ", cleaned).strip()


def parse_reporting_line_from_text(description: str) -> Tuple[Optional[str], Optional[str]]:
    """Extract (reports_to_role_or_name, verbatim_evidence_snippet) from JD prose."""
    if not description:
        return None, None
    clean = _strip_html(description)
    for pattern in REPORTING_PATTERNS:
        match = pattern.search(clean)
        if match:
            target_raw = match.group(1).strip(" .,-—:")
            # Guard against overly generic captures
            if len(target_raw) < 2 or len(target_raw.split()) > 9:
                continue
            start = max(0, match.start() - 20)
            end = min(len(clean), match.end() + 45)
            snippet = clean[start:end].strip()
            if start > 0:
                snippet = "…" + snippet
            if end < len(clean):
                snippet = snippet + "…"
            return target_raw, snippet
    return None, None


def extract_roadmap_keywords_from_text(text: str) -> List[str]:
    """Identify strategic product/architecture signals mentioned in job descriptions."""
    if not text:
        return []
    found = []
    for label, pattern in ROADMAP_VOCAB:
        if pattern.search(text):
            found.append(label)
    return found


def detect_ats_endpoint(url_or_slug: str) -> Optional[Tuple[str, str, str]]:
    """Resolve a job board URL into (provider, board_slug, json_api_url)."""
    if not url_or_slug:
        return None
    raw = url_or_slug.strip()
    parsed = urlparse(raw if "://" in raw else f"https://{raw}")
    host = (parsed.hostname or "").lower()
    parts = [p for p in parsed.path.split("/") if p]

    if "greenhouse.io" in host and parts:
        # Handle boards.greenhouse.io/<slug> or boards-api.greenhouse.io/v1/boards/<slug>/jobs
        if "boards" in parts and len(parts) >= parts.index("boards") + 2:
            slug = parts[parts.index("boards") + 1]
        else:
            slug = parts[0]
        api_url = f"https://boards-api.greenhouse.io/v1/boards/{slug}/jobs?content=true"
        return ("Greenhouse", slug, api_url)

    if "lever.co" in host and parts:
        slug = parts[-1] if "postings" in parts else parts[0]
        api_url = f"https://api.lever.co/v0/postings/{slug}?mode=json"
        return ("Lever", slug, api_url)

    if "ashbyhq.com" in host and parts:
        slug = parts[-1] if "job-board" in parts else parts[0]
        api_url = f"https://api.ashbyhq.com/posting-api/job-board/{slug}"
        return ("Ashby", slug, api_url)

    return None


def fetch_public_ats_jobs(ats_url: str, max_jobs: int = 40) -> Tuple[str, List[dict]]:
    """Fetch and normalize public job postings from Greenhouse, Lever, or Ashby."""
    detected = detect_ats_endpoint(ats_url)
    if not detected:
        raise ValueError(
            "Unsupported job board URL. Provide a public Greenhouse, Lever, or Ashby board URL."
        )
    provider, _, api_url = detected
    validated = validate_public_url(api_url)
    resp = safe_get(validated, headers={"Accept": "application/json"}, timeout=15)
    if resp.status_code != 200:
        raise RuntimeError(f"{provider} board returned HTTP {resp.status_code}.")

    payload = resp.json()
    normalized: List[dict] = []

    if provider == "Greenhouse":
        jobs = payload.get("jobs") if isinstance(payload, dict) else []
        for j in (jobs or [])[:max_jobs]:
            depts = j.get("departments") or []
            dept_name = depts[0].get("name") if depts and isinstance(depts[0], dict) else "General"
            loc = (j.get("location") or {}).get("name") or "Remote / Hybrid"
            desc = _strip_html(j.get("content") or "")
            normalized.append({
                "id": f"gh-{j.get('id')}",
                "title": j.get("title") or "Open Role",
                "department": dept_name or "General",
                "location": loc,
                "ats_source": "Greenhouse",
                "url": j.get("absolute_url") or "",
                "description": desc[:1500],
            })

    elif provider == "Lever":
        jobs = payload if isinstance(payload, list) else []
        for j in jobs[:max_jobs]:
            cats = j.get("categories") or {}
            dept_name = cats.get("department") or cats.get("team") or "General"
            loc = cats.get("location") or "Remote / Hybrid"
            desc = j.get("descriptionPlain") or _strip_html(j.get("description") or "")
            normalized.append({
                "id": f"lv-{j.get('id')}",
                "title": j.get("text") or "Open Role",
                "department": dept_name,
                "location": loc,
                "ats_source": "Lever",
                "url": j.get("hostedUrl") or "",
                "description": desc[:1500],
            })

    elif provider == "Ashby":
        jobs = payload.get("jobs") if isinstance(payload, dict) else []
        for j in (jobs or [])[:max_jobs]:
            dept_name = j.get("department") or j.get("team") or "General"
            loc = j.get("location") or "Remote / Hybrid"
            desc = j.get("descriptionPlain") or _strip_html(j.get("descriptionHtml") or "")
            normalized.append({
                "id": f"ash-{j.get('id')}",
                "title": j.get("title") or "Open Role",
                "department": dept_name,
                "location": loc,
                "ats_source": "Ashby",
                "url": j.get("jobUrl") or "",
                "description": desc[:1500],
            })

    return provider, normalized


TITLE_ALIAS_PATTERNS: List[Tuple[re.Pattern, re.Pattern]] = [
    (re.compile(r"\bcto\b|chief\s+technology\s+officer", re.I), re.compile(r"\bcto\b|chief\s+technology", re.I)),
    (re.compile(r"\bceo\b|chief\s+executive\s+officer", re.I), re.compile(r"\bceo\b|chief\s+executive", re.I)),
    (re.compile(r"\bcoo\b|chief\s+operating\s+officer", re.I), re.compile(r"\bcoo\b|chief\s+operating", re.I)),
    (re.compile(r"\bcpo\b|chief\s+product\s+officer", re.I), re.compile(r"\bcpo\b|chief\s+product", re.I)),
    (re.compile(r"\bpresident\b", re.I), re.compile(r"\bpresident\b", re.I)),
    (re.compile(r"\bchief\s+ai\s+scientist\b", re.I), re.compile(r"\bchief\s+ai\s+scientist\b", re.I)),
]


def _resolve_hiring_manager(
    posting: dict,
    active_entities: List[dict],
    explicit_hint: Optional[str],
) -> Tuple[Optional[dict], str]:
    """Match an open job posting to its most likely hiring manager in `active_entities`."""
    if not active_entities:
        return None, "none"

    hint = explicit_hint or posting.get("reports_to_hint") or ""
    if hint:
        hint_norm = normalize_name(hint)
        # 1. Direct person name match inside the hint (e.g. "CTO Luis Héctor Chávez")
        for ent in active_entities:
            ename = normalize_name(ent.get("full_name", ""))
            if ename and ename in hint_norm:
                return ent, "explicit"

        # 2. C-suite / executive title alias match
        for hint_pat, ent_pat in TITLE_ALIAS_PATTERNS:
            if hint_pat.search(hint):
                for ent in active_entities:
                    if ent_pat.search(ent.get("job_title") or ""):
                        return ent, "explicit"

        # 3. Substring / token overlap on specific leadership titles (e.g. "VP of Starship Engineering")
        hint_tokens = {
            t for t in re.findall(r"[a-z0-9]+", hint.lower())
            if len(t) >= 3 and t not in {"the", "our", "and", "for", "head", "vice"}
        }
        best_ent = None
        best_overlap = 0
        for ent in active_entities:
            etitle = (ent.get("job_title") or "").lower()
            etokens = set(re.findall(r"[a-z0-9]+", etitle))
            overlap = len(hint_tokens & etokens)
            if overlap >= 2 and overlap > best_overlap:
                best_overlap = overlap
                best_ent = ent
        if best_ent:
            return best_ent, "explicit"

    # 4. Department head fallback (highest seniority active person in matching department)
    job_dept = (posting.get("department") or "").strip().lower()
    if job_dept:
        dept_candidates = [
            e for e in active_entities
            if job_dept in (e.get("department") or "").lower()
            or (e.get("department") or "").lower() in job_dept
        ]
        if dept_candidates:
            dept_candidates.sort(key=lambda e: -seniority_rank(e.get("job_title")))
            return dept_candidates[0], "inferred"

    # 5. Root executive fallback for VP/C-level roles
    roots = [e for e in active_entities if not e.get("manager_name_or_id")]
    if roots:
        return roots[0], "inferred"
    return active_entities[0], "inferred"


def enrich_job_postings_for_snapshot(
    postings: List[dict],
    active_entities: List[dict],
    org_name: str = "",
) -> dict:
    """Fuse job postings with an active org snapshot to produce VC & Recruiting hiring signals."""
    if not postings:
        return {
            "total_open_roles": 0,
            "executive_open_roles": 0,
            "ats_provider": None,
            "department_velocity": [],
            "roadmap_keywords": [],
            "postings": [],
            "graph_open_nodes": [],
        }

    total_active = max(1, len(active_entities))
    org_dept_counts = Counter((e.get("department") or "Other").strip() for e in active_entities)

    enriched_postings = []
    graph_open_nodes = []
    dept_open_counts: Counter = Counter()
    roadmap_counter: Counter = Counter()
    ats_providers: Counter = Counter()

    for idx, raw_p in enumerate(postings):
        title = (raw_p.get("title") or "Open Role").strip()
        dept = (raw_p.get("department") or "Engineering").strip()
        location = (raw_p.get("location") or "Remote / Hybrid").strip()
        desc = (raw_p.get("description") or "").strip()
        ats = (raw_p.get("ats_source") or "Public Job Board").strip()
        ats_providers[ats] += 1

        parsed_hint, parsed_quote = parse_reporting_line_from_text(desc)
        hint = parsed_hint or raw_p.get("reports_to_hint")
        evidence_quote = (
            parsed_quote
            or raw_p.get("reporting_evidence")
            or f"Inferred from {dept} functional leadership on {ats} job board."
        )

        mgr_ent, conf = _resolve_hiring_manager(raw_p, active_entities, hint)
        mgr_id = mgr_ent["id"] if mgr_ent else None
        mgr_name = mgr_ent.get("full_name") if mgr_ent else (hint or "Executive Leadership")

        rank = seniority_rank(title)
        kw_hits = extract_roadmap_keywords_from_text(f"{title} {dept} {desc}")
        for kw in kw_hits:
            roadmap_counter[kw] += 1

        dept_open_counts[dept] += 1
        pid = raw_p.get("id") or f"open-role-{idx + 1}"
        safe_id = f"open-{re.sub(r'[^a-z0-9-]+', '-', pid.lower()).strip('-')}"

        posting_record = {
            "id": safe_id,
            "title": title,
            "department": dept,
            "location": location,
            "ats_source": ats,
            "url": raw_p.get("url") or "",
            "seniority_rank": rank,
            "is_leadership_search": rank >= 3,
            "hiring_manager_id": mgr_id,
            "hiring_manager_name": mgr_name,
            "reporting_confidence": conf,
            "reporting_evidence": evidence_quote,
            "roadmap_keywords": kw_hits,
            "description_excerpt": _strip_html(desc)[:280],
        }
        enriched_postings.append(posting_record)

        # Create a graph-compatible virtual node so D3 Tree & Mesh can render open seats directly
        graph_open_nodes.append({
            "id": safe_id,
            "full_name": f"OPEN: {title}",
            "job_title": f"Hiring · {location}",
            "department": dept,
            "manager_name_or_id": mgr_id,
            "reporting_confidence": conf,
            "reporting_evidence": f"[{ats} JD] {evidence_quote}",
            "expertise_keywords": kw_hits or [dept],
            "bio_summary": _strip_html(desc)[:260] or f"Active {ats} requisition in {dept}.",
            "_isOpenRole": True,
            "_atsSource": ats,
            "_jobUrl": raw_p.get("url") or "",
            "_roleTitle": title,
            "_isLeadershipSearch": rank >= 3,
        })

    # Sort postings: senior leadership searches & explicit reporting lines first
    enriched_postings.sort(
        key=lambda p: (
            -p["seniority_rank"],
            0 if p["reporting_confidence"] == "explicit" else 1,
            p["title"],
        )
    )

    total_open = len(enriched_postings)
    exec_open = sum(1 for p in enriched_postings if p["is_leadership_search"])

    dept_velocity = []
    for dept, open_cnt in dept_open_counts.most_common():
        hiring_share = round((open_cnt / max(1, total_open)) * 100, 1)
        # Match case-insensitively against active org departments
        existing_cnt = sum(
            cnt for d_name, cnt in org_dept_counts.items()
            if d_name.lower() == dept.lower()
        )
        org_share = round((existing_cnt / total_active) * 100, 1)
        multiplier = round(hiring_share / max(8.0, org_share), 1)
        if multiplier >= 1.6 and open_cnt >= 2:
            signal = f"{multiplier}x Expansion Surge"
        elif existing_cnt == 0:
            signal = "New Function Buildout"
        else:
            signal = "Steady Backfill / Scale"
        dept_velocity.append({
            "department": dept,
            "open_roles": open_cnt,
            "hiring_share_pct": hiring_share,
            "org_share_pct": org_share,
            "velocity_multiplier": multiplier,
            "signal": signal,
        })

    top_provider = ats_providers.most_common(1)[0][0] if ats_providers else "Public Job Board"
    top_roadmap = [kw for kw, _ in roadmap_counter.most_common(6)]

    return {
        "organization_name": org_name,
        "total_open_roles": total_open,
        "executive_open_roles": exec_open,
        "ats_provider": top_provider,
        "department_velocity": dept_velocity,
        "roadmap_keywords": top_roadmap,
        "postings": enriched_postings,
        "graph_open_nodes": graph_open_nodes,
    }

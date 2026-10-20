"""Cross-snapshot entity resolution, temporal diff calculation, and warm-path finding."""
import re
import unicodedata
from collections import deque
from copy import deepcopy
from typing import Dict, List, Optional, Tuple


# Seniority tiers used to distinguish promotions from lateral moves.
# Higher number = higher organizational seniority.
SENIORITY_PATTERNS: List[Tuple[int, re.Pattern]] = [
    (7, re.compile(r"\b(ceo|chief\s+executive\s+officer)\b", re.I)),
    (6, re.compile(r"\b(president|coo|cfo|cto|cpo|cio|chief\s+\w+\s+officer|co-?founder|founder)\b", re.I)),
    (5, re.compile(r"\b(evp|executive\s+vice\s+president|svp|senior\s+vice\s+president)\b", re.I)),
    (4, re.compile(r"\b(vp|vice\s+president|head\s+of)\b", re.I)),
    (3, re.compile(r"\b(senior\s+director|director|principal)\b", re.I)),
    (2, re.compile(r"\b(senior\s+product\s+manager|senior\s+manager|lead|staff|manager)\b", re.I)),
    (1, re.compile(r"\b(product\s+manager|pm|engineer|scientist|designer|analyst)\b", re.I)),
]


def normalize_name(name: str) -> str:
    """Normalize a person's name for cross-snapshot matching (strip accents, nicknames, punctuation)."""
    if not name:
        return ""
    # Strip parenthetical or quoted nicknames, e.g. 'Andrew "Boz" Bosworth' -> 'Andrew Bosworth'
    cleaned = re.sub(r'\([^)]*\)|"[^"]*"|\'[^\']*\'', " ", name)
    # Decompose unicode accents (e.g. 'Héctor' -> 'Hector')
    decomposed = unicodedata.normalize("NFKD", cleaned)
    ascii_only = "".join(ch for ch in decomposed if not unicodedata.combining(ch))
    tokens = re.findall(r"[a-z0-9]+", ascii_only.lower())
    return " ".join(tokens)


def slugify_name(name: str) -> str:
    """Return a canonical hyphenated slug from a normalized name."""
    norm = normalize_name(name)
    return norm.replace(" ", "-") if norm else "unknown"


def seniority_rank(job_title: Optional[str]) -> int:
    """Estimate a numeric seniority rank (0..7) from a job title string."""
    if not job_title:
        return 0
    for rank, pattern in SENIORITY_PATTERNS:
        if pattern.search(job_title):
            return rank
    return 1


def _names_matchFuzzy(norm_a: str, norm_b: str) -> bool:
    """Check whether two normalized names likely refer to the same person (e.g. Jon Smith vs Jonathan Smith)."""
    if not norm_a or not norm_b:
        return False
    if norm_a == norm_b:
        return True
    parts_a = norm_a.split()
    parts_b = norm_b.split()
    if len(parts_a) < 2 or len(parts_b) < 2:
        return False
    # Last name must match
    if parts_a[-1] != parts_b[-1]:
        return False
    first_a, first_b = parts_a[0], parts_b[0]
    # Prefix match on first name (e.g. 'jon' vs 'jonathan', 'dan' vs 'daniel')
    if len(first_a) >= 3 and len(first_b) >= 3:
        if first_a.startswith(first_b) or first_b.startswith(first_a):
            return True
    # Initial match when middle/last tokens align (e.g. 'j smith' vs 'john smith')
    if (len(first_a) == 1 or len(first_b) == 1) and first_a[0] == first_b[0]:
        return True
    return False


def resolve_entities_across_snapshots(snapshots: List[dict]) -> List[dict]:
    """Unify person IDs and manager references across chronological snapshots.

    Returns a deep copy of snapshots where the same person keeps a consistent canonical `id`
    even if their slug or name spelling varied across snapshots.
    """
    resolved = deepcopy(snapshots)
    # Registry of canonical entities: canonical_id -> {"norm_name": str, "aliases": set, "raw_ids": set}
    registry: Dict[str, dict] = {}

    def find_canonical_id(raw_id: str, full_name: str) -> str:
        norm = normalize_name(full_name)
        norm_slug = norm.replace(" ", "-")

        # 1. Exact ID or alias match
        if raw_id in registry:
            return raw_id
        for cid, info in registry.items():
            if raw_id in info["raw_ids"] or norm in info["aliases"] or norm_slug == cid:
                return cid

        # 2. Fuzzy name match (same last name + prefix/initial first name)
        for cid, info in registry.items():
            if _names_matchFuzzy(norm, info["norm_name"]):
                return cid

        # 3. Register new canonical entity
        cid = raw_id or norm_slug or "unknown"
        registry[cid] = {
            "norm_name": norm,
            "full_name": full_name,
            "aliases": {norm} if norm else set(),
            "raw_ids": {raw_id} if raw_id else set(),
        }
        return cid

    for snap in resolved:
        local_id_map: Dict[str, str] = {}
        entities = snap.get("entities", [])

        for entity in entities:
            raw_id = entity.get("id", "")
            full_name = entity.get("full_name", "")
            cid = find_canonical_id(raw_id, full_name)
            info = registry[cid]
            if raw_id:
                info["raw_ids"].add(raw_id)
                local_id_map[raw_id.lower()] = cid
            norm = normalize_name(full_name)
            if norm:
                info["aliases"].add(norm)
                local_id_map[norm] = cid
            if full_name:
                local_id_map[full_name.lower()] = cid

            if raw_id and raw_id != cid:
                entity["previous_slug"] = raw_id
            entity["id"] = cid

        # Resolve manager_name_or_id references to canonical IDs where possible
        for entity in entities:
            mgr = entity.get("manager_name_or_id")
            if not mgr:
                continue
            mgr_low = mgr.lower().strip()
            mgr_norm = normalize_name(mgr)
            if mgr_low in local_id_map:
                entity["manager_name_or_id"] = local_id_map[mgr_low]
            elif mgr_norm in local_id_map:
                entity["manager_name_or_id"] = local_id_map[mgr_norm]
            else:
                # Check global registry
                for cid, info in registry.items():
                    if mgr_low in info["raw_ids"] or mgr_norm in info["aliases"] or _names_matchFuzzy(mgr_norm, info["norm_name"]):
                        entity["manager_name_or_id"] = cid
                        break

    return resolved


def _is_promotion(prev_entity: dict, curr_entity: dict) -> bool:
    """Determine if a role change between two snapshots represents a promotion."""
    prev_title = prev_entity.get("job_title") or ""
    curr_title = curr_entity.get("job_title") or ""
    if prev_title.strip().lower() == curr_title.strip().lower():
        return False

    prev_rank = seniority_rank(prev_title)
    curr_rank = seniority_rank(curr_title)
    if curr_rank > prev_rank:
        return True

    # Same tier but promoted to top root (e.g., CEO of Google -> sole CEO of Alphabet)
    if prev_entity.get("manager_name_or_id") and not curr_entity.get("manager_name_or_id") and curr_rank >= 6:
        return True

    return False


def enrich_snapshots_with_diffs(snapshots: List[dict]) -> List[dict]:
    """Resolve entities across snapshots and compute temporal diffs between consecutive snapshots."""
    if not snapshots:
        return []

    resolved = resolve_entities_across_snapshots(snapshots)

    for idx, snap in enumerate(resolved):
        entities = snap.get("entities", [])
        # Ensure every entity has reporting_confidence & reporting_evidence defaults
        for e in entities:
            if not e.get("reporting_confidence"):
                e["reporting_confidence"] = "none" if not e.get("manager_name_or_id") else "inferred"
            if not e.get("reporting_evidence"):
                if not e.get("manager_name_or_id"):
                    e["reporting_evidence"] = "Top-level executive / root node in snapshot."
                else:
                    e["reporting_evidence"] = "Inferred from organizational hierarchy and title tier."

        if idx == 0:
            for e in entities:
                e["diff"] = {
                    "status": "baseline",
                    "summary": "Initial baseline snapshot",
                }
            snap["diff_summary"] = None
            continue

        prev_snap = resolved[idx - 1]
        prev_map = {e["id"]: e for e in prev_snap.get("entities", [])}
        curr_map = {e["id"]: e for e in entities}

        joined_list = []
        promoted_list = []
        moved_list = []
        departed_list = []
        unchanged_count = 0

        for e in entities:
            eid = e["id"]
            if eid not in prev_map:
                e["diff"] = {
                    "status": "joined",
                    "summary": f"Joined as {e.get('job_title', 'Team Member')}",
                }
                joined_list.append({
                    "id": eid,
                    "full_name": e.get("full_name"),
                    "job_title": e.get("job_title"),
                    "department": e.get("department"),
                    "summary": e["diff"]["summary"],
                })
                continue

            prev_e = prev_map[eid]
            prev_title = prev_e.get("job_title") or ""
            curr_title = e.get("job_title") or ""
            prev_dept = prev_e.get("department") or ""
            curr_dept = e.get("department") or ""
            prev_mgr = prev_e.get("manager_name_or_id") or None
            curr_mgr = e.get("manager_name_or_id") or None

            title_changed = prev_title.strip().lower() != curr_title.strip().lower()
            dept_changed = prev_dept.strip().lower() != curr_dept.strip().lower()
            mgr_changed = prev_mgr != curr_mgr

            if _is_promotion(prev_e, e):
                summary = f"Promoted from {prev_title} to {curr_title}"
                e["diff"] = {
                    "status": "promoted",
                    "previous_title": prev_title,
                    "previous_department": prev_dept,
                    "previous_manager": prev_mgr,
                    "summary": summary,
                }
                promoted_list.append({
                    "id": eid,
                    "full_name": e.get("full_name"),
                    "previous_title": prev_title,
                    "job_title": curr_title,
                    "previous_manager": prev_mgr,
                    "manager_name_or_id": curr_mgr,
                    "summary": summary,
                })
            elif title_changed or dept_changed or mgr_changed:
                parts = []
                if title_changed:
                    parts.append(f"Role: {prev_title} → {curr_title}")
                if mgr_changed:
                    parts.append(f"Reports to: {prev_mgr or 'None'} → {curr_mgr or 'None'}")
                if dept_changed:
                    parts.append(f"Dept: {prev_dept or 'None'} → {curr_dept or 'None'}")
                summary = " · ".join(parts)
                e["diff"] = {
                    "status": "moved",
                    "previous_title": prev_title,
                    "previous_department": prev_dept,
                    "previous_manager": prev_mgr,
                    "summary": summary,
                }
                moved_list.append({
                    "id": eid,
                    "full_name": e.get("full_name"),
                    "previous_title": prev_title,
                    "job_title": curr_title,
                    "previous_manager": prev_mgr,
                    "manager_name_or_id": curr_mgr,
                    "summary": summary,
                })
            else:
                e["diff"] = {
                    "status": "unchanged",
                    "summary": "No structural change since previous snapshot",
                }
                unchanged_count += 1

        for prev_id, prev_e in prev_map.items():
            if prev_id not in curr_map:
                departed_list.append({
                    "id": prev_id,
                    "full_name": prev_e.get("full_name"),
                    "job_title": prev_e.get("job_title"),
                    "department": prev_e.get("department"),
                    "manager_name_or_id": prev_e.get("manager_name_or_id"),
                    "expertise_keywords": prev_e.get("expertise_keywords", []),
                    "bio_summary": prev_e.get("bio_summary"),
                    "summary": f"Departed (was {prev_e.get('job_title', 'Team Member')})",
                })

        snap["diff_summary"] = {
            "compared_to_timestamp": prev_snap.get("snapshot_timestamp"),
            "counts": {
                "joined": len(joined_list),
                "promoted": len(promoted_list),
                "moved": len(moved_list),
                "departed": len(departed_list),
                "unchanged": unchanged_count,
            },
            "joined": joined_list,
            "promoted": promoted_list,
            "moved": moved_list,
            "departed": departed_list,
        }

    return resolved


def find_warm_path(entities: List[dict], source_id: str, target_id: str) -> Optional[dict]:
    """Find the shortest relationship path between two people in a snapshot.

    Considers formal reporting lines (priority 1) and shared expertise keywords (priority 2).
    """
    by_id = {e["id"]: e for e in entities}
    if source_id not in by_id or target_id not in by_id:
        return None
    if source_id == target_id:
        return {
            "source_id": source_id,
            "target_id": target_id,
            "node_ids": [source_id],
            "hops": [],
            "steps": [
                {
                    "id": source_id,
                    "full_name": by_id[source_id]["full_name"],
                    "job_title": by_id[source_id].get("job_title", ""),
                    "edge_label": None,
                    "edge_type": None,
                }
            ],
        }

    # Build adjacency list: node_id -> list of (neighbor_id, relation_type, relation_label)
    adj: Dict[str, List[Tuple[str, str, str]]] = {eid: [] for eid in by_id}

    # 1. Formal reporting edges (highest priority in BFS)
    for e in entities:
        eid = e["id"]
        mgr = e.get("manager_name_or_id")
        if mgr and mgr in by_id and mgr != eid:
            adj[eid].append((mgr, "reporting", f"Reports to {by_id[mgr]['full_name']}"))
            adj[mgr].append((eid, "reporting", f"Manages {e['full_name']}"))

    # 2. Shared expertise bridges
    elist = list(entities)
    for i in range(len(elist)):
        skills_i = {s.lower(): s for s in elist[i].get("expertise_keywords", [])}
        if not skills_i:
            continue
        for j in range(i + 1, len(elist)):
            skills_j = {s.lower(): s for s in elist[j].get("expertise_keywords", [])}
            shared = sorted(set(skills_i.keys()) & set(skills_j.keys()))
            if shared:
                u, v = elist[i]["id"], elist[j]["id"]
                label = f"Shared expertise: {skills_i[shared[0]]}"
                adj[u].append((v, "expertise", label))
                adj[v].append((u, "expertise", label))

    # 3. Shared department fallback bridges
    for i in range(len(elist)):
        dept_i = (elist[i].get("department") or "").strip()
        if not dept_i:
            continue
        for j in range(i + 1, len(elist)):
            dept_j = (elist[j].get("department") or "").strip()
            if dept_i.lower() == dept_j.lower():
                u, v = elist[i]["id"], elist[j]["id"]
                adj[u].append((v, "department", f"Peer in {dept_i}"))
                adj[v].append((u, "department", f"Peer in {dept_i}"))

    # BFS for shortest path
    queue = deque([(source_id, [source_id], [])])
    visited = {source_id}

    while queue:
        curr, path_nodes, path_hops = queue.popleft()
        for nxt, rel_type, rel_label in adj.get(curr, []):
            if nxt in visited:
                continue
            new_nodes = path_nodes + [nxt]
            new_hops = path_hops + [{
                "from_id": curr,
                "from_name": by_id[curr]["full_name"],
                "to_id": nxt,
                "to_name": by_id[nxt]["full_name"],
                "type": rel_type,
                "label": rel_label,
            }]
            if nxt == target_id:
                steps = [
                    {
                        "id": nid,
                        "full_name": by_id[nid]["full_name"],
                        "job_title": by_id[nid].get("job_title", ""),
                        "edge_label": new_hops[idx - 1]["label"] if idx > 0 else None,
                        "edge_type": new_hops[idx - 1]["type"] if idx > 0 else None,
                    }
                    for idx, nid in enumerate(new_nodes)
                ]
                return {
                    "source_id": source_id,
                    "target_id": target_id,
                    "node_ids": new_nodes,
                    "hops": new_hops,
                    "steps": steps,
                }
            visited.add(nxt)
            queue.append((nxt, new_nodes, new_hops))

    return None

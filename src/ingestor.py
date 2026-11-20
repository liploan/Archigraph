import hashlib
import html as html_lib
import json
import re
import time
import urllib.parse
from pathlib import Path
from urllib.parse import urlparse, urljoin
try:
    import requests
except ImportError:
    requests = None

try:
    from bs4 import BeautifulSoup
except ImportError:
    BeautifulSoup = None
from src.config import CACHE_DIR
from src.security import safe_get, validate_public_url

DEFAULT_UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/115.0.0.0 Safari/537.36"
)


def resolve_team_page_url(url: str) -> str:
    """When given a bare domain root (e.g. https://darpa.mil), discover its leadership/team subpage."""
    parsed = urlparse(url)
    if parsed.path not in ("", "/"):
        return url
    try:
        resp = safe_get(url, headers={"User-Agent": DEFAULT_UA}, timeout=12)
        base_url = getattr(resp, "url", None) or url
        html = resp.content.decode(resp.encoding or "utf-8", errors="replace")
    except Exception:
        return url

    hrefs = set(re.findall(r'href=["\']([^"\'#?]+)["\']', html, re.I))
    preferred_paths = (
        "/about/people",
        "/about/leadership",
        "/about-us/people",
        "/about-us/leadership",
        "/leadership",
        "/team",
        "/our-team",
        "/people",
        "/about-us",
        "/about",
    )
    base_domain = get_domain(base_url)
    resolved_candidates = {}
    for raw_href in hrefs:
        full = urljoin(base_url, raw_href.strip())
        cand_parsed = urlparse(full)
        if cand_parsed.scheme not in ("http", "https"):
            continue
        if get_domain(full) != base_domain:
            continue
        norm_path = cand_parsed.path.rstrip("/").lower()
        if norm_path and norm_path not in resolved_candidates:
            resolved_candidates[norm_path] = full

    for pref in preferred_paths:
        if pref in resolved_candidates:
            try:
                return validate_public_url(resolved_candidates[pref])
            except Exception:
                continue
    return url


def _format_drupal_staff_rows(raw_rows: list) -> str:
    """Deduplicate Drupal /json/staff entries by nid and format leadership roles as structured text."""
    by_nid = {}
    for r in raw_rows:
        if not isinstance(r, dict):
            continue
        nid = str(r.get("nid") or r.get("title") or "")
        if not nid:
            continue
        cur = by_nid.setdefault(
            nid,
            {"title": "", "roles": [], "office": "", "topics": set(), "summary": ""},
        )
        name = html_lib.unescape(str(r.get("title") or "")).strip()
        if name and not cur["title"]:
            cur["title"] = name
        role = html_lib.unescape(str(r.get("field_role") or "")).strip()
        if role and role not in cur["roles"]:
            cur["roles"].append(role)
        office = html_lib.unescape(str(r.get("field_taxonomy_office") or "")).strip()
        if office and not cur["office"]:
            cur["office"] = office
        for t in html_lib.unescape(str(r.get("field_research_topics") or "")).split(","):
            t = t.strip()
            if t and t.lower() != "agency":
                cur["topics"].add(t)
        raw_sum = html_lib.unescape(
            str(r.get("summary_trimmed") or r.get("summary") or r.get("body") or "")
        )
        clean_sum = re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", raw_sum)).strip()
        if len(clean_sum) > len(cur["summary"]):
            cur["summary"] = clean_sum

    leadership_roles = {
        "Director",
        "Deputy Director",
        "Office Director",
        "Program Director",
        "Assistant Director Program Management",
    }
    lines = ["\n[H2] Organization Leadership & Office Directory"]
    for item in sorted(by_nid.values(), key=lambda x: (x["office"] or "00_Director's Office", x["title"])):
        primary_roles = [rl for rl in item["roles"] if rl != "People"] or item["roles"]
        role_str = primary_roles[0] if primary_roles else "Staff"
        sum_lower = item["summary"].lower()
        if role_str not in leadership_roles:
            if "director of the defense advanced research projects agency" in sum_lower or "director of darpa" in sum_lower:
                role_str = "Director"
            else:
                continue
        office_label = item["office"] or "Director's Office"
        lines.append(f"\n[H3] {item['title']} — {role_str} ({office_label})")
        if item["topics"]:
            lines.append(f"Expertise: {', '.join(sorted(item['topics'])[:7])}")
        if item["summary"]:
            lines.append(f"Bio: {item['summary'][:450]}")
    return "\n".join(lines) if len(lines) > 1 else ""


def _extract_origin_from_archive_or_live(fetch_url: str) -> str:
    wb_match = re.match(r"^https?://web\.archive\.org/web/\d+(?:id_)?/(https?://.+)$", fetch_url)
    target = wb_match.group(1) if wb_match else fetch_url
    p = urlparse(target)
    return f"{p.scheme}://{p.netloc}" if p.scheme and p.netloc else ""


def get_domain(url: str) -> str:
    """Extract normalized domain name (without leading www.) from a URL."""
    parsed = urlparse(url)
    domain = parsed.hostname or parsed.netloc or ""
    if domain.startswith("www."):
        domain = domain[4:]
    return domain


def build_cache_id(url: str, domain: str = "") -> str:
    """Cache key that includes the URL path, so /about and /careers never collide."""
    parsed = urlparse(url)
    resolved_domain = domain or get_domain(url)
    normalized = f"{parsed.hostname or parsed.netloc}{parsed.path.rstrip('/')}"
    digest = hashlib.sha1(normalized.encode("utf-8")).hexdigest()[:10]
    return f"{resolved_domain}-{digest}"


def select_evenly_spaced_snapshots(snapshots: list, limit: int) -> list:
    """Select up to `limit` snapshots evenly spaced across the chronological list.

    For limit == 1, returns the most recent snapshot.
    For limit >= 2, includes both the earliest and most recent snapshots and spaces
    any intermediate selections evenly across the timeline.
    """
    if limit <= 0 or not snapshots:
        return []
    n = len(snapshots)
    if n <= limit:
        return list(snapshots)
    if limit == 1:
        return [snapshots[-1]]

    chosen_indices = []
    seen = set()
    for i in range(limit):
        idx = round(i * (n - 1) / (limit - 1))
        if idx not in seen:
            seen.add(idx)
            chosen_indices.append(idx)
    return [snapshots[i] for i in chosen_indices]


def get_wayback_snapshots(url: str, limit: int = 10) -> list:
    """
    Queries the Wayback CDX API for snapshots of a given URL.
    Collapses by month (YYYYMM) so multi-year histories are covered, deduplicates by
    content digest, and samples evenly across the chronological timeline.
    Returns a list of dicts: [{'timestamp': '...', 'archive_url': '...', 'status': '200'}]
    """
    # Clean URL
    encoded_url = urllib.parse.quote(url)
    cdx_limit = max(limit * 20, 120)
    
    # Collapse to 1 capture per month (timestamp:6) and cap scan size at CDX server level
    cdx_url = (
        f"https://web.archive.org/cdx/search/cdx"
        f"?url={encoded_url}"
        f"&output=json"
        f"&fl=timestamp,original,statuscode,digest"
        f"&filter=statuscode:200"
        f"&filter=mimetype:text/html"
        f"&collapse=timestamp:6"
        f"&limit={cdx_limit}"
    )
    
    data = None
    try:
        # Increase timeout to 25 seconds for slow archive servers
        response = requests.get(cdx_url, timeout=25)
        response.raise_for_status()
        data = response.json()
    except Exception as e:
        print(f"Warning: CDX API query timed out or failed for {url} (will fall back to live site): {e}")
        
    snapshots = []
    
    if data and len(data) > 1:
        # The first row is headers: ['timestamp', 'original', 'statuscode', 'digest']
        headers = data[0]
        rows = data[1:]
        
        seen_digests = set()
        for row in rows:
            item = dict(zip(headers, row))
            
            # Deduplicate based on content digest to avoid downloading identical sequential pages
            digest = item.get("digest")
            if digest in seen_digests:
                continue
            seen_digests.add(digest)
            
            timestamp = item["timestamp"]
            original = item["original"]
            archive_url = f"https://web.archive.org/web/{timestamp}/{original}"
            
            snapshots.append({
                "timestamp": timestamp,
                "original_url": original,
                "archive_url": archive_url,
                "digest": digest
            })
            
        # Sort chronologically
        snapshots.sort(key=lambda x: x["timestamp"])
        
    # Fallback to the live site as a single snapshot if archive search yields nothing
    if not snapshots:
        print(f"No archive snapshots found. Falling back to the live page: {url}")
        snapshots.append({
            "timestamp": "current",
            "original_url": url,
            "archive_url": url,
            "digest": "live"
        })
        
    return select_evenly_spaced_snapshots(snapshots, limit)

def fetch_snapshot_html(archive_url: str, timestamp: str, domain: str) -> str:
    """
    Fetches the raw HTML from the archive URL or retrieves it from cache if available.
    """
    # Create a safe filename slug
    safe_domain = re.sub(r'[^a-zA-Z0-9]', '_', domain)
    cache_path = CACHE_DIR / f"{safe_domain}_{timestamp}.html"
    
    if cache_path.exists():
        print(f"Loading snapshot from cache: {cache_path.name}")
        return cache_path.read_text(encoding="utf-8")
        
    print(f"Fetching from archive: {archive_url}")
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/115.0.0.0 Safari/537.36"
        )
    }
    max_attempts = 3
    for attempt in range(1, max_attempts + 1):
        try:
            response = safe_get(archive_url, headers=headers, timeout=20)
            encoding = response.encoding
            if not encoding or encoding.lower() == "iso-8859-1":
                # requests defaults to ISO-8859-1 when no charset is declared, which
                # corrupts UTF-8 pages (accented names, etc.). Detect instead.
                encoding = response.apparent_encoding or "utf-8"
            html = response.content.decode(encoding, errors="replace").replace("\x00", "")

            # Enrich client-rendered Drupal staff directories (e.g. darpa.mil /json/staff)
            if ('id="react-peoples-table"' in html or 'id="react-leadership"' in html):
                origin = _extract_origin_from_archive_or_live(archive_url)
                if origin:
                    staff_url = (
                        f"https://web.archive.org/web/{timestamp}id_/{origin}/json/staff"
                        if timestamp != "current" and "web.archive.org" in archive_url
                        else f"{origin}/json/staff"
                    )
                    try:
                        s_resp = safe_get(staff_url, headers=headers, timeout=20)
                        s_rows = json.loads(s_resp.content.decode("utf-8", errors="replace"))
                        if isinstance(s_rows, list) and s_rows:
                            formatted = _format_drupal_staff_rows(s_rows)
                            if formatted:
                                html_block = "".join(
                                    f"<p>{html_lib.escape(ln)}</p>"
                                    for ln in formatted.splitlines()
                                    if ln.strip()
                                )
                                html = f"{html}\n<section class='staff-json-feed'>{html_block}</section>"
                    except Exception as json_err:
                        print(f"Optional /json/staff companion fetch skipped ({staff_url}): {json_err}")

            # Save to cache
            cache_path.write_text(html, encoding="utf-8")
            return html
        except Exception as e:
            status_code = getattr(getattr(e, "response", None), "status_code", None)
            transient = status_code in (429, 502, 503, 504) or "429" in str(e)
            if transient and attempt < max_attempts:
                delay = 1.5 * attempt
                print(f"Transient error ({status_code or e}) fetching {archive_url}; retrying in {delay:.1f}s...")
                time.sleep(delay)
                continue
            print(f"Failed to fetch snapshot {archive_url}: {e}")
            return ""
    return ""

def clean_html_content(raw_html: str) -> str:
    """
    Cleans raw HTML by stripping boilerplate (scripts, styles, footer, navigation, forms, svgs)
    and returning formatted text that maintains structural hierarchy (headings, list items, tables)
    suitable for LLM extraction.
    """
    if not raw_html:
        return ""

    stripped_raw = raw_html.lstrip()
    if stripped_raw.startswith("[") or stripped_raw.startswith("{"):
        try:
            parsed_json = json.loads(stripped_raw)
            if isinstance(parsed_json, list):
                formatted = _format_drupal_staff_rows(parsed_json)
                if formatted:
                    return formatted
        except Exception:
            pass
        
    soup = BeautifulSoup(raw_html, "lxml")
    
    # Strip unnecessary elements and injected Wayback Machine toolbar chrome
    for element in soup(["script", "style", "noscript", "iframe", "svg", "canvas", "header", "footer", "nav", "form", "aside"]):
        element.decompose()
    for wm_el in soup.find_all(id=re.compile(r"^(wm-ipp|donato)", re.I)):
        wm_el.decompose()
        
    # Also strip typical social sharing / newsletter widgets / modal overlays
    for class_keyword in ["newsletter", "social-share", "cookie-banner", "modal", "popup", "ad-container", "menu"]:
        for element in soup.find_all(class_=re.compile(class_keyword, re.I)):
            element.decompose()
        for element in soup.find_all(id=re.compile(class_keyword, re.I)):
            element.decompose()

    # Reconstruct clean structured representation of headings, lists, tables, paragraphs
    lines = []
    for element in soup.find_all(["h1", "h2", "h3", "h4", "h5", "h6", "p", "li", "tr"]):
        tag = element.name
        text = element.get_text(strip=True)
        if not text:
            continue
            
        if tag.startswith("h"):
            # Expose heading depth to the LLM
            lines.append(f"\n[{tag.upper()}] {text}")
        elif tag == "li":
            lines.append(f"- {text}")
        elif tag == "tr":
            # Formulate table row
            cols = [td.get_text(strip=True) for td in element.find_all(["td", "th"])]
            if any(cols):
                lines.append(" | ".join(cols))
        else:
            lines.append(text)
            
    # Combine and clean extra line breaks
    text_content = "\n".join(lines)
    text_content = re.sub(r'\n{3,}', '\n\n', text_content)
    return text_content.strip()

def delete_raw_snapshot(timestamp: str, domain: str):
    """Deletes a raw snapshot from disk to save space."""
    safe_domain = re.sub(r'[^a-zA-Z0-9]', '_', domain)
    cache_path = CACHE_DIR / f"{safe_domain}_{timestamp}.html"
    if cache_path.exists():
        try:
            cache_path.unlink()
            print(f"Removed raw HTML snapshot cache: {cache_path.name}")
        except Exception as e:
            print(f"Failed to remove raw snapshot {cache_path.name}: {e}")

import re
import urllib.parse
from pathlib import Path
import requests
from bs4 import BeautifulSoup
from src.config import CACHE_DIR

def get_wayback_snapshots(url: str, limit: int = 10) -> list:
    """
    Queries the Wayback CDX API for snapshots of a given URL.
    Returns a list of dicts: [{'timestamp': '...', 'archive_url': '...', 'status': '200'}]
    """
    # Clean URL
    encoded_url = urllib.parse.quote(url)
    
    # Restrict search limits at CDX server level to avoid scan timeouts on popular domains
    cdx_url = (
        f"https://web.archive.org/cdx/search/cdx"
        f"?url={encoded_url}"
        f"&output=json"
        f"&fl=timestamp,original,statuscode,digest"
        f"&filter=statuscode:200"
        f"&filter=mimetype:text/html"
        f"&limit={limit * 5}"
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
        
    return snapshots[:limit]

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
    try:
        # Standard user-agent header to prevent rate-limiting/blocking
        headers = {
            "User-Agent": (
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/115.0.0.0 Safari/537.36"
            )
        }
        response = requests.get(archive_url, headers=headers, timeout=20)
        response.raise_for_status()
        html = response.text
        
        # Save to cache
        cache_path.write_text(html, encoding="utf-8")
        return html
    except Exception as e:
        print(f"Failed to fetch snapshot {archive_url}: {e}")
        return ""

def clean_html_content(raw_html: str) -> str:
    """
    Cleans raw HTML by stripping boilerplate (scripts, styles, footer, navigation, forms, svgs)
    and returning formatted text that maintains structural hierarchy (headings, list items, tables)
    suitable for LLM extraction.
    """
    if not raw_html:
        return ""
        
    soup = BeautifulSoup(raw_html, "lxml")
    
    # Strip unnecessary elements
    for element in soup(["script", "style", "noscript", "iframe", "svg", "canvas", "header", "footer", "nav", "form", "aside"]):
        element.decompose()
        
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

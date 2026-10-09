"""Input validation and SSRF protection for user-supplied URLs."""
import ipaddress
import socket
from urllib.parse import urlparse, urljoin

import requests

MAX_REDIRECTS = 3
MAX_RESPONSE_BYTES = 5 * 1024 * 1024  # 5 MB cap on fetched pages


class UnsafeURLError(ValueError):
    """Raised when a URL is malformed or points somewhere we refuse to fetch."""


def _is_public_ip(ip_str: str) -> bool:
    ip = ipaddress.ip_address(ip_str)
    return not (
        ip.is_private
        or ip.is_loopback
        or ip.is_link_local
        or ip.is_multicast
        or ip.is_reserved
        or ip.is_unspecified
    )


def validate_public_url(url: str) -> str:
    """Return the URL if it is http(s) and every resolved address is public.

    Raises UnsafeURLError otherwise. Note: DNS can change between this check and
    the actual request (rebinding); safe_get re-validates on every redirect hop,
    which narrows but does not fully eliminate that window.
    """
    if not isinstance(url, str) or not url.strip() or len(url) > 2048:
        raise UnsafeURLError("A valid URL is required.")
    parsed = urlparse(url.strip())
    if parsed.scheme not in ("http", "https"):
        raise UnsafeURLError("Only http and https URLs are allowed.")
    if parsed.username or parsed.password:
        raise UnsafeURLError("URLs with embedded credentials are not allowed.")
    host = parsed.hostname
    if not host:
        raise UnsafeURLError("URL has no hostname.")
    try:
        infos = socket.getaddrinfo(host, parsed.port or (443 if parsed.scheme == "https" else 80))
    except socket.gaierror:
        raise UnsafeURLError("Hostname could not be resolved.")
    for info in infos:
        if not _is_public_ip(info[4][0]):
            raise UnsafeURLError("URL resolves to a non-public address.")
    return url.strip()


def safe_get(url: str, headers=None, timeout=20) -> requests.Response:
    """GET a URL, validating the target and every redirect hop, with a size cap."""
    current = validate_public_url(url)
    for _ in range(MAX_REDIRECTS + 1):
        resp = requests.get(
            current, headers=headers, timeout=timeout, allow_redirects=False, stream=True
        )
        if resp.is_redirect or resp.status_code in (301, 302, 303, 307, 308):
            location = resp.headers.get("Location")
            resp.close()
            if not location:
                raise UnsafeURLError("Redirect without a Location header.")
            current = validate_public_url(urljoin(current, location))
            continue
        resp.raise_for_status()
        body = bytearray()
        for chunk in resp.iter_content(chunk_size=65536):
            body.extend(chunk)
            if len(body) > MAX_RESPONSE_BYTES:
                resp.close()
                raise UnsafeURLError("Response too large.")
        resp._content = bytes(body)
        resp._content_consumed = True
        return resp
    raise UnsafeURLError("Too many redirects.")

import os
from pathlib import Path
from dotenv import load_dotenv

# Base paths
SRC_DIR = Path(__file__).resolve().parent
WORKSPACE_DIR = SRC_DIR.parent
CACHE_DIR = WORKSPACE_DIR / "data" / "raw_snapshots"
OUTPUT_DIR = WORKSPACE_DIR / "data" / "extracted_snapshots"
DEMO_DIR = WORKSPACE_DIR / "demo"

# Ensure directories exist
CACHE_DIR.mkdir(parents=True, exist_ok=True)
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# Load env file from workspace root or home folder
load_dotenv(WORKSPACE_DIR / ".env")
load_dotenv(Path.home() / ".env")

# API Keys & DB Credentials
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
NEO4J_URI = os.getenv("NEO4J_URI", "bolt://localhost:7687")
NEO4J_USER = os.getenv("NEO4J_USER", "neo4j")
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD", "password123")

# Disk Space Management
# If False, downloaded raw HTML files are deleted immediately after parsing to save space.
KEEP_RAW_SNAPSHOTS = os.getenv("KEEP_RAW_SNAPSHOTS", "false").lower() == "true"


def _env_bool(name: str, default: bool) -> bool:
    return os.getenv(name, str(default)).strip().lower() in ("1", "true", "yes", "on")


def _env_int(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, default))
    except (TypeError, ValueError):
        return default


# Hosting / Safety Controls
# Live extraction calls Gemini (costs money) and fetches third-party pages, so it is
# opt-in. Demos are always available and never touch the network or the API key.
ENABLE_LIVE_EXTRACTION = _env_bool("ENABLE_LIVE_EXTRACTION", False)
# If set, /api/extract requires this value in the X-Access-Token header.
ACCESS_TOKEN = os.getenv("ARCHIGRAPH_ACCESS_TOKEN") or None
# Hard ceiling on Gemini-backed snapshot extractions per UTC day (spend guard).
MAX_EXTRACTIONS_PER_DAY = _env_int("MAX_EXTRACTIONS_PER_DAY", 40)
# Maximum snapshots a single request may ask for.
MAX_SNAPSHOTS_PER_REQUEST = _env_int("MAX_SNAPSHOTS_PER_REQUEST", 5)
# Flask debug mode exposes an interactive debugger (remote code execution). Local only.
FLASK_DEBUG = _env_bool("FLASK_DEBUG", False)


def verify_credentials():
    """Verify that required API credentials are present."""
    if not GEMINI_API_KEY:
        raise ValueError(
            "GEMINI_API_KEY environment variable is not set.\n"
            "Please create a .env file containing GEMINI_API_KEY=<your_key> "
            "in the project root or home directory, or set it directly in the environment."
        )

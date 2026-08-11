import os
from pathlib import Path
from dotenv import load_dotenv

# Base paths
SRC_DIR = Path(__file__).resolve().parent
WORKSPACE_DIR = SRC_DIR.parent
CACHE_DIR = WORKSPACE_DIR / "data" / "raw_snapshots"
OUTPUT_DIR = WORKSPACE_DIR / "data" / "extracted_snapshots"

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


def verify_credentials():
    """Verify that required API credentials are present."""
    if not GEMINI_API_KEY:
        raise ValueError(
            "GEMINI_API_KEY environment variable is not set.\n"
            "Please create a .env file containing GEMINI_API_KEY=<your_key> "
            "in the project root or home directory, or set it directly in the environment."
        )

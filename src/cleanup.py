import os
from pathlib import Path
from src.config import CACHE_DIR

def prune_cache():
    print(f"Checking HTML snapshot cache in: {CACHE_DIR}")
    html_files = list(CACHE_DIR.glob("*.html"))
    if not html_files:
        print("✔ No raw HTML snapshots found in cache. Cache is empty.")
        return
        
    total_size = sum(f.stat().st_size for f in html_files)
    print(f"Found {len(html_files)} raw HTML snapshots consuming {total_size / 1024 / 1024:.2f} MB.")
    
    for f in html_files:
        try:
            f.unlink()
            print(f"  Removed: {f.name}")
        except Exception as e:
            print(f"  Failed to delete {f.name}: {e}")
            
    print("✔ Cache cleared.")

if __name__ == "__main__":
    prune_cache()

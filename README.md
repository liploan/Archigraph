# Archigraph 🌐🕒
*Temporal Org Chart & Relationship Network Mapping Platform*

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/liploan/Archigraph)

> **Hosting note:** Archigraph needs a Python backend, so it cannot run on GitHub Pages
> (`liploan.github.io/Archigraph` only renders this README). See [Deploying](#-deploying-fully-hosted)
> to run the full app. Once deployed, add your service URL here.


Archigraph is a platform designed to automatically extract, map, and visualize organizational hierarchies and professional relationship networks over time. By ingesting public web data—including historical snapshots via internet archives like the Wayback Machine and current live websites—Archigraph reconstructs reporting lines, team evolutions, and expertise distributions.

---

## 🚀 Key Features

*   ** WayBack Ingestion & Live Scrape Fallback**: Chronologically crawls target websites using the Wayback Machine CDX API, cleans boilerplates, and automatically falls back to live page scraping if archive endpoints time out.
*   **Structured LLM Entity Extraction**: Leverages `gemini-3.5-flash` with native Pydantic schema constraints (`google-genai` SDK) to parse unstructured team pages into validated JSON profiles containing `id`, `full_name`, `job_title`, `department`, `manager_name_or_id`, and `expertise_keywords`.
*   **Interactive Web UI Dashboard**: A sleek, glassmorphic dark-themed single-page app displaying collapsible hierarchies powered by **D3.js**.
    *   **Time Machine Slider**: Drag to travel between chronological snapshots, or toggle autoplay to watch team shifts, hires, and re-orgs over time.
    *   **Upward Path Highlighting**: Clicking any node highlights their exact reporting escalation line up to the CEO in glowing pink.
    *   **Instant Expertise Filtering**: Dynamic search bar highlighting matching nodes and connection bridges as you type.
*   **Temporal Graph Database Seeding (Neo4j)**: Diff-compares consecutive snapshots and versions relationship edges (`valid_from` / `valid_to`) to record promotions and team churn natively in Cypher.
*   **Disk Space Optimization**: Configured to delete raw HTML cache snapshots immediately after structured extraction by default (`KEEP_RAW_SNAPSHOTS = False`), keeping only the tiny extracted JSON payloads. Includes a manual cleanup utility.

---

## 📁 Repository Structure

```
Archigraph/
├── app.py                   # Flask server: pages, /api/demo, /api/extract, /healthz
├── Dockerfile               # Production image (gunicorn)
├── render.yaml              # Render blueprint (one-click deploy)
├── docker-compose.yml       # Local Neo4j community database container setup
├── requirements.txt         # Project-wide Python dependencies
├── .gitignore               # Safe Git tracking excludes (ignores caches and credentials)
├── demo/                    # Demo fixtures + manifest (labelled illustrative vs extracted)
├── tests/                   # App, auth, rate-limit and SSRF tests
├── src/
│   ├── config.py            # Base directories, env settings, and credentials verification
│   ├── security.py          # URL validation and SSRF-safe fetching
│   ├── ingestor.py          # Wayback Crawler, HTML cleaner, and live fallback
│   ├── extractor.py         # Pydantic schemas and Gemini structured output extraction
│   ├── main.py              # Ingestion & extraction CLI runner
│   ├── db_seeder.py         # Temporal Neo4j updating and edge versioning algorithm
│   ├── test_db_seeder.py    # Seeder unit tests using mock DB drivers
│   └── cleanup.py           # Disk footprint cache cleanup utility
└── static/                  # Frontend Web Assets
    ├── index.html           # Dashboard UI structural markup
    ├── style.css            # Dark mode glassmorphism layout and D3 node styling
    └── app.js               # Visualizer controller, search engine, and D3 tree renderer
```

---

## 🚀 Deploying (Fully Hosted)

The repo includes a [`render.yaml`](render.yaml) blueprint and a [`Dockerfile`](Dockerfile), so it deploys
to [Render](https://render.com) in a few clicks (any Docker host works too).

1. Push this repo to GitHub, then click **Deploy to Render** above (or *New → Blueprint* and pick the repo).
2. When prompted for `GEMINI_API_KEY`, enter your key (or leave it for now; demos don't need it).
3. Open the service URL. The demo pills work immediately.

**Live extraction is OFF by default.** It calls Gemini (which costs money) and fetches third-party pages,
so enable it deliberately: in the Render dashboard set `ENABLE_LIVE_EXTRACTION=true` and make sure
`GEMINI_API_KEY` is set. Visitors then need the generated `ARCHIGRAPH_ACCESS_TOKEN` (shown in the
dashboard) to run live extractions; the page prompts for it.

| Variable | Default | Purpose |
|---|---|---|
| `ENABLE_LIVE_EXTRACTION` | `false` | Turn on `/api/extract` (Gemini + web fetching) |
| `GEMINI_API_KEY` | _unset_ | Required only for live extraction |
| `ARCHIGRAPH_ACCESS_TOKEN` | _unset_ | If set, live extraction requires `X-Access-Token` |
| `MAX_EXTRACTIONS_PER_DAY` | `40` | Hard daily cap on Gemini-backed extractions (spend guard) |
| `MAX_SNAPSHOTS_PER_REQUEST` | `5` | Upper bound on `limit` per request |
| `TRUSTED_PROXY_HOPS` | `0` | Set to `1` behind a single reverse proxy so rate limits see real client IPs |
| `FLASK_DEBUG` | `false` | **Never enable on a public host** (exposes an interactive debugger) |

**Built-in protections:** SSRF-safe URL validation (public `http(s)` hosts only, redirects re-checked,
5 MB response cap), per-IP rate limiting (6 live requests / 10 min), a daily extraction budget, and
standard security headers. Rate limits and the budget are in-memory, which is why the container runs a
single gunicorn worker.

**Free-tier caveats:** Render's free plan sleeps after inactivity (first request can take ~30-60 s) and
has an ephemeral disk, so cached extractions are lost on restart.

**About the demo data:** the Google, Meta, SpaceX and Palantir demos are **illustrative, hand-assembled
samples**, not verified or extracted from sources, and may contain inaccuracies. The UI labels them as
such. The "Replit (extracted)" demo is a real Gemini extraction of an archive.org snapshot (unverified).

---

## 🛠️ Setup & Installation

### 1. Clone & Install Dependencies
Ensure you have Python 3.10+ installed. Install the package dependencies:
```bash
pip install -r requirements.txt
```

### 2. Configure Environment Credentials
Create a `.env` file in the root directory and add your Google AI Studio API key:
```bash
# Add your Gemini Key (typing hidden):
printf "Enter GEMINI_API_KEY (typing hidden): " && read -s val && echo && echo "GEMINI_API_KEY=$val" >> ".env"
```

To configure custom Neo4j database credentials (optional, defaults to docker compose specs):
```env
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=password123
```

---

## 💻 Usage

### Option A: Launch the Web UI Dashboard (Recommended)
Launch the local Flask application server:
```bash
python3 app.py
```
Open your web browser and navigate to:
👉 **[http://127.0.0.1:5001](http://127.0.0.1:5001)**

Input a target URL (e.g. `https://replit.com/about`) and select the number of historical snapshots to crawl.

> Live extraction is disabled by default. To use the URL form locally, add
> `ENABLE_LIVE_EXTRACTION=true` to your `.env` (demo pills work without it). Run the test suite with
> `python3 -m unittest discover -s tests -t .`

### Option B: Run via CLI Engine
To run the crawler and LLM extractor pipeline directly inside your terminal, execute:
```bash
python3 -m src.main --url <TARGET_URL> --limit <NUM_SNAPSHOTS>
```
*Outputs are saved as JSON snapshots in `data/extracted_snapshots/`.*

---

## 🔌 API Reference

### POST `/api/extract`
Crawl, clean, and extract structured org data for a given URL.

*   **Request Body**:
    ```json
    {
      "url": "https://replit.com/about",
      "limit": 2,
      "force_extract": false
    }
    ```
*   **Response Payload**:
    ```json
    {
      "success": true,
      "domain": "replit.com",
      "snapshots_processed": 2,
      "data": [
        {
          "snapshot_timestamp": "20240612214257",
          "organization_name": "replit.com",
          "entities": [
            {
              "id": "amjad-masad",
              "full_name": "Amjad Masad",
              "job_title": "Founder & CEO",
              "department": "Executive",
              "manager_name_or_id": null,
              "expertise_keywords": ["Developer Tools", "AI"],
              "bio_summary": "Founder and CEO of Replit..."
            }
          ]
        }
      ]
    }
    ```

---

## 💾 Disk Space & Cache Management

By default, raw downloaded HTML pages are deleted immediately after parsing. If you need to debug raw scrapes, set `KEEP_RAW_SNAPSHOTS=true` inside `.env`.

To manually prune any remaining cached HTML pages from your drive, execute:
```bash
PYTHONPATH=. python3 src/cleanup.py
```

---

## 🛢️ Temporal Database Setup (Neo4j)

### 1. Start the Container
Start the local in-memory Neo4j container service (requires Docker to be running):
```bash
docker compose up -d
```
Access the Neo4j graphical browser interface at: **[http://localhost:7474](http://localhost:7474)** (User: `neo4j`, Password: `password123`).

### 2. Run Seeder Unit Tests
To verify the comparative seeder sync algorithms without needing a live connection, run the mock test suite:
```bash
PYTHONPATH=. python3 src/test_db_seeder.py
```

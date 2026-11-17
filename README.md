# Archigraph 🌐🕒
*Temporal Org Chart & Relationship Network Mapping Platform*

[![Live Demo](https://img.shields.io/badge/Live_Demo-archigraph--sevo.onrender.com-2ea44f?style=for-the-badge)](https://archigraph-sevo.onrender.com)
[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/liploan/Archigraph)

> **Live App:** **[https://archigraph-sevo.onrender.com](https://archigraph-sevo.onrender.com)** *(hosted on Render's free tier — allow ~30–60s on first visit if waking from idle).*
>
> **Hosting note:** Archigraph needs a Python backend, so it cannot run on GitHub Pages
> (`liploan.github.io/Archigraph` only renders this README). See [Deploying](#-deploying-fully-hosted)
> to deploy your own instance.


Archigraph is a platform designed to automatically extract, map, and visualize organizational hierarchies and professional relationship networks over time. By ingesting public web data—including historical snapshots via internet archives like the Wayback Machine and current live websites—Archigraph reconstructs reporting lines, team evolutions, and expertise distributions.

---

## 🚀 Key Features

*   **Wayback Ingestion & Evenly-Spaced Historical Sampling**: Queries the Wayback Machine CDX API with monthly collapse (`collapse=timestamp:6`), deduplicates by content digest, samples evenly across the chronological timeline, cleans HTML boilerplate, and automatically falls back to live page scraping if archive endpoints time out.
*   **Structured LLM Entity Extraction & Confidence Provenance**: Leverages `gemini-3.8-flash` (configurable via `GEMINI_MODEL`, with automatic fallback to `gemini-flash-latest`) with native Pydantic schema constraints (`google-genai` SDK) to parse unstructured team pages into validated JSON profiles containing `id`, `full_name`, `job_title`, `department`, `manager_name_or_id`, `reporting_confidence` (`explicit` | `inferred` | `none`), `reporting_evidence`, and `expertise_keywords`.
*   **Temporal Diff Engine & Cross-Snapshot Entity Resolution**: Normalizes accents, nicknames, and first-name prefixes across snapshots so individuals retain a canonical ID over time, classifying every transition into **Joined**, **Promoted**, **Moved** (re-org / lateral shift), **Departed**, or **Unchanged**.
*   **VC / PE Org Diligence & Talent Intelligence (`src/intelligence.py`)**:
    *   **Org Health Scorecard**: Computes leadership retention %, VP+/C-suite churn %, internal-promotion vs. external-senior-hire bench archetype, hierarchy depth, span-of-control bottlenecks, unfilled VP+ leadership seats, emerging domain capabilities, and auto-generated bull/risk diligence briefs.
    *   **Executive Recruiting Poachability Radar**: Scores every active leader (`0–100`, `Prime Target` / `Passive Watch` / `Anchored`) using transparent structural catalysts—*Layered Over in Re-Org*, *Sponsor/Manager Departed*, *Stagnant Amid Peer Promotions*, and *Scope/Span Compression*—plus a **Spinout & Available Alumni Watchlist** for departed founders, chief scientists, and VPs.
    *   **Bring Your Own Network (Warm Intros & Candid Backchannels)**: Matches uploaded LinkedIn/CRM CSV contact lists (or a 1-click Demo VC & Search Network) against **both active rosters and departed historical snapshots** to uncover off-list backchannel reference checks who overlapped with current executives.
*   **Public Job-Board Signal Fusion (`src/job_signals.py`)**:
    *   Ingests public **Greenhouse**, **Lever**, and **Ashby** job boards (or inline pasted JDs), extracts explicit reporting-line clauses (*"Reporting directly to our CTO..."*) and roadmap keywords (`AI Agents`, `Multi-Tenant Sandboxes`, `CUDA`, `FedRAMP`), resolves the hiring manager node, and attaches live `+ HIRING` open seats directly onto the org chart.
*   **Cross-Company Portfolio Screener & Spinout Tracker (`src/portfolio.py`)**:
    *   Benchmarks all tracked organizations in a sortable institutional table (Retention %, VP+ Churn, Prime Poachable Targets, Open Roles, Bench Archetype) and automatically resolves cross-company alumni movements and stealth founder spinouts (e.g., `spacex.com` → `impulsespace.com`).
*   **Watchlist Alert Engine & Slack / CRM Webhooks (`src/alerts.py`)**:
    *   Evaluates configurable portfolio trigger rules (*Spinouts & Migrations*, *VP+ & C-Suite Exits*, *Prime Poachable ≥ 55*, *Unfilled VP+ Seats*) and emits inspectable, copyable **Slack Block Kit** and **CRM/ATS Event** webhook JSON payloads.
*   **Key-Person Blast Radius Simulator & 4-Era Provenance Timelines**:
    *   Models what-if executive departures directly on the graph (orphaned direct reports, cascade flight-risk shock, single-point domain loss, and ranked internal succession candidates), backed by 4-era historical trajectories (`2018 → 2020 → 2022 → 2024`) with clickable Wayback/live source verification links.
*   **Interactive Web UI Dashboard**: A glassmorphic dark-themed single-page app powered by **D3.js**:
    *   **Dual Layout Modes & Poachability Halos**: Switch between the hierarchical **Org Tree** (with multi-root Co-Founder support and interactive collapsible `+N` / `−` subtrees) and the force-directed **Relationship Mesh**, and toggle **Poachability Radar** or **Network Bridge** rings directly on canvas nodes.
    *   **Time Machine Slider & Departed Overlay**: Scrub or autoplay across chronological snapshots, inspect collapsible "What Changed" diff accordions, and toggle **Show Departed** to overlay departed leaders in context.
    *   **Longitudinal Career Timeline**: Clicking any node displays their complete cross-snapshot career arc (role, department, and manager at each historical capture) with one-click time travel.
    *   **Warm Path Finder**: Computes and highlights the shortest introduction path between any two people across reporting lines, shared expertise keywords, and department peers.
    *   **Search-to-Zoom & Institutional Exports**: Filter by skill, role, or name (dims non-matches, auto-expands collapsed subtrees, and pans/zooms on `Enter`), and export **VC & Search Brief (`.md`)**, **Temporal JSON**, **Snapshot Roster CSV** (with poachability scores), or **Standalone Vector SVG**.
*   **Temporal Graph Database Seeding (Neo4j)**: Syncs diff-enriched snapshots and versions `:BELONGS_TO` and `:REPORTS_TO` edges (`valid_from` / `valid_to`, `confidence`, `evidence`, `diff_status`) natively in Cypher.
*   **Disk Space Optimization**: Configured to delete raw HTML cache snapshots immediately after structured extraction by default (`KEEP_RAW_SNAPSHOTS = False`), keeping only the extracted JSON payloads. Includes a manual cleanup utility.

---

## 📁 Repository Structure

```
Archigraph/
├── app.py                   # Flask server: pages, /api/demo, /api/extract, /api/warm-path, /healthz
├── Dockerfile               # Production image (gunicorn)
├── render.yaml              # Render blueprint (one-click deploy)
├── docker-compose.yml       # Local Neo4j community database container setup
├── requirements.txt         # Project-wide Python dependencies
├── .gitignore               # Safe Git tracking excludes (ignores caches and credentials)
├── demo/                    # Demo fixtures + manifest (labelled illustrative vs extracted)
├── tests/                   # App, auth, rate-limit, SSRF, diff engine, and warm-path tests
├── src/
│   ├── config.py            # Base directories, env settings, and credentials verification
│   ├── security.py          # URL validation and SSRF-safe fetching
│   ├── ingestor.py          # Wayback Crawler, even timeline sampler, HTML cleaner, and live fallback
│   ├── extractor.py         # Pydantic schemas and Gemini structured output extraction
│   ├── diff_engine.py       # Cross-snapshot entity resolution, seniority ranker, diffs, and warm-path BFS
│   ├── intelligence.py      # VC/PE diligence KPIs, executive poachability radar & backchannel matcher
│   ├── job_signals.py       # Greenhouse/Lever/Ashby ATS parser, JD reporting-line & roadmap extractor
│   ├── portfolio.py         # Multi-org screener & cross-company spinout / migration linker
│   ├── alerts.py            # Watchlist trigger rule evaluator & Slack / CRM webhook payload builder
│   ├── main.py              # Ingestion, diff enrichment, and optional Neo4j seeding CLI runner
│   ├── db_seeder.py         # Temporal Neo4j updating and edge versioning algorithm
│   ├── test_db_seeder.py    # Seeder unit tests using mock DB drivers
│   └── cleanup.py           # Disk footprint cache cleanup utility
└── static/                  # Frontend Web Assets
    ├── index.html           # Dashboard UI structural markup
    ├── style.css            # Dark mode glassmorphism layout and D3 node styling
    └── app.js               # Visualizer controller, tree/mesh renderer, career timeline, and exporter
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
| `GEMINI_MODEL` | `gemini-3.8-flash` | Gemini model used for structured org extraction |
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
To run the crawler, LLM extractor, and temporal diff engine directly inside your terminal, execute:
```bash
python3 -m src.main --url <TARGET_URL> --limit <NUM_SNAPSHOTS> [--force-extract] [--seed-neo4j]
```
*Outputs are enriched with cross-snapshot diffs and saved as JSON snapshots in `data/extracted_snapshots/`. Pass `--seed-neo4j` to automatically sync the enriched snapshots into Neo4j.*

---

## 🔌 API Reference

### POST `/api/extract`
Crawl, clean, and extract structured org data and temporal diffs for a given URL.

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
          "diff_summary": null,
          "entities": [
            {
              "id": "amjad-masad",
              "full_name": "Amjad Masad",
              "job_title": "Founder & CEO",
              "department": "Executive",
              "manager_name_or_id": null,
              "reporting_confidence": "none",
              "reporting_evidence": "Founder and Chief Executive Officer at top of leadership page.",
              "expertise_keywords": ["Developer Tools", "AI"],
              "bio_summary": "Founder and CEO of Replit...",
              "diff": {
                "status": "baseline",
                "summary": "Initial baseline snapshot"
              }
            }
          ]
        }
      ]
    }
    ```

### POST `/api/warm-path`
Compute the shortest warm introduction path between two entities in a snapshot (prioritizing formal reporting lines, then shared expertise keywords, then shared department peers).

*   **Request Body**:
    ```json
    {
      "entities": [...],
      "source_id": "amjad-masad",
      "target_id": "michele-catasta"
    }
    ```

### POST `/api/intelligence`
Enrich chronological snapshots with VC/PE diligence scorecards, strategic capability shifts, executive recruiting poachability scores (`0–100`), and departed spinout/alumni watchlists.

### POST `/api/network-match` & GET `/api/sample-network`
Match an uploaded or pasted contact network (`contacts`) against active and historical org snapshots (`snapshots`) to surface 1st-degree insiders, former-colleague backchannel reference checks with exact historical overlap eras, and functional operator bridges.

### GET `/api/portfolio` & GET `/api/extracted/<domain>`
Return cross-company screener rows across all demo and cached extracted organizations, plus cross-org founder spinout and executive migration links.

### POST `/api/jobs/parse`
Fuse inline job descriptions (`postings`) or a live public Greenhouse/Lever/Ashby board (`ats_url`) with an active snapshot (`entities`), resolving hiring managers and generating graph-ready open seat nodes.

### GET `/api/alerts` & POST `/api/simulate-departure`
Evaluate portfolio watchlist trigger rules (`?rules=...`) with Slack Block Kit and CRM/ATS webhook JSON payloads, or simulate the downstream organizational blast radius and internal succession bench if `target_id` departs.

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

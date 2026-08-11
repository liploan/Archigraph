# Archigraph 🌐🕒
*Temporal Org Chart & Relationship Network Mapping Platform*

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
├── app.py                   # Flask Web Server & API Router
├── docker-compose.yml       # Local Neo4j community database container setup
├── requirements.txt         # Project-wide Python dependencies
├── .gitignore               # Safe Git tracking excludes (ignores caches and credentials)
├── src/
│   ├── config.py            # Base directories, loading variables, and credentials verification
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

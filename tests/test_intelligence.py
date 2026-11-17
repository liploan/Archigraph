import json
import unittest
from pathlib import Path

from src.alerts import generate_watchlist_alerts
from src.intelligence import (
    SAMPLE_INVESTOR_NETWORK,
    enrich_snapshots_with_intelligence,
    match_network_against_snapshots,
    simulate_key_person_departure,
)
from src.job_signals import (
    detect_ats_endpoint,
    enrich_job_postings_for_snapshot,
    parse_reporting_line_from_text,
)
from src.portfolio import build_portfolio_overview


DEMO_DIR = Path(__file__).resolve().parent.parent / "demo"
EXTRACTED_DIR = Path(__file__).resolve().parent.parent / "data" / "extracted_snapshots"


class TestIntelligenceEngine(unittest.TestCase):
    def test_layered_over_and_open_seat_detection(self):
        snapshots = [
            {
                "snapshot_timestamp": "20240101000000",
                "organization_name": "acme.ai",
                "entities": [
                    {
                        "id": "founder-ceo",
                        "full_name": "Dana Founder",
                        "job_title": "Founder & CEO",
                        "department": "Executive",
                        "manager_name_or_id": None,
                        "expertise_keywords": ["Enterprise AI", "Strategy"],
                    },
                    {
                        "id": "vp-eng",
                        "full_name": "Sam Builder",
                        "job_title": "VP of Engineering",
                        "department": "Engineering",
                        "manager_name_or_id": "founder-ceo",
                        "expertise_keywords": ["Distributed Systems", "Rust"],
                    },
                    {
                        "id": "vp-prod",
                        "full_name": "Robin Product",
                        "job_title": "VP of Product",
                        "department": "Product",
                        "manager_name_or_id": "founder-ceo",
                        "expertise_keywords": ["Product Led Growth"],
                    },
                ],
            },
            {
                "snapshot_timestamp": "20250101000000",
                "organization_name": "acme.ai",
                "entities": [
                    {
                        "id": "founder-ceo",
                        "full_name": "Dana Founder",
                        "job_title": "Founder & CEO",
                        "department": "Executive",
                        "manager_name_or_id": None,
                        "expertise_keywords": ["Enterprise AI", "Agentic Workflows"],
                    },
                    {
                        "id": "ext-cto",
                        "full_name": "Jordan External",
                        "job_title": "CTO",
                        "department": "Engineering",
                        "manager_name_or_id": "founder-ceo",
                        "expertise_keywords": ["LLM Serving", "CUDA"],
                    },
                    {
                        "id": "vp-eng",
                        "full_name": "Sam Builder",
                        "job_title": "VP of Engineering",
                        "department": "Engineering",
                        "manager_name_or_id": "ext-cto",
                        "expertise_keywords": ["Distributed Systems", "Rust"],
                    },
                ],
            },
        ]

        enriched = enrich_snapshots_with_intelligence(snapshots)
        intel = enriched[1]["intelligence"]

        # VC Metrics verification
        vc = intel["vc_metrics"]
        self.assertAlmostEqual(vc["retention_rate_pct"], 66.7, places=1)
        self.assertEqual(vc["external_senior_hires"], 1)
        self.assertEqual(vc["internal_promo_count"], 0)
        self.assertEqual(vc["bench_archetype"], "External Talent Magnet")

        # Open VP+ seat detected for departed VP of Product
        open_seats = intel["strategic_signals"]["open_leadership_seats"]
        self.assertEqual(len(open_seats), 1)
        self.assertEqual(open_seats[0]["vacated_by"], "Robin Product")

        # Emerging capabilities surfaced
        self.assertIn("Agentic Workflows", intel["strategic_signals"]["emerging_capabilities"])

        # Sam Builder was layered under newly hired CTO Jordan External -> Prime Target
        candidates = {c["id"]: c for c in intel["recruiting_radar"]["candidates"]}
        sam = candidates["vp-eng"]
        self.assertEqual(sam["tier"], "high")
        self.assertGreaterEqual(sam["score"], 55)
        self.assertTrue(any(t["code"] == "layered_over" for t in sam["triggers"]))

        # Founder & newly hired CTO should be anchored
        self.assertEqual(candidates["founder-ceo"]["tier"], "anchored")
        self.assertEqual(candidates["ext-cto"]["tier"], "anchored")

        # Alumni spinout / placement watchlist captures departed VP Product
        alumni = intel["alumni_spinout_radar"]
        self.assertEqual(len(alumni), 1)
        self.assertEqual(alumni[0]["id"], "vp-prod")

    def test_network_matching_discovers_backchannels_and_insiders(self):
        replit_snaps = sorted(
            [json.loads(p.read_text(encoding="utf-8")) for p in DEMO_DIR.glob("replit_com_*_extracted.json")],
            key=lambda s: s.get("snapshot_timestamp", ""),
        )
        enriched = enrich_snapshots_with_intelligence(replit_snaps)

        contacts = [
            {"name": "Amjad Masad", "company": "Replit", "role": "CEO", "relationship": "Co-Investor"},
            {"name": "John Agan", "company": "Replit", "role": "Former VP Product", "relationship": "Operator Network"},
            {"name": "Marcus Vance", "company": "Replit", "role": "Former Staff Engineer", "relationship": "Scout"},
        ]
        report = match_network_against_snapshots(contacts, enriched, domain="replit.com")

        self.assertEqual(len(report["insiders"]), 1)
        self.assertEqual(report["insiders"][0]["target_id"], "amjad-masad")

        # John Agan departed between snapshots -> candid historical backchannel overlapping active leaders
        self.assertEqual(len(report["backchannels"]), 1)
        bc = report["backchannels"][0]
        self.assertEqual(bc["departed_id"], "john-agan")
        overlap_ids = {o["id"] for o in bc["overlapped_leaders"]}
        self.assertIn("amjad-masad", overlap_ids)
        self.assertIn("scott-kennedy", overlap_ids)

        # Marcus Vance matches via company/engineering functional overlap
        self.assertEqual(len(report["org_veterans"]), 1)
        self.assertGreaterEqual(report["total_matches"], 3)

    def test_all_demos_produce_rich_intelligence_and_sample_network_bridges(self):
        manifest = json.loads((DEMO_DIR / "manifest.json").read_text(encoding="utf-8"))
        for key, entry in manifest.items():
            snaps = sorted(
                [json.loads(p.read_text(encoding="utf-8")) for p in DEMO_DIR.glob(f"{entry['prefix']}_*_extracted.json")],
                key=lambda s: s.get("snapshot_timestamp", ""),
            )
            enriched = enrich_snapshots_with_intelligence(snaps)
            latest_intel = enriched[-1]["intelligence"]
            self.assertIn("vc_metrics", latest_intel, key)
            self.assertGreater(len(latest_intel["diligence_brief"]["bull_signals"]), 0, key)
            self.assertGreater(len(latest_intel["diligence_brief"]["risk_signals"]), 0, key)
            self.assertEqual(
                len(latest_intel["recruiting_radar"]["candidates"]),
                len(enriched[-1]["entities"]),
                key,
            )

            net = match_network_against_snapshots(SAMPLE_INVESTOR_NETWORK, enriched, domain=entry["domain"])
            self.assertGreaterEqual(net["total_matches"], 1, f"Expected sample network match for {key}")

    def test_job_signal_parsing_and_hiring_manager_resolution(self):
        self.assertEqual(
            detect_ats_endpoint("https://boards.greenhouse.io/spacex")[0],
            "Greenhouse",
        )
        self.assertEqual(
            detect_ats_endpoint("https://jobs.lever.co/palantir")[0],
            "Lever",
        )
        self.assertEqual(
            detect_ats_endpoint("https://jobs.ashbyhq.com/replit")[0],
            "Ashby",
        )

        hint, quote = parse_reporting_line_from_text(
            "Reporting directly to our CTO Luis Héctor Chávez, you will architect Firecracker sandboxes."
        )
        self.assertIn("CTO", hint)
        self.assertIn("Reporting directly", quote)

        replit_current = json.loads((DEMO_DIR / "replit_com_current_extracted.json").read_text(encoding="utf-8"))
        job_fixtures = json.loads((DEMO_DIR / "job_postings.json").read_text(encoding="utf-8"))
        summary = enrich_job_postings_for_snapshot(
            job_fixtures["replit"],
            replit_current["entities"],
            org_name="replit.com",
        )
        self.assertEqual(summary["total_open_roles"], 4)
        self.assertGreaterEqual(summary["executive_open_roles"], 3)
        self.assertIn("AI Agents", summary["roadmap_keywords"])
        self.assertIn("Multi-Tenant Sandboxes", summary["roadmap_keywords"])

        by_id = {p["id"]: p for p in summary["postings"]}
        self.assertEqual(by_id["open-ash-replit-vp-product"]["hiring_manager_id"], "amjad-masad")
        self.assertEqual(by_id["open-ash-replit-dir-runtime"]["hiring_manager_id"], "luis-hector-chavez")
        self.assertEqual(by_id["open-ash-replit-head-ent-gtm"]["hiring_manager_id"], "michele-catasta")
        self.assertTrue(all(n.get("_isOpenRole") for n in summary["graph_open_nodes"]))

    def test_portfolio_overview_and_cross_company_spinout_detection(self):
        overview = build_portfolio_overview(DEMO_DIR, EXTRACTED_DIR)
        kpis = overview["portfolio_kpis"]
        self.assertGreaterEqual(kpis["organizations_tracked"], 6)
        self.assertGreaterEqual(kpis["total_open_roles"], 18)
        self.assertGreaterEqual(kpis["cross_company_flows_count"], 1)

        spinouts = [
            fl for fl in overview["cross_company_flows"]
            if fl["flow_type"] == "spinout_founded" and "Mueller" in fl["full_name"]
        ]
        self.assertEqual(len(spinouts), 1)
        self.assertEqual(spinouts[0]["from_org"]["domain"], "spacex.com")
        self.assertEqual(spinouts[0]["to_org"]["domain"], "impulsespace.com")

        # Bidirectional cross-org index present on both SpaceX and Impulse Space
        cross_idx = overview["cross_links_index"]
        self.assertIn("tom-mueller", cross_idx["spacex.com"])
        self.assertIn("tom-mueller", cross_idx["impulsespace.com"])

    def test_four_era_timelines_alerts_webhooks_and_blast_simulator(self):
        # Verify 4-era trajectories on Google, Meta, SpaceX, Palantir
        for prefix in ("google_com", "meta_com", "spacex_com", "palantir_com"):
            files = sorted(DEMO_DIR.glob(f"{prefix}_*_extracted.json"))
            self.assertEqual(len(files), 4, f"Expected 4 eras for {prefix}")
            for p in files:
                snap = json.loads(p.read_text(encoding="utf-8"))
                for ent in snap["entities"]:
                    self.assertNotEqual(ent["full_name"], ent["job_title"])
                    self.assertNotIn("\x00", ent["full_name"])

        # Verify Watchlist Alert Engine & Slack / CRM Webhook schemas
        feed = generate_watchlist_alerts(DEMO_DIR, EXTRACTED_DIR)
        self.assertGreaterEqual(feed["total_alerts"], 5)
        spinout_alerts = [a for a in feed["alerts"] if a["rule"] == "spinout_watch"]
        self.assertGreaterEqual(len(spinout_alerts), 1)
        sample_alert = spinout_alerts[0]
        self.assertIn("blocks", sample_alert["webhooks"]["slack"])
        self.assertEqual(sample_alert["webhooks"]["crm_ats"]["schema_version"], "2026-11")

        # Rule filtering works
        filtered = generate_watchlist_alerts(DEMO_DIR, EXTRACTED_DIR, enabled_rules=["spinout_watch"])
        self.assertTrue(all(a["rule"] == "spinout_watch" for a in filtered["alerts"]))

        # Verify Key-Person Departure Blast-Radius Simulator
        spacex_2024 = json.loads((DEMO_DIR / "spacex_com_20240101000000_extracted.json").read_text(encoding="utf-8"))
        enriched_spx = enrich_snapshots_with_intelligence([spacex_2024])
        sim = simulate_key_person_departure(enriched_spx[0]["entities"], "mark-juncosa")
        self.assertIsNotNone(sim)
        self.assertEqual(sim["direct_reports_orphaned"], 3)
        self.assertGreater(sim["blast_radius_pct"], 25)
        self.assertGreaterEqual(len(sim["succession_bench"]), 1)


if __name__ == "__main__":
    unittest.main()

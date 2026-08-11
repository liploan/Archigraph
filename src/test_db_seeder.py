import unittest
from unittest.mock import MagicMock, patch
from src.db_seeder import TemporalGraphSeeder, parse_timestamp

class TestTemporalGraphSeeder(unittest.TestCase):
    
    @patch('src.db_seeder.GraphDatabase')
    def setUp(self, mock_graph_db):
        # Mock driver and session structures
        self.mock_driver = MagicMock()
        self.mock_session = MagicMock()
        
        mock_graph_db.driver.return_value = self.mock_driver
        self.mock_driver.session.return_value.__enter__.return_value = self.mock_session
        
        # Instantiate seeder
        self.seeder = TemporalGraphSeeder()
        
    def test_parse_timestamp(self):
        self.assertEqual(parse_timestamp("20240612214257"), "2024-06-12T21:42:57Z")
        self.assertEqual(parse_timestamp("20240612"), "2024-06-12T00:00:00Z")
        
    def test_sync_snapshot_new_hire(self):
        # Mock snapshot payload representing 1 new hire (Amjad Masad)
        snapshot = {
            "snapshot_timestamp": "20240612214257",
            "organization_name": "replit.com",
            "entities": [
                {
                    "id": "amjad-masad",
                    "full_name": "Amjad Masad",
                    "job_title": "Founder & CEO",
                    "department": "Executive",
                    "manager_name_or_id": None,
                    "expertise_keywords": ["Developer Tools", "AI"]
                }
            ]
        }
        
        # Mock database response indicating no active belongs relationship exists
        mock_result = MagicMock()
        mock_result.single.return_value = None  # No active belongs exists
        self.mock_session.run.return_value = mock_result
        
        self.seeder.sync_snapshot(snapshot)
        
        # Verify that session.run was called to MERGE organization and person
        calls = [args[0] for args, kwargs in self.mock_session.run.call_args_list]
        
        # Verify organization is merged
        self.assertTrue(any("MERGE (o:Organization" in c for c in calls))
        # Verify person is merged
        self.assertTrue(any("MERGE (p:Person" in c for c in calls))
        # Verify active belongs relationship is created
        self.assertTrue(any("CREATE (p)-[:BELONGS_TO" in c for c in calls))
        
    def test_sync_snapshot_departure(self):
        # Mock empty snapshot representing departures of all active members
        snapshot = {
            "snapshot_timestamp": "20240612214257",
            "organization_name": "replit.com",
            "entities": []
        }
        
        self.seeder.sync_snapshot(snapshot)
        
        # Verify that session.run was called to close active relationships
        calls = [args[0] for args, kwargs in self.mock_session.run.call_args_list]
        
        # Verify belongs_to edge closing query was triggered
        self.assertTrue(any("SET r.valid_to = datetime($timestamp)" in c for c in calls))

if __name__ == "__main__":
    unittest.main()

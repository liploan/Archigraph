import datetime
from neo4j import GraphDatabase
from src.config import NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD

def parse_timestamp(ts: str) -> str:
    """Converts Wayback YYYYMMDDHHMMSS format to ISO-8601 YYYY-MM-DDTHH:MM:SSZ."""
    if ts == "current" or not ts:
        return datetime.datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
    if len(ts) >= 14:
        return f"{ts[0:4]}-{ts[4:6]}-{ts[6:8]}T{ts[8:10]}:{ts[10:12]}:{ts[12:14]}Z"
    if len(ts) >= 8:
        return f"{ts[0:4]}-{ts[4:6]}-{ts[6:8]}T00:00:00Z"
    return ts

class TemporalGraphSeeder:
    def __init__(self):
        self.driver = GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASSWORD))
        
    def close(self):
        self.driver.close()
        
    def clear_database(self):
        """Clears all nodes and edges from the active database."""
        with self.driver.session() as session:
            session.run("MATCH (n) DETACH DELETE n")
            print("✔ Database cleared.")
            
    def sync_snapshot(self, snapshot_data: dict):
        """
        Loads a single chronological snapshot and updates the temporal graph.
        """
        raw_ts = snapshot_data.get("snapshot_timestamp")
        timestamp = parse_timestamp(raw_ts)
        org_name = snapshot_data.get("organization_name")
        entities = snapshot_data.get("entities", [])
        
        active_ids = [e["id"] for e in entities]
        
        print(f"Syncing snapshot timestamp: {raw_ts} -> ISO: {timestamp} for org: {org_name}")
        
        with self.driver.session() as session:
            # 1. Ensure the Organization exists
            session.run(
                "MERGE (o:Organization {name: $org_name})",
                org_name=org_name
            )
            
            # 2. Add/Update Person entities and check for role/manager shifts
            for entity in entities:
                person_id = entity["id"]
                full_name = entity["full_name"]
                job_title = entity["job_title"]
                department = entity.get("department") or "Other"
                manager_id = entity.get("manager_name_or_id")
                expertise = entity.get("expertise_keywords", [])
                
                # Merge person node
                session.run(
                    """
                    MERGE (p:Person {id: $person_id})
                    ON CREATE SET p.name = $full_name, p.expertise = $expertise, p.created_at = datetime($timestamp)
                    ON MATCH SET p.name = $full_name, p.expertise = $expertise
                    """,
                    person_id=person_id,
                    full_name=full_name,
                    expertise=expertise,
                    timestamp=timestamp
                )
                
                # Check active BELONGS_TO relationship
                belongs_query = """
                MATCH (p:Person {id: $person_id}), (o:Organization {name: $org_name})
                OPTIONAL MATCH (p)-[r:BELONGS_TO]->(o)
                WHERE r.valid_to IS NULL
                RETURN r
                """
                result = session.run(belongs_query, person_id=person_id, org_name=org_name)
                record = result.single()
                
                if record and record["r"]:
                    r = record["r"]
                    # If role title or department changed, close current and open new
                    if r.get("role_title") != job_title or r.get("department") != department:
                        session.run(
                            """
                            MATCH (p:Person {id: $person_id})-[r:BELONGS_TO]->(o:Organization {name: $org_name})
                            WHERE r.valid_to IS NULL
                            SET r.valid_to = datetime($timestamp)
                            """,
                            person_id=person_id,
                            org_name=org_name,
                            timestamp=timestamp
                        )
                        session.run(
                            """
                            MATCH (p:Person {id: $person_id}), (o:Organization {name: $org_name})
                            CREATE (p)-[:BELONGS_TO {
                                role_title: $job_title,
                                department: $department,
                                valid_from: datetime($timestamp),
                                valid_to: null
                            }]->(o)
                            """,
                            person_id=person_id,
                            org_name=org_name,
                            job_title=job_title,
                            department=department,
                            timestamp=timestamp
                        )
                else:
                    # Create new active belongs relationship
                    session.run(
                        """
                        MATCH (p:Person {id: $person_id}), (o:Organization {name: $org_name})
                        CREATE (p)-[:BELONGS_TO {
                            role_title: $job_title,
                            department: $department,
                            valid_from: datetime($timestamp),
                            valid_to: null
                        }]->(o)
                        """,
                        person_id=person_id,
                        org_name=org_name,
                        job_title=job_title,
                        department=department,
                        timestamp=timestamp
                    )
                
                # Handle manager line (REPORTS_TO edge)
                if manager_id:
                    # Ensure manager node exists
                    session.run(
                        "MERGE (m:Person {id: $manager_id})",
                        manager_id=manager_id
                    )
                    
                    reports_query = """
                    MATCH (p:Person {id: $person_id})-[r:REPORTS_TO]->(m:Person)
                    WHERE r.valid_to IS NULL
                    RETURN r, m.id AS active_manager_id
                    """
                    r_result = session.run(reports_query, person_id=person_id)
                    r_record = r_result.single()
                    
                    if r_record:
                        active_manager_id = r_record["active_manager_id"]
                        if active_manager_id != manager_id:
                            # Close previous manager line
                            session.run(
                                """
                                MATCH (p:Person {id: $person_id})-[r:REPORTS_TO]->(old_m:Person)
                                WHERE r.valid_to IS NULL
                                SET r.valid_to = datetime($timestamp)
                                """,
                                person_id=person_id,
                                timestamp=timestamp
                            )
                            # Create new manager line
                            session.run(
                                """
                                MATCH (p:Person {id: $person_id}), (m:Person {id: $manager_id})
                                CREATE (p)-[:REPORTS_TO {valid_from: datetime($timestamp), valid_to: null}]->(m)
                                """,
                                person_id=person_id,
                                manager_id=manager_id,
                                timestamp=timestamp
                            )
                    else:
                        # Create new active reporting relationship
                        session.run(
                            """
                            MATCH (p:Person {id: $person_id}), (m:Person {id: $manager_id})
                            CREATE (p)-[:REPORTS_TO {valid_from: datetime($timestamp), valid_to: null}]->(m)
                            """,
                            person_id=person_id,
                            manager_id=manager_id,
                            timestamp=timestamp
                        )
                else:
                    # If no manager, close any active reports to someone else
                    session.run(
                        """
                        MATCH (p:Person {id: $person_id})-[r:REPORTS_TO]->(old_m:Person)
                        WHERE r.valid_to IS NULL
                        SET r.valid_to = datetime($timestamp)
                        """,
                        person_id=person_id,
                        timestamp=timestamp
                    )
                    
            # 3. Detect Departures
            # For anyone who has active BELONGS_TO to org, but is NOT in the current entities, close active belongs
            session.run(
                """
                MATCH (p:Person)-[r:BELONGS_TO]->(o:Organization {name: $org_name})
                WHERE r.valid_to IS NULL AND NOT p.id IN $active_ids
                SET r.valid_to = datetime($timestamp)
                """,
                org_name=org_name,
                active_ids=active_ids,
                timestamp=timestamp
            )
            
            # Close active reports for departed people
            session.run(
                """
                MATCH (p:Person)-[r:REPORTS_TO]->(m:Person)
                WHERE r.valid_to IS NULL AND NOT p.id IN $active_ids
                SET r.valid_to = datetime($timestamp)
                """,
                active_ids=active_ids,
                timestamp=timestamp
            )
            
            # Close reports pointing to departed managers
            session.run(
                """
                MATCH (sub:Person)-[r:REPORTS_TO]->(m:Person)
                WHERE r.valid_to IS NULL AND NOT m.id IN $active_ids
                SET r.valid_to = datetime($timestamp)
                """,
                active_ids=active_ids,
                timestamp=timestamp
            )
            
        print(f"✔ Snapshot {raw_ts} synced successfully.")

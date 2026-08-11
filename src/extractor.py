import json
from typing import List, Optional
from pydantic import BaseModel, Field
from google import genai
from google.genai import types
from src.config import GEMINI_API_KEY, verify_credentials

# Pydantic schemas for structured LLM extraction
class PersonEntity(BaseModel):
    id: str = Field(
        description="Unique lowercase alphanumeric slug identifier based on name, e.g. 'john-doe'"
    )
    full_name: str = Field(description="The full name of the person")
    job_title: str = Field(description="The exact job title or role of the person")
    department: Optional[str] = Field(
        None, description="The department, team, or division they belong to, if mentioned or inferred"
    )
    manager_name_or_id: Optional[str] = Field(
        None,
        description="The name or ID of the manager they report to, if explicitly mentioned, or clearly inferred from nested list/table structure"
    )
    expertise_keywords: List[str] = Field(
        default_factory=list,
        description="List of 3-7 specific skill, project, or domain expertise keywords extracted from their bio or description"
    )
    bio_summary: Optional[str] = Field(
        None, description="A brief one-sentence summary of their biography or professional focus"
    )

class ExtractedOrgSnapshot(BaseModel):
    snapshot_timestamp: str = Field(description="The timestamp of the crawled snapshot (e.g. YYYYMMDDHHMMSS)")
    organization_name: str = Field(description="The name of the target organization")
    entities: List[PersonEntity] = Field(description="List of extracted people and their structural attributes")


def extract_org_structure(cleaned_content: str, timestamp: str, domain: str) -> Optional[ExtractedOrgSnapshot]:
    """
    Uses the Google GenAI SDK to perform structured JSON extraction of people, titles,
    departments, reporting structures, and expertise from raw cleaned webpage text content.
    """
    verify_credentials()
    
    # Initialize client
    client = genai.Client(api_key=GEMINI_API_KEY)
    
    system_instruction = (
        "You are an expert organizational network analyst and systems architect. "
        "Your task is to analyze raw cleaned text from a company's leadership/team webpage and extract a structured "
        "hierarchical representation of the organization. "
        "Follow these rules strictly:\n"
        "1. Identify every person mentioned with their corresponding title and department.\n"
        "2. Parse reporting lines: If Person A is listed under a header for Person B (e.g. 'Engineering led by Jane'), "
        "set Person A's manager to 'Jane'. If Person C is listed as 'reporting to the CEO', set their manager accordingly.\n"
        "3. Generate unique lower-case slug IDs for each person based on their name (e.g., 'Jane Smith' becomes 'jane-smith'). "
        "Keep these slugs consistent if the same person is mentioned multiple times.\n"
        "4. Extract 3-7 technical or domain expertise keywords for each person based on their bio summary (e.g., 'Kubernetes', 'Go', 'Mergers & Acquisitions')."
    )
    
    user_prompt = (
        f"Analyze the following cleaned leadership/team page content for the organization '{domain}' "
        f"captured at timestamp '{timestamp}'. Extract the organization structure and return it in the requested schema.\n\n"
        f"Cleaned Webpage Content:\n"
        f"========================\n"
        f"{cleaned_content}\n"
        f"========================\n"
    )
    
    try:
        # Use gemini-2.5-flash for structured data extraction
        response = client.models.generate_content(
            model="gemini-3.5-flash",
            contents=user_prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=ExtractedOrgSnapshot,
                system_instruction=system_instruction,
                temperature=0.1,  # Low temperature for highly deterministic extraction
            )
        )
        
        # Load output into Pydantic model
        result_data = json.loads(response.text)
        return ExtractedOrgSnapshot(**result_data)
        
    except Exception as e:
        print(f"Error during structured LLM extraction for timestamp {timestamp}: {e}")
        return None

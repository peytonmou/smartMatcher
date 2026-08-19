import os
import json
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()

app = FastAPI()

# Enable CORS for React frontend (port 5173)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

client = OpenAI(
    base_url=os.environ.get("AZURE_OPENAI_ENDPOINT"),
    api_key=os.environ.get("AZURE_OPENAI_API_KEY")
)

# Root health check endpoint
@app.get("/")
def read_root():
    return {"status": "Backend server is running!", "endpoint": "/api/match"}

class MatchRequest(BaseModel):
    cv_text: str
    jd_text: str

@app.post("/api/match")
async def match_skills(req: MatchRequest):
    print(f"--> Received request. CV length: {len(req.cv_text)}, JD length: {len(req.jd_text)}")
    
    if not req.cv_text.strip() or not req.jd_text.strip():
        raise HTTPException(status_code=400, detail="Both CV and JD text must be provided.")

    system_prompt = """
    You are an expert AI recruiter and skill matching engine.
    Analyze the provided Candidate CV against the Target Job Description (JD).
    
    You MUST return ONLY a valid JSON object matching this schema:
    {
      "matchPercentage": integer between 0 and 100,
      "candidateSummary": "2-3 sentence overview of candidate fit",
      "strengths": ["list", "of", "4-6", "matching", "skills"],
      "missingSkills": ["list", "of", "2-5", "missing", "skills"],
      "tailoredElevatorPitch": "2-sentence elevator pitch"
    }
    """

    try:
        response = client.chat.completions.create(
            model="gpt-5-mini",
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"--- CANDIDATE CV ---\n{req.cv_text}\n\n--- JOB DESCRIPTION ---\n{req.jd_text}"}
            ]
        )
        
        raw_content = response.choices[0].message.content
        print("--> Raw AI Response:", raw_content)
        
        result_json = json.loads(raw_content)
        return result_json

    except Exception as e:
        print("--> ERROR during AI processing:", str(e))
        raise HTTPException(status_code=500, detail=str(e))
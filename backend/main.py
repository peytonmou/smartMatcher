import json
import os
from datetime import datetime
from pathlib import Path

from alembic import command
from alembic.config import Config
from fastapi import Cookie, Depends, FastAPI, HTTPException, Response, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from openai import OpenAI
from sqlalchemy.orm import Session

from auth import create_session_token, create_verification_code, invalidate_latest_verification_code, normalize_email, read_session_user_id, verify_code
from database import get_database_url, get_db
from email_delivery import EmailDeliveryError, send_verification_code
from models import User

load_dotenv()

app = FastAPI()


@app.on_event("startup")
def apply_database_migrations():
    """Create or upgrade the database with its recorded Alembic migrations."""
    config = Config(str(Path(__file__).with_name("alembic.ini")))
    if os.getenv("DATABASE_URL"):
        config.set_main_option("sqlalchemy.url", get_database_url())
    command.upgrade(config, "head")

# Enable credentialed browser requests only from the configured frontend URLs.
frontend_origins = os.getenv(
    "FRONTEND_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"
).split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in frontend_origins if origin.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

client = OpenAI(
    base_url=os.environ.get("AZURE_OPENAI_ENDPOINT"),
    api_key=os.environ.get("AZURE_OPENAI_API_KEY")
)

SESSION_COOKIE_NAME = "smart_cv_session"


def session_cookie_options() -> dict:
    secure = os.getenv("COOKIE_SECURE", "false").lower() == "true"
    same_site = os.getenv("COOKIE_SAMESITE", "lax").lower()
    if same_site not in {"lax", "strict", "none"}:
        raise RuntimeError("COOKIE_SAMESITE must be lax, strict, or none.")
    if same_site == "none" and not secure:
        raise RuntimeError("COOKIE_SAMESITE=none requires COOKIE_SECURE=true.")
    return {"httponly": True, "secure": secure, "samesite": same_site}


class EmailCodeRequest(BaseModel):
    email_address: str


class EmailCodeVerification(BaseModel):
    email_address: str
    code: str


class AuthenticatedUser(BaseModel):
    user_id: int
    email_address: str
    first_login_time: datetime
    last_login_time: datetime


def to_authenticated_user(user: User) -> AuthenticatedUser:
    return AuthenticatedUser(
        user_id=user.user_id,
        email_address=user.email_address,
        first_login_time=user.first_login_time,
        last_login_time=user.last_login_time,
    )


@app.post("/api/auth/request-code")
def request_login_code(payload: EmailCodeRequest, db: Session = Depends(get_db)):
    try:
        email_address = normalize_email(payload.email_address)
        code = create_verification_code(db, email_address)
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(error)) from error

    try:
        send_verification_code(email_address, code)
    except EmailDeliveryError as error:
        invalidate_latest_verification_code(db, email_address)
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(error)) from error

    return {"message": "We sent a six-digit verification code to your email address.", "expires_in_minutes": 10}


@app.post("/api/auth/verify-code", response_model=AuthenticatedUser)
def verify_login_code(payload: EmailCodeVerification, response: Response, db: Session = Depends(get_db)):
    try:
        email_address = normalize_email(payload.email_address)
        if not payload.code.isdigit() or len(payload.code) != 6:
            raise ValueError("Enter the six-digit verification code.")
        user = verify_code(db, email_address, payload.code)
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(error)) from error

    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=create_session_token(user.user_id),
        max_age=60 * 60 * 24 * 14,
        **session_cookie_options(),
    )
    return to_authenticated_user(user)


@app.get("/api/auth/me", response_model=AuthenticatedUser)
def current_user(smart_cv_session: str | None = Cookie(default=None), db: Session = Depends(get_db)):
    user_id = read_session_user_id(smart_cv_session)
    user = db.get(User, user_id) if user_id else None
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not signed in.")
    return to_authenticated_user(user)


@app.post("/api/auth/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(response: Response):
    response.delete_cookie(key=SESSION_COOKIE_NAME, **session_cookie_options())

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

    CRITICAL RULE FOR SCORING:
    Calculate scores for three distinct dimensions (0-100):
    1. hardSkillsScore (50% weight): Technical tools, programming languages, databases (e.g., C#, .NET, SQL, Go).
    2. experienceScore (30% weight): Seniority, project scale, years of experience.
    3. transferableSkillsScore (20% weight): SOFT SKILLS, DOMAIN KNOWLEDGE, and INTERPERSONAL CAPABILITIES (e.g., communication, coordination, domain knowledge, team leadership). 
    --> IF THE CV MATCHES SOFT SKILLS OR DOMAIN KNOWLEDGE LISTED IN THE JD (e.g., "communication", "coordination", "industry domain knowledge"), YOU MUST SET transferableSkillsScore HIGH (e.g., 80-100). NEVER RETURN 0 WHEN SOFT SKILLS MATCH.

    --- DOMAIN TAXONOMY & SEMANTIC RULES ---
    - Tech Stack Ecosystems: Recognize frameworks imply languages (.NET implies C#).
    - Equivalent Tools: Recognize transferable technical skills (Oracle vs Relational SQL).
    - Business & Soft Skills: Map synonyms and directly match listed soft skills/domain knowledge.

    --- OUTPUT FORMAT ---
    You MUST return ONLY a valid JSON object strictly matching this schema:
    {
    "matchPercentage": integer (0-100),
    "dimensionScores": {
        "hardSkillsScore": integer (0-100),
        "experienceScore": integer (0-100),
        "transferableSkillsScore": integer (0-100)
    },
    "candidateSummary": "string",
    "strengths": ["string"],
    "missingSkills": ["string"],
    "semanticInferences": ["string"],
    "tailoredElevatorPitch": "string"
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

"""Passwordless email-code authentication helpers."""

import hashlib
import hmac
import os
import re
import secrets
from datetime import datetime, timedelta, timezone

from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer
from sqlalchemy import select
from sqlalchemy.orm import Session

from models import EmailVerificationCode, User


CODE_LIFETIME_MINUTES = 10
MAX_CODE_ATTEMPTS = 5
CODE_REQUEST_COOLDOWN_SECONDS = 60
SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 14
EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def as_utc(value: datetime) -> datetime:
    # SQLite does not preserve timezone information even for timezone-aware
    # SQLAlchemy columns. Treat its stored timestamps as UTC on retrieval.
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)


def normalize_email(email_address: str) -> str:
    email = email_address.strip().lower()
    if not EMAIL_PATTERN.fullmatch(email):
        raise ValueError("Enter a valid email address.")
    return email


def hash_code(code: str) -> str:
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", code.encode(), salt.encode(), 100_000)
    return f"{salt}${digest.hex()}"


def code_matches(code: str, stored_hash: str) -> bool:
    salt, expected_digest = stored_hash.split("$", maxsplit=1)
    candidate = hashlib.pbkdf2_hmac("sha256", code.encode(), salt.encode(), 100_000)
    return hmac.compare_digest(candidate.hex(), expected_digest)


def create_verification_code(db: Session, email_address: str) -> str:
    now = utc_now()
    latest = db.scalar(select(EmailVerificationCode).where(EmailVerificationCode.email_address == email_address).order_by(EmailVerificationCode.created_at.desc()).limit(1))
    if latest and (now - as_utc(latest.created_at)).total_seconds() < CODE_REQUEST_COOLDOWN_SECONDS:
        raise ValueError("Please wait one minute before requesting another code.")

    code = f"{secrets.randbelow(1_000_000):06d}"
    db.add(EmailVerificationCode(email_address=email_address, code_hash=hash_code(code), expires_at=now + timedelta(minutes=CODE_LIFETIME_MINUTES), created_at=now, attempt_count=0))
    db.commit()
    return code


def invalidate_latest_verification_code(db: Session, email_address: str) -> None:
    """Prevent use of a code when its email failed to send."""
    record = db.scalar(select(EmailVerificationCode).where(EmailVerificationCode.email_address == email_address).order_by(EmailVerificationCode.created_at.desc()).limit(1))
    if record and record.used_at is None:
        record.used_at = utc_now()
        db.commit()


def verify_code(db: Session, email_address: str, code: str) -> User:
    now = utc_now()
    record = db.scalar(select(EmailVerificationCode).where(EmailVerificationCode.email_address == email_address).order_by(EmailVerificationCode.created_at.desc()).limit(1))
    if not record or record.used_at or as_utc(record.expires_at) < now:
        raise ValueError("This verification code is invalid or has expired.")
    if record.attempt_count >= MAX_CODE_ATTEMPTS:
        raise ValueError("Too many incorrect attempts. Please request a new code.")

    record.attempt_count += 1
    if not code_matches(code, record.code_hash):
        db.commit()
        raise ValueError("This verification code is invalid or has expired.")

    record.used_at = now
    user = db.scalar(select(User).where(User.email_address == email_address))
    if user is None:
        user = User(email_address=email_address, first_login_time=now, last_login_time=now)
        db.add(user)
    else:
        user.last_login_time = now
    db.commit()
    db.refresh(user)
    return user


def _session_serializer() -> URLSafeTimedSerializer:
    secret = os.getenv("AUTH_SESSION_SECRET")
    if not secret:
        if os.getenv("APP_ENV", "development").lower() == "production":
            raise RuntimeError("AUTH_SESSION_SECRET must be set in production.")
        secret = "development-only-change-this-secret"
    return URLSafeTimedSerializer(secret, salt="smart-cv-matcher-session")


def create_session_token(user_id: int) -> str:
    return _session_serializer().dumps({"user_id": user_id})


def read_session_user_id(token: str | None) -> int | None:
    if not token:
        return None
    try:
        payload = _session_serializer().loads(token, max_age=SESSION_MAX_AGE_SECONDS)
        user_id = payload.get("user_id")
        return user_id if isinstance(user_id, int) else None
    except (BadSignature, SignatureExpired):
        return None

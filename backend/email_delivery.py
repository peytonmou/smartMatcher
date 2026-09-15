"""Verification-code delivery providers.

Resend is the production provider. Console delivery is deliberately opt-in for
local development only and must never be used by a deployed environment.
"""

import os

import resend


class EmailDeliveryError(Exception):
    """Raised when a verification email could not be delivered."""


def send_verification_code(email_address: str, code: str) -> None:
    mode = os.getenv("EMAIL_DELIVERY_MODE", "resend").lower()

    if mode == "console":
        print(f"[AUTH DEVELOPMENT] Verification code for {email_address}: {code}")
        return
    if mode != "resend":
        raise EmailDeliveryError("Email delivery is not configured.")

    api_key = os.getenv("RESEND_API_KEY")
    sender = os.getenv("RESEND_FROM_EMAIL")
    if not api_key or not sender:
        raise EmailDeliveryError("Email delivery is not configured.")

    resend.api_key = api_key
    try:
        resend.Emails.send(
            {
                "from": sender,
                "to": [email_address],
                "subject": "Your Smart CV Matcher sign-in code",
                "html": f"""
                    <div style=\"font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;\">
                      <h2>Sign in to Smart CV Matcher</h2>
                      <p>Your verification code is:</p>
                      <p style=\"font-size: 28px; font-weight: 700; letter-spacing: 6px;\">{code}</p>
                      <p>This code expires in 10 minutes. Do not share it with anyone.</p>
                    </div>
                """,
                "text": f"Your Smart CV Matcher verification code is {code}. It expires in 10 minutes. Do not share it with anyone.",
            }
        )
    except Exception as error:
        # Do not expose provider details or credentials to the browser.
        print(f"[AUTH] Resend delivery failed: {error}")
        raise EmailDeliveryError("We could not send a verification email. Please try again shortly.") from error

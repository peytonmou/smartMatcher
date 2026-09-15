"""Create authentication tables.

Revision ID: 20260911_01
Revises:
Create Date: 2026-09-11
"""

from alembic import op
import sqlalchemy as sa


revision = "20260911_01"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("user_id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("email_address", sa.String(length=320), nullable=False),
        sa.Column("first_login_time", sa.DateTime(timezone=True), nullable=False),
        sa.Column("last_login_time", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_users_user_id", "users", ["user_id"])
    op.create_index("ix_users_email_address", "users", ["email_address"], unique=True)
    op.create_table(
        "email_verification_codes",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("email_address", sa.String(length=320), nullable=False),
        sa.Column("code_hash", sa.String(length=256), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("attempt_count", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_email_verification_codes_email_address", "email_verification_codes", ["email_address"])


def downgrade() -> None:
    op.drop_index("ix_email_verification_codes_email_address", table_name="email_verification_codes")
    op.drop_table("email_verification_codes")
    op.drop_index("ix_users_email_address", table_name="users")
    op.drop_index("ix_users_user_id", table_name="users")
    op.drop_table("users")

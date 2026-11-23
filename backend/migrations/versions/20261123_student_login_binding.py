"""Bind student portal accounts to student records.
Revision ID: 20261123_student_login_binding
Revises: 20261115_therapy_duration_bounds
Create Date: 2026-11-23
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
revision: str = "20261123_student_login_binding"
down_revision: Union[str, Sequence[str], None] = "20261115_therapy_duration_bounds"
branch_labels = None
depends_on = None
def upgrade() -> None:
    op.add_column("students", sa.Column("login_user_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.create_foreign_key("fk_students_login_user_id_users", "students", "users", ["login_user_id"], ["id"], ondelete="SET NULL")
    op.create_index("ix_students_login_user_id", "students", ["login_user_id"], unique=True)
def downgrade() -> None:
    op.drop_index("ix_students_login_user_id", table_name="students")
    op.drop_constraint("fk_students_login_user_id_users", "students", type_="foreignkey")
    op.drop_column("students", "login_user_id")

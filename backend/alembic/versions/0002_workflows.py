"""Add durable version, year and demo workflow records."""

from alembic import op
from app.models import AcademicYear, DemoSession, RecordVersion

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade():
    for table in (
        AcademicYear.__table__,
        DemoSession.__table__,
        RecordVersion.__table__,
    ):
        table.create(op.get_bind(), checkfirst=True)


def downgrade():
    raise RuntimeError("Restore a verified backup instead of destructive downgrade.")

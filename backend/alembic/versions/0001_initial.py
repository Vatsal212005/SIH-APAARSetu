"""Initial normalized registry, consent and operational schema."""

from alembic import op
from app.database import Base
from app import models  # noqa: F401

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    Base.metadata.create_all(bind=op.get_bind())


def downgrade():
    raise RuntimeError(
        "Destructive downgrade disabled. Restore a verified backup instead."
    )

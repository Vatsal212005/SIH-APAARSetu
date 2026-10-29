"""Reproducible hold-out evaluation; synthetic results do not establish production accuracy."""

import json
import sys
import time
from pathlib import Path
import numpy as np
from sklearn.ensemble import IsolationForest
from sklearn.metrics import precision_recall_fscore_support, confusion_matrix

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))
from app.services.validation import valid_apaar_format  # noqa: E402


def metrics(expected, predicted):
    precision, recall, f1, _ = precision_recall_fscore_support(
        expected, predicted, average="binary", zero_division=0
    )
    tn, fp, fn, tp = confusion_matrix(expected, predicted, labels=[0, 1]).ravel()
    return dict(
        precision=float(precision),
        recall=float(recall),
        f1=float(f1),
        true_negatives=int(tn),
        false_positives=int(fp),
        false_negatives=int(fn),
        true_positives=int(tp),
        confusion_matrix=[[int(tn), int(fp)], [int(fn), int(tp)]],
    )


rng = np.random.default_rng(26263)
train = rng.normal([0.65, 0.04, 0.025, 0.01], [0.08, 0.01, 0.008, 0.004], size=(500, 4))
normal = rng.normal(
    [0.65, 0.04, 0.025, 0.01], [0.08, 0.01, 0.008, 0.004], size=(200, 4)
)
outliers = rng.normal([1.25, 0.3, 0.2, 0.18], [0.12, 0.04, 0.04, 0.03], size=(40, 4))
start = time.perf_counter()
model = IsolationForest(n_estimators=160, contamination=0.06, random_state=26263).fit(
    train
)
predictions = (model.predict(np.vstack([normal, outliers])) == -1).astype(int)
result = {
    "synthetic_only": True,
    "seed": 26263,
    "training_rows": 500,
    "holdout_rows": 240,
    "statistical": metrics([0] * 200 + [1] * 40, predictions),
    "model_latency_ms": round((time.perf_counter() - start) * 1000, 3),
}
cases = [
    ("123456789012", 0),
    ("", 1),
    ("1234", 1),
    ("12345678901x", 1),
    ("700000000001", 0),
]
start = time.perf_counter()
result["deterministic_format"] = metrics(
    [v for _, v in cases], [int(not valid_apaar_format(x)) for x, _ in cases]
)
result["validation_latency_ms"] = round((time.perf_counter() - start) * 1000, 3)
from sqlalchemy import create_engine, select  # noqa: E402
from sqlalchemy.orm import Session  # noqa: E402
from app.database import Base  # noqa: E402
from app.models import ApprovedIntake, CapacityPolicy, User  # noqa: E402
from app.services.seed import seed_demo, sid  # noqa: E402
from app.services.validation import validate_student_row  # noqa: E402
from app.services.imports import process_import  # noqa: E402

engine = create_engine("sqlite://")
Base.metadata.create_all(engine)
with Session(engine, expire_on_commit=False) as db:
    seed_demo(db, student_count=150, institution_count=10)
    data = {
        "apaar_id": "700000000000",
        "full_name": "Aarav Synthetic Student 0001",
        "institution_student_id": "EVAL-CROSS",
        "programme_id": sid("programme", "2:BTECH-CSE"),
    }
    expected = []
    observed = []
    for year, label in [("2025-26", 1), ("2024-25", 0), ("2026-27", 0)]:
        expected.append(label)
        observed.append(
            int(
                any(
                    "cross-institution" in flag
                    for flag in validate_student_row(
                        db, data, sid("institution", "2"), year
                    ).flags
                )
            )
        )
    intake = db.scalar(
        select(ApprovedIntake).where(
            ApprovedIntake.programme_id == data["programme_id"],
            ApprovedIntake.academic_year == "2025-26",
        )
    )
    policy = db.get(CapacityPolicy, intake.policy_id)
    policy.rules = {**policy.rules, "allow_concurrent_enrolment": True}
    db.flush()
    expected.append(0)
    observed.append(
        int(
            any(
                "cross-institution" in flag
                for flag in validate_student_row(
                    db, data, sid("institution", "2"), "2025-26"
                ).flags
            )
        )
    )
    result["cross_institution"] = metrics(expected, observed)
    user = db.scalar(select(User).where(User.role == "institution_operator"))
    content = "apaar_id,full_name,institution_student_id,admission_date\n" + "".join(
        f"{790000000000 + i},Synthetic Evaluation Student {i},EVAL-{i},2025-08-01\n"
        for i in range(200)
    )
    start = time.perf_counter()
    receipt = process_import(
        db,
        content.encode(),
        "evaluation.csv",
        sid("institution", "0"),
        sid("programme", "0:MBA"),
        "2025-26",
        user,
    )
    result["import_processing_ms"] = round((time.perf_counter() - start) * 1000, 3)
    result["import_rows"] = 200
    result["import_counts"] = receipt["counts"]
result["limitations"] = (
    "Synthetic distributions only. Cross-institution evaluation uses four labelled scenarios and format validation five cases; neither small set establishes real-world accuracy."
)
dataset_dir = Path(__file__).resolve().parents[1] / "demo-data" / "evaluation"
dataset_dir.mkdir(parents=True, exist_ok=True)
np.savetxt(
    dataset_dir / "training.csv",
    train,
    delimiter=",",
    header="utilization,supernumerary_ratio,nri_ratio,flagged_ratio",
    comments="",
)
np.savetxt(
    dataset_dir / "holdout-labelled.csv",
    np.column_stack([np.vstack([normal, outliers]), [0] * 200 + [1] * 40]),
    delimiter=",",
    header="utilization,supernumerary_ratio,nri_ratio,flagged_ratio,expected_outlier",
    comments="",
)
destination = Path(__file__).resolve().parents[1] / "docs" / "evaluation.json"
destination.parent.mkdir(exist_ok=True)
destination.write_text(json.dumps(result, indent=2), encoding="utf-8")
print(json.dumps(result, indent=2))

from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path

import numpy as np
import pandas as pd


ROOT = Path(__file__).resolve().parents[2]
PRIVATE_ROOT = Path(
    os.environ.get("DURIAN_DATA_ROOT", ROOT / "private_data")
).expanduser().resolve()
OUT = Path(
    os.environ.get("DURIAN_OUTPUT_ROOT", ROOT / "outputs" / "runs")
).expanduser().resolve() / "derived_statistics"

CLASS_NAMES = [
    "Built-up/Bare soil", "Durian", "Forest", "Other agriculture",
    "Oil palm", "Rubber", "Water",
]
SEED = 20260813
N_BOOTSTRAP = 5000

PREDICTION_FILES = {
    "E1_RF": PRIVATE_ROOT / "03_RESULTS/E1/RF/RF_grouped_validation_20260623_153912_UTC/tables/oof_polygon_predictions.csv",
    "E1_XGBoost": PRIVATE_ROOT / "03_RESULTS/E1/XGBoost/XGBoost_grouped_validation_20260624_run01/tables/oof_polygon_predictions.csv",
    "E1_SVM": PRIVATE_ROOT / "03_RESULTS/E1/SVM/SVM_grouped_validation_20260624_run01/tables/oof_polygon_predictions.csv",
    "E2_fixed_S2_R1": PRIVATE_ROOT / "06_CODE/TARGETED_REVISION/E2_VERIFICATION_OUTPUTS/tables/fixed_R1_oof_polygon_predictions.csv",
    "E3_frozen_Bentong_to_Pahang": PRIVATE_ROOT / "03_RESULTS/E3/Pahang_external_and_analysis/pahang_svm_result_analysis/external_extracted/Pahang_S2_external_validation_20260712_run01/tables/pahang_polygon_predictions.csv",
    "E5_Pahang_grouped": PRIVATE_ROOT / "03_RESULTS/E5/Pahang_grouped_SVM/Pahang_S2_SVM_grouped_validation_20260712_run01/tables/oof_polygon_predictions.csv",
}
CENTROIDS_PATH = PRIVATE_ROOT / "05_FIGURES/FINAL_SOURCE_DATA/Figure_1_exact_reference_centroids.csv"
E1_SELECTION_DIRS = {
    "RF": PRIVATE_ROOT / "03_RESULTS/E1/RF/RF_grouped_validation_20260623_153912_UTC/tables",
    "XGBoost": PRIVATE_ROOT / "03_RESULTS/E1/XGBoost/XGBoost_grouped_validation_20260624_run01/tables",
    "SVM": PRIVATE_ROOT / "03_RESULTS/E1/SVM/SVM_grouped_validation_20260624_run01/tables",
}
SVM_TABLE_DIR = E1_SELECTION_DIRS["SVM"]


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            h.update(block)
    return h.hexdigest()


def require_external_inputs(paths: list[Path]) -> None:
    missing = [path for path in paths if not path.is_file()]
    if missing:
        missing_list = "\n".join(f"- {path}" for path in missing)
        raise FileNotFoundError(
            "Required external input(s) are not included in the public repository.\n"
            "Provide the authorized project data root through DURIAN_DATA_ROOT.\n"
            f"Missing:\n{missing_list}"
        )


def metric_vector(y_true: np.ndarray, y_pred: np.ndarray) -> dict[str, float]:
    cm = np.zeros((7, 7), dtype=np.int64)
    np.add.at(cm, (y_true, y_pred), 1)
    support = cm.sum(axis=1)
    predicted = cm.sum(axis=0)
    tp = np.diag(cm).astype(float)
    precision = np.divide(tp, predicted, out=np.zeros(7), where=predicted > 0)
    recall = np.divide(tp, support, out=np.zeros(7), where=support > 0)
    f1 = np.divide(2 * precision * recall, precision + recall, out=np.zeros(7), where=(precision + recall) > 0)
    total = int(support.sum())
    result = {
        "OA": float(tp.sum() / total),
        "balanced_accuracy": float(recall.mean()),
        "macro_F1": float(f1.mean()),
        "weighted_F1": float(np.average(f1, weights=support)),
    }
    result.update({f"F1_{name}": float(value) for name, value in zip(CLASS_NAMES, f1)})
    return result


def read_prediction_frame(path: Path) -> pd.DataFrame:
    frame = pd.read_csv(path, low_memory=False)
    true_column = "true_class_id" if "true_class_id" in frame.columns else "class_id"
    required = ["sample_uid", "group_uid", true_column, "pred_class_id"]
    missing = [name for name in required if name not in frame.columns]
    if missing:
        raise ValueError(f"{path}: missing columns {missing}")
    frame = frame[required].rename(columns={true_column: "true_class_id"}).copy()
    frame["true_class_id"] = frame["true_class_id"].astype(int)
    frame["pred_class_id"] = frame["pred_class_id"].astype(int)
    if frame["sample_uid"].duplicated().any():
        raise ValueError(f"{path}: duplicate sample_uid")
    if not set(frame["true_class_id"]).issubset(set(range(7))):
        raise ValueError(f"{path}: unexpected class IDs")
    return frame


def bootstrap_intervals(frame: pd.DataFrame, seed: int) -> tuple[list[dict], list[dict]]:
    point = metric_vector(frame["true_class_id"].to_numpy(), frame["pred_class_id"].to_numpy())
    group_to_rows = {
        group: rows.to_numpy()
        for group, rows in frame.groupby("group_uid", sort=True).groups.items()
    }
    groups = np.asarray(list(group_to_rows), dtype=object)
    rng = np.random.default_rng(seed)
    metric_names = list(point)
    draws = np.empty((N_BOOTSTRAP, len(metric_names)), dtype=float)
    true = frame["true_class_id"].to_numpy()
    pred = frame["pred_class_id"].to_numpy()
    for replicate in range(N_BOOTSTRAP):
        sampled_groups = rng.choice(groups, size=len(groups), replace=True)
        sampled_rows = np.concatenate([group_to_rows[group] for group in sampled_groups])
        values = metric_vector(true[sampled_rows], pred[sampled_rows])
        draws[replicate] = [values[name] for name in metric_names]
    point_rows = [{"metric": name, "estimate": value} for name, value in point.items()]
    interval_rows = []
    for index, name in enumerate(metric_names):
        lower, median, upper = np.quantile(draws[:, index], [0.025, 0.5, 0.975])
        interval_rows.append({
            "metric": name,
            "estimate": point[name],
            "bootstrap_median": float(median),
            "ci_2.5_percent": float(lower),
            "ci_97.5_percent": float(upper),
        })
    return point_rows, interval_rows


required_external_inputs = [
    *PREDICTION_FILES.values(),
    CENTROIDS_PATH,
    *(base / "nested_selected_candidates.csv" for base in E1_SELECTION_DIRS.values()),
    SVM_TABLE_DIR / "feature_set_summary.csv",
    SVM_TABLE_DIR / "final_candidate_scores.csv",
]
require_external_inputs(required_external_inputs)
OUT.mkdir(parents=True, exist_ok=True)

point_rows: list[dict] = []
interval_rows: list[dict] = []
manifest = {
    "analysis": "group-level nonparametric bootstrap of retained polygon predictions",
    "seed": SEED,
    "replicates": N_BOOTSTRAP,
    "sampling_unit": "group_uid; groups sampled with replacement and all member polygons retained",
    "interval": "percentile 95% interval",
    "interpretation": "conditional on the retained labels, grouping, fitted workflow and prediction set; not design-based statewide uncertainty",
    "inputs": {},
}
for offset, (experiment, path) in enumerate(PREDICTION_FILES.items()):
    frame = read_prediction_frame(path)
    points, intervals = bootstrap_intervals(frame, SEED + offset)
    for row in points:
        point_rows.append({"experiment": experiment, **row})
    for row in intervals:
        interval_rows.append({"experiment": experiment, **row})
    manifest["inputs"][experiment] = {
        "path": str(path.relative_to(PRIVATE_ROOT)),
        "sha256": sha256(path),
        "polygons": int(len(frame)),
        "groups": int(frame["group_uid"].nunique()),
    }

pd.DataFrame(point_rows).to_csv(OUT / "polygon_metric_point_estimates.csv", index=False)
pd.DataFrame(interval_rows).to_csv(OUT / "group_bootstrap_intervals.csv", index=False)

# Class-specific sample distribution from the exact, user-approved centroid table.
centroids = pd.read_csv(CENTROIDS_PATH)
distribution = (
    centroids.groupby(["class", "domain"], sort=False)
    .agg(polygons=("sample_uid", "nunique"), groups=("group_uid", "nunique"))
    .reset_index()
)
wide = distribution.pivot(index="class", columns="domain", values=["polygons", "groups"])
wide = wide.reindex(CLASS_NAMES)
wide.columns = [f"{domain}_{measure}" for measure, domain in wide.columns]
wide = wide.reset_index().rename(columns={"class": "Class"})
wide.to_csv(OUT / "class_specific_sample_distribution.csv", index=False)
manifest["class_distribution_input"] = {
    "path": str(CENTROIDS_PATH.relative_to(PRIVATE_ROOT)),
    "sha256": sha256(CENTROIDS_PATH),
}

# Transparent summary of nested fold selections and the full-Bentong staged choice.
selection_rows = []
for family, base in E1_SELECTION_DIRS.items():
    selected = pd.read_csv(base / "nested_selected_candidates.csv")
    counts = selected["selected_feature_set"].value_counts()
    for feature_set, count in counts.items():
        selection_rows.append({
            "evidence_scope": "E1 nested outer-fold inner selections",
            "model_family": family,
            "feature_set": feature_set,
            "selected_outer_folds": int(count),
            "total_outer_folds": int(len(selected)),
            "selection_priority": "polygon Durian F1, then polygon macro-F1, then weighted pixel Durian F1",
        })

feature_scores = pd.read_csv(SVM_TABLE_DIR / "feature_set_summary.csv")
for _, row in feature_scores.iterrows():
    selection_rows.append({
        "evidence_scope": "full-Bentong grouped SVM feature screening",
        "model_family": "SVM",
        "feature_set": row["feature_set"],
        "selected_outer_folds": "selected" if row["feature_set"] == "S2" else "not selected",
        "total_outer_folds": 5,
        "selection_priority": (
            f"polygon Durian F1 mean={row['polygon_durian_f1_mean']:.6f}; "
            f"polygon macro-F1 mean={row['polygon_macro_f1_mean']:.6f}"
        ),
    })
candidate_scores = pd.read_csv(SVM_TABLE_DIR / "final_candidate_scores.csv")
for _, row in candidate_scores.iterrows():
    selection_rows.append({
        "evidence_scope": "full-Bentong grouped SVM candidate screening within S2",
        "model_family": "SVM",
        "feature_set": row["candidate_id"],
        "selected_outer_folds": "selected" if row["candidate_id"] == "R1" else "not selected",
        "total_outer_folds": 5,
        "selection_priority": (
            f"polygon Durian F1 mean={row['polygon_durian_f1_mean']:.6f}; "
            f"polygon macro-F1 mean={row['polygon_macro_f1_mean']:.6f}"
        ),
    })
pd.DataFrame(selection_rows).to_csv(OUT / "feature_selection_evidence.csv", index=False)

(OUT / "derivation_manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
print(json.dumps({
    "output": str(OUT),
    "experiments": list(PREDICTION_FILES),
    "bootstrap_replicates": N_BOOTSTRAP,
    "point_rows": len(point_rows),
    "interval_rows": len(interval_rows),
}, indent=2))

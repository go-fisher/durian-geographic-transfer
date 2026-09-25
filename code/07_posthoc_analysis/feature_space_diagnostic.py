from __future__ import annotations

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
).expanduser().resolve() / "feature_space_diagnostic"

FEATURES = [
    "B3", "B4", "B5", "B6", "B7", "B8", "B8A", "B11", "B12",
    "NDVI", "NDRE", "NDWI", "EVI",
]
BENTONG_ROWS = PRIVATE_ROOT / "00_AUDIT_REPORTS/_TARGETED_REVISION_WORK/inputs/training_rows_used.csv"
BENTONG_RAW = PRIVATE_ROOT / "04_METHODS_CODE/REFERENCE_DATA/RAW_INPUTS/Bentong_pixel_samples_2025_v1.csv"
BENTONG_PRED = PRIVATE_ROOT / "06_CODE/TARGETED_REVISION/E2_VERIFICATION_OUTPUTS/tables/fixed_S2_R1_oof_pixel_predictions.csv"
PAHANG_RAW = PRIVATE_ROOT / "04_METHODS_CODE/REFERENCE_DATA/RAW_INPUTS/Pahang_without_Bentong_S2_pixel_samples_2025_v1.csv"
PAHANG_PRED = PRIVATE_ROOT / "03_RESULTS/E3/Pahang_external_and_analysis/pahang_svm_result_analysis/external_extracted/Pahang_S2_external_validation_20260712_run01/tables/pahang_pixel_predictions.csv"
INPUT_PATHS = [BENTONG_ROWS, BENTONG_RAW, BENTONG_PRED, PAHANG_RAW, PAHANG_PRED]


def require_external_inputs(paths: list[Path]) -> None:
    missing = [path for path in paths if not path.is_file()]
    if missing:
        missing_list = "\n".join(f"- {path}" for path in missing)
        raise FileNotFoundError(
            "Required external input(s) are not included in the public repository.\n"
            "Provide the authorized project data root through DURIAN_DATA_ROOT.\n"
            f"Missing:\n{missing_list}"
        )


require_external_inputs(INPUT_PATHS)
OUT.mkdir(parents=True, exist_ok=True)


def normalise_class(series: pd.Series) -> pd.Series:
    return series.replace({"Mixed agriculture": "Other agriculture"})


def retained_pahang() -> pd.DataFrame:
    ids = pd.read_csv(PAHANG_PRED, usecols=["pixel_uid", "sample_uid", "group_uid", "class_lv2"])
    ids["class_lv2"] = normalise_class(ids["class_lv2"])
    wanted = set(ids["pixel_uid"])
    chunks = []
    for chunk in pd.read_csv(PAHANG_RAW, usecols=["pixel_uid", *FEATURES], chunksize=100_000, low_memory=False):
        selected = chunk.loc[chunk["pixel_uid"].isin(wanted)]
        if len(selected):
            chunks.append(selected)
    features = pd.concat(chunks, ignore_index=True)
    frame = ids.merge(features, on="pixel_uid", how="left", validate="one_to_one")
    if frame[FEATURES].isna().any().any() or len(frame) != 59_975:
        raise RuntimeError("Pahang retained predictor reconstruction failed")
    frame["domain"] = "Pahang outside Bentong"
    return frame


def retained_bentong() -> pd.DataFrame:
    ids = pd.read_csv(BENTONG_PRED, usecols=["pixel_uid", "sample_uid", "group_uid", "class_id"])
    wanted = set(ids["pixel_uid"])
    chunks = []
    for chunk in pd.read_csv(BENTONG_RAW, usecols=["pixel_uid", "class_lv2", *FEATURES], chunksize=100_000, low_memory=False):
        selected = chunk.loc[chunk["pixel_uid"].isin(wanted)]
        if len(selected):
            chunks.append(selected)
    rows = pd.concat(chunks, ignore_index=True)
    rows["class_lv2"] = normalise_class(rows["class_lv2"])
    frame = ids.merge(rows, on="pixel_uid", how="left", validate="one_to_one")
    if frame[FEATURES].isna().any().any() or len(frame) != 37_724:
        raise RuntimeError("Bentong retained predictor reconstruction failed")
    frame["domain"] = "Bentong"
    return frame


pixels = pd.concat([retained_bentong(), retained_pahang()], ignore_index=True)
polygons = (
    pixels.groupby(["domain", "sample_uid", "group_uid", "class_lv2"], as_index=False)[FEATURES]
    .mean()
)
matrix = polygons[FEATURES].to_numpy(dtype=float)
means = matrix.mean(axis=0)
stds = matrix.std(axis=0, ddof=0)
if np.any(stds == 0):
    raise RuntimeError("Zero-variance diagnostic predictor")
z = (matrix - means) / stds
_, singular_values, vt = np.linalg.svd(z, full_matrices=False)
scores = z @ vt[:2].T
explained = singular_values**2 / np.sum(singular_values**2)
polygons["PC1"] = scores[:, 0]
polygons["PC2"] = scores[:, 1]
polygons.to_csv(OUT / "polygon_mean_pca_scores.csv", index=False)

loadings = pd.DataFrame({
    "feature": FEATURES,
    "PC1_loading": vt[0],
    "PC2_loading": vt[1],
    "combined_standardisation_mean": means,
    "combined_standardisation_sd": stds,
})
loadings.to_csv(OUT / "pca_loadings.csv", index=False)

domain_means = polygons.groupby("domain")[FEATURES].mean()
standardised_shift = (
    domain_means.loc["Pahang outside Bentong"].to_numpy()
    - domain_means.loc["Bentong"].to_numpy()
) / stds
shift = pd.DataFrame({
    "feature": FEATURES,
    "standardised_mean_shift_Pahang_minus_Bentong": standardised_shift,
    "absolute_standardised_shift": np.abs(standardised_shift),
}).sort_values("absolute_standardised_shift", ascending=False)
shift.to_csv(OUT / "source_target_standardised_mean_shifts.csv", index=False)

class_shift_rows = []
for class_name, subset in polygons.groupby("class_lv2", sort=False):
    class_domain_means = subset.groupby("domain")[FEATURES].mean()
    if {"Bentong", "Pahang outside Bentong"}.issubset(class_domain_means.index):
        vector = (
            class_domain_means.loc["Pahang outside Bentong"].to_numpy()
            - class_domain_means.loc["Bentong"].to_numpy()
        ) / stds
        class_shift_rows.append({
            "class": class_name,
            "rms_standardised_feature_shift": float(np.sqrt(np.mean(vector**2))),
            "maximum_absolute_standardised_feature_shift": float(np.max(np.abs(vector))),
            "feature_with_maximum_shift": FEATURES[int(np.argmax(np.abs(vector)))],
        })
pd.DataFrame(class_shift_rows).sort_values(
    "rms_standardised_feature_shift", ascending=False
).to_csv(OUT / "class_specific_source_target_feature_shifts.csv", index=False)

manifest = {
    "role": "descriptive source-target diagnostic; no model selection, refitting or E3 prediction change",
    "unit": "polygon mean of the exact retained pixel rows",
    "features": FEATURES,
    "polygons": int(len(polygons)),
    "domains": polygons.groupby("domain")["sample_uid"].nunique().to_dict(),
    "explained_variance_ratio": {"PC1": float(explained[0]), "PC2": float(explained[1])},
    "standardisation": "combined-domain polygon means, population standard deviation; used only for this diagnostic",
    "inputs": [str(path.relative_to(PRIVATE_ROOT)) for path in INPUT_PATHS],
}
(OUT / "feature_space_manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
print(json.dumps(manifest, indent=2))

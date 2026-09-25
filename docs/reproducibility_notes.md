# Reproducibility audit

## Confirmed

- **Grouped validation is implemented.** Retained E1, E2, and E5 notebooks use `group_uid` in grouped folds and contain assertions that groups do not cross train/validation partitions.
- **Polygon reporting is explicit.** `sample_uid` identifies polygons, and polygon predictions are formed from pixel predictions or multiclass decision scores before formal polygon metrics are calculated.
- **Training-only scaling is implemented for SVM.** The retained SVM workflows place `StandardScaler` inside the fitted pipeline or fit it within each training split.
- **E3 is the principal independent geographic-transfer evaluation.** The retained notebook is designed to load the frozen bundle, verify predictor order and input hashes, apply the model without target fitting, and check the locked metrics and confusion matrix. Direct execution requires authorised Pahang data and the fitted bundle, which is excluded from the initial release pending approval.
- **E2 is post-selection.** The fixed S2+R1 benchmark reuses the original five outer folds with no additional feature or candidate selection. It must not be described as independent source validation.
- **E5 is not external validation.** Pahang labels are used in grouped target-domain model development.
- **Class naming has two layers.** Raw/model artefacts use `Mixed agriculture`; current reporting uses `Other agriculture` for encoded class 3. Numeric class IDs remain unchanged.
- **E4 is only partially executable end to end.** Shared code components and complete outputs/metadata exist, but no self-contained five-feature generator was retained.
- **Exact geographic data are present in the source.** Raw CSVs include longitude/latitude, exact-centroid tables are retained, and shapefiles and context rasters exist. They are excluded here.
- **The original notebooks contained personal execution metadata and local/Colab paths.** The copied notebooks have outputs and personal execution metadata removed and use environment-configured roots.
- **The original GEE scripts contained private project asset IDs.** The copies use `projects/YOUR_GEE_PROJECT/assets/...` placeholders.

## Possible

- **Residual cross-class spatial dependence.** Grouping was performed within class, so nearby polygons of different classes can retain different group IDs. The manuscript already treats this as a limitation.
- **Notebook execution-order dependency.** XGBoost and SVM notebooks reuse RF-prepared rows and folds; E2 reuses archived outer folds; later notebooks expect earlier run folders. Running isolated cells or changing directory names can break provenance checks.
- **Separate preprocessing scripts can drift.** Bentong and Pahang S2 feature builders are intended to be identical, but duplicated functions should be regression-compared after any future edit.
- **Serialization compatibility.** The model was recorded with scikit-learn 1.6.1 and joblib 1.5.3. Other versions may deserialize successfully but are not guaranteed to reproduce byte-identical secondary pixel metrics. See `docs/environment_compatibility.md` for the complete recorded/unknown distinction.
- **Random seeds differ by analytical purpose.** Fixed seeds and deterministic per-sample subsampling are visible in the notebooks. No evidence was found that a seed difference changes the intended partition, but any refactor should preserve the original constants and offsets.
- **Output provenance is layered.** Some final figures/tables are generated from derived aggregate files rather than directly from raw observations. The source-map records this, but future maintainers must retain the intermediate provenance.

## Requires author review

- Decide whether the frozen `joblib` bundle may be released in a later phase; it is excluded from the initial release.
- Decide whether exact package versions should be captured in a lock file or environment YAML for archival reproduction.
- Confirm the final public wording for E4’s partial executable support.
- Confirm whether any generalised study-area boundary data may be released under its source licence.
- Confirm repository licence, authors, citation metadata, DOI, and public URL.
- Confirm whether aggregate `sample_uid`-free tables are sufficient for the intended journal reproducibility statement.

## Checks requested by the publication workflow

| Check | Finding |
|---|---|
| Train-test leakage | No confirmed leakage in retained grouped implementations; explicit disjoint-group assertions are present. |
| Spatial leakage | Known same-group splitting is prevented. Residual cross-class proximity remains possible. |
| Pixel-level splitting | Formal partitions are group/polygon based; pixel rows inherit polygon folds. |
| `group_uid` handling | Consistency checks and fold-isolation assertions are present. |
| `sample_uid` handling | Polygon uniqueness and aggregation checks are present. |
| Random seeds | Fixed values are present; preserve them. |
| Class mappings | Raw/display-name difference is confirmed and documented. |
| Feature names/order | E3 explicitly checks the 13 ordered S2 predictors against the bundle. |
| Bentong/Pahang preprocessing | Intended to match for S2; separate code copies are a maintenance risk. |
| Scaling | SVM scaling is fit within training data; E3 uses the frozen scaler. |
| Missing values | Required predictors are coerced and missing/invalid rows are dropped or rejected; no sentinel fill value is introduced. |
| Model serialization | Manifest and SHA-256 are retained; cross-version behaviour remains a compatibility risk. |
| Notebook order | Historical run-folder dependencies are confirmed. |
| Hard-coded paths | Present in source; removed or parameterised in copied files. |
| Dependencies | Inferred from retained imports and documented in `requirements.txt`. |
| Disconnected outputs | E4 outputs lack a self-contained generator; older manuscript and audit variants are historical/duplicate candidates. |

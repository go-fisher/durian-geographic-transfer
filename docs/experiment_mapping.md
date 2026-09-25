# Experiment mapping

This mapping follows the final consistency manuscript, the later code-and-result asset audit, and the E2 verification report. Older documents that describe E2 as missing are superseded by the later verification.

## E1

- **Purpose:** Compare complete RF, XGBoost, and SVM model-development pipelines under nested grouped validation in Bentong.
- **Source notebooks:** `04_METHODS_CODE/PYTHON/geecode_result_colab/“02_RF_grouped_validation.ipynb”的副本`, `“03_XGBoost_grouped_validation.ipynb”的副本`, and `“04_SVM_grouped_validation.ipynb”的副本`.
- **Repository files:** `code/04_model_development/01_rf_grouped_validation.ipynb`, `02_xgboost_grouped_validation.ipynb`, and `03_svm_grouped_validation.ipynb`.
- **Inputs:** Authorised Bentong pixel table; retained polygon/sample/group identifiers; shared outer folds; the five predefined feature groups.
- **Outputs:** Nested outer-fold metrics, pooled OOF predictions, confusion matrices, selected candidates, and model manifests.
- **Major metric:** SVM pipeline polygon OA = 0.850987… (reported as 0.851).
- **Role:** Primary analysis.
- **Uncertainty:** The public copy excludes row-level inputs and OOF predictions because they retain reference identifiers.

## E2

- **Purpose:** Evaluate the already selected S2+R1 configuration across the original five Bentong outer folds without further selection.
- **Source notebook:** `99_ARCHIVE_ORIGINALS/E2_Bentong_fixed_S2_R1_grouped_OOF.ipynb`.
- **Repository file:** `code/05_bentong_benchmark/E2_Bentong_fixed_S2_R1_grouped_OOF.ipynb`.
- **Inputs:** Authorised retained Bentong rows, frozen S2+R1 specification, and archived E1 fold assignments.
- **Outputs:** Fixed-fold metrics, OOF polygon predictions, classification report, and 7 × 7 confusion matrix.
- **Major metric:** Polygon OA = 0.854578… (reported as 0.855).
- **Role:** Primary analysis; post-selection conditional source-domain benchmark.
- **Uncertainty:** None in mapping. A later audit reproduced all formal polygon metrics and all 557 polygon predictions. Small version-dependent differences were noted only for secondary pixel-level precision/F1 values.

## E3

- **Purpose:** Apply the frozen Bentong S2+R1 model once to Pahang outside Bentong without target-domain fitting.
- **Source notebook:** `E3_Bentong_frozen_S2_R1_to_Pahang_external_validation.ipynb` (current reconstructed and locked-checking version). The older `Copy of 05_Pahang_S2_external_validation.ipynb` is a duplicate/historical predecessor.
- **Repository file:** `code/06_external_transfer/E3_Bentong_frozen_S2_R1_to_Pahang_external_validation.ipynb`.
- **Inputs:** Frozen model bundle and authorised Pahang S2 pixel table with matching feature order.
- **Outputs:** Pixel and polygon predictions, confusion matrices, classification reports, E2/E3 descriptive comparison, and run manifest.
- **Major metrics:** OA = 0.703988…; Durian F1 = 0.716814…; Rubber F1 = 0.381443….
- **Role:** Primary independent geographic-transfer evaluation.
- **Uncertainty:** The raw and row-level outputs are excluded from this repository because they contain exact-location fields or reference-linked identifiers.

## E4

- **Purpose:** Compare five predefined feature groups while holding the R1 classifier candidate fixed.
- **Source support:** Shared executable components in the retained SVM notebook plus complete aggregate outputs and metadata in `03_RESULTS/E4/` and archived fixed-R1 directories.
- **Repository files:** `code/04_model_development/03_svm_grouped_validation.ipynb` and aggregate `outputs/tables/Figure_S4_E4_feature_sensitivity.csv`.
- **Inputs:** Authorised Bentong retained rows, original folds, fixed R1 parameters, and five feature groups.
- **Outputs:** Feature-group summary, fold metrics, predictions, and the S2 confusion matrix in the source archive; only aggregate summaries are published here.
- **Major metric:** Feature-group OA values reported in the retained E4 summary; S2 OA = 0.854578… and S2_S1 OA = 0.897666… in this post-hoc fixed-R1 sensitivity.
- **Role:** Supplementary post-hoc analysis; it did not reselect or replace the frozen model.
- **Uncertainty:** **Requires author awareness.** No self-contained block that regenerates the complete five-feature E4 deliverable set was retained. Status: partial executable support, not full end-to-end reproducibility.

## E5

- **Purpose:** Test grouped target-domain learnability after Pahang labels enter model development.
- **Source notebook:** `04_METHODS_CODE/PYTHON/geecode_result_colab/Copy of 06_Pahang_S2_SVM_grouped_validation.ipynb`.
- **Repository file:** `code/07_posthoc_analysis/E5_E6_Pahang_grouped_SVM.ipynb`.
- **Inputs:** Authorised Pahang S2 pixel table; 652 polygons; 268 groups; 13 S2 predictors.
- **Outputs:** Nested grouped OOF predictions, fold results, selected candidates, confusion matrices, and manifest.
- **Major metric:** Polygon OA = 0.835890… (reported as 0.836).
- **Role:** Primary target-domain diagnostic analysis, but not external validation.
- **Uncertainty:** None in mapping. Row-level outputs are excluded for privacy.

## E6

- **Purpose:** Examine sensitivity of Pahang grouped modelling to reduced Rubber training quantity and spatial-group coverage.
- **Source notebook:** Implemented inside `Copy of 06_Pahang_S2_SVM_grouped_validation.ipynb`.
- **Repository file:** `code/07_posthoc_analysis/E5_E6_Pahang_grouped_SVM.ipynb`.
- **Inputs:** Authorised Pahang retained rows and E5 grouped folds.
- **Outputs:** Repeated full/reduced records, paired differences, and aggregate summaries.
- **Major metric:** The locked aggregate comparison includes mean Rubber F1 = 0.773743 for full Pahang and 0.748323 under the implemented Bentong-scale reduction.
- **Role:** Supplementary post-hoc sensitivity analysis.
- **Uncertainty:** The contrast jointly changes sample quantity, group coverage, and represented conditions. It is not causal proof of the E3 Rubber error mechanism.


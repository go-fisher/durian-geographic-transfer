# Reproducibility workflow

## Evidence sequence

The retained workflow is ordered to prevent target information from entering the frozen-model transfer evaluation:

1. Earth Engine preprocessing and polygon-pixel sampling.
2. Reference-data integrity checks and spatial grouping.
3. E1 nested grouped development of RF, XGBoost, and SVM pipelines in Bentong.
4. Separate full-Bentong feature-group and candidate selection.
5. Refit and freeze the selected S2+R1 SVM pipeline.
6. E2 fixed-configuration grouped Bentong benchmark.
7. E3 one-time frozen-model evaluation in Pahang outside Bentong.
8. E5 Pahang-labelled grouped internal analysis.
9. E4 and E6 post-hoc sensitivity analyses and other diagnostics.

E2 is conditional on the preceding full-Bentong selection and is not an independent source-domain validation. E5 uses Pahang labels in development and is not an external evaluation. E4 and E6 did not reselect or change the frozen model.

## Private data layout

Set `DURIAN_DATA_ROOT` to an authorised directory. The cleaned notebooks retain their original run-folder conventions beneath that root. At minimum, the workflow refers to:

```text
<DURIAN_DATA_ROOT>/
├── Bentong_pixel_samples_2025_v1.csv
├── Pahang_without_Bentong_S2_pixel_samples_2025_v1.csv
├── RF_grouped_validation_20260623_153912_UTC/
├── XGBoost_grouped_validation_20260624_run01/
└── SVM_grouped_validation_20260624_run01/
    └── models/
        └── svm_final_bundle.joblib
```

For E3, an author-approved external copy of the fitted bundle may be placed at the expected private-data model path after its hash is verified against the public manifest. The bundle is excluded from the initial release. E2 and some later notebooks reuse archived fold assignments and retained training-row files from earlier stages. The notebooks stop when required inputs or hashes do not match.

Set `DURIAN_OUTPUT_ROOT` to a writeable run directory. If omitted, notebooks write under the ignored `outputs/runs/` directory in this repository.

## Google Earth Engine

The scripts in `gee/` retain the scientific feature construction, masks, dates, class mapping, and export logic. Replace each `projects/YOUR_GEE_PROJECT/assets/...` placeholder with an asset to which the researcher has authorised access. Do not commit private asset IDs or credentials.

Suggested order:

1. Run `gee/01_GEE_feature_sampling.js` for Bentong multi-source candidate features.
2. Run `gee/02_GEE_feature_sampling_pahang.js` for the Pahang S2 transfer inputs.
3. Run the model-development and transfer notebooks.
4. Use `gee/03_GEE_SVM_classification_export.js` only after the deployment parity checks documented in that script pass.

Earth Engine export tasks are started manually. The public repository does not include the private reference assets used by those tasks.

## Python notebooks

Open notebooks from the repository root after setting the two environment variables. The copies have output cells and personal execution metadata removed. Scientific code, fixed candidates, feature definitions, fold logic, seeds, weights, and evaluation rules were retained.

Recommended order:

```text
code/04_model_development/01_rf_grouped_validation.ipynb
code/04_model_development/02_xgboost_grouped_validation.ipynb
code/04_model_development/03_svm_grouped_validation.ipynb
code/05_bentong_benchmark/E2_Bentong_fixed_S2_R1_grouped_OOF.ipynb
code/06_external_transfer/E3_Bentong_frozen_S2_R1_to_Pahang_external_validation.ipynb
code/07_posthoc_analysis/E5_E6_Pahang_grouped_SVM.ipynb
```

The notebooks can be computationally expensive. E1 and E5 use nested grouped cross-validation, and E6 performs repeated reductions. Run them in a disposable output directory; do not point `DURIAN_OUTPUT_ROOT` at the archived source project.

## Aggregate diagnostics

`derive_revision_statistics.py` and `feature_space_diagnostic.py` require row-level prediction and/or pixel tables that are intentionally excluded. They read those files from `DURIAN_DATA_ROOT` and write aggregate results to `outputs/runs/`.

## Figures and tables

`code/08_figures/figure3_workflow.py` is self-contained and rebuilds the evidence-sequence figure. Other checked-in figures and tables are retained aggregate outputs. Exact-location study-area and representative-case graphics were excluded from this public-facing copy.

## Verification checkpoints

Use the retained aggregate tables to check, not force, the expected manuscript values:

- E1 SVM pipeline polygon OA: 0.850987…
- E2 fixed S2+R1 polygon OA: 0.854578…
- E3 frozen-model Pahang polygon OA: 0.703988…
- E3 Durian polygon F1: 0.716814…
- E3 Rubber polygon F1: 0.381443…
- E5 Pahang-trained grouped polygon OA: 0.835890…

If a rerun differs, preserve the generated output and investigate the environment, input hashes, feature order, fold assignments, and model serialization. Do not edit outputs to match these checkpoints.

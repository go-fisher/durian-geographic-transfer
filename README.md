# Durian Geographic Transfer

## Overview

This repository accompanies the study **“Evaluating geographic transfer of a spatially validated Durian plantation classifier within Pahang, Malaysia.”** It preserves the study’s source-to-target evidence sequence while separating publishable code and aggregate results from exact reference locations and field-survey data.

Repository author: **HE XIAOYUAN**.

The associated manuscript is unpublished and is currently in preparation or submission. The repository is being prepared on a private GitHub review branch and has not been publicly released or licensed.

## Research objective

The study asks whether a classifier developed and spatially validated in Bentong can be transferred, without target-domain fitting, to Pahang outside Bentong. Source-domain model development, post-selection benchmarking, frozen-model transfer, target-domain modelling, and post-hoc diagnostics are kept as distinct evidence stages.

## Study areas

Bentong is the source domain used for grouped model development and model freezing. Pahang outside Bentong is the independent target domain used for the frozen-model transfer evaluation and, later, a separate Pahang-labelled grouped diagnostic analysis. Exact reference coordinates, field-survey locations, and the complete reference-polygon geometry dataset are not included here.

## Classification scheme

The model uses seven encoded classes:

1. Durian
2. Oil palm
3. Forest
4. Other agriculture (raw and historical label: `Mixed agriculture`)
5. Water
6. Built-up / Bare soil
7. Rubber

The numeric class encoding remains unchanged. The source project’s locked reporting decision maps the raw label `Mixed agriculture` to the display label `Other agriculture` only in reporting outputs.

## Remote sensing data

The retained preprocessing code supports:

- Sentinel-2 surface reflectance from `COPERNICUS/S2_SR_HARMONIZED`, with cloud-probability and Scene Classification Layer masking, a 2025 annual median composite, nine reflectance bands, and NDVI, NDRE, NDWI, and EVI.
- Sentinel-1 `COPERNICUS/S1_GRD` VV/VH annual summaries and a VH–VV dB contrast for the Bentong feature comparisons.
- NASADEM `NASA/NASADEM_HGT/001` elevation, slope, eastness, and northness for the Bentong feature comparisons.

The frozen transfer model uses the 13-variable Sentinel-2 block only. In the shorthand `S2+R1`, `R1` is the selected RBF-SVC candidate, not Sentinel-1.

## Methodological workflow

1. Polygon-level reference data are sampled to pixels in Google Earth Engine while retaining `sample_uid` and `group_uid`.
2. Related polygons are assigned to spatial groups. Bentong grouping includes a DBSCAN-assisted first pass for selected classes followed by manual review; Pahang grouping is manual and uses local-patch interpretation.
3. E1 compares Random Forest, XGBoost, and SVM pipelines with nested grouped validation.
4. A separate full-Bentong grouped selection stage chooses the S2 feature block and R1 SVM candidate, then refits and freezes the pipeline.
5. E2 evaluates that fixed configuration across the original Bentong outer folds as a post-selection conditional benchmark.
6. E3 is the principal independent geographic-transfer evaluation: it applies the frozen Bentong pipeline once to Pahang outside Bentong without retraining, rescaling, reselection, threshold adjustment, or class merging.
7. E5 evaluates grouped target-domain learnability after Pahang labels enter model development.
8. E4 and E6 are supplementary post-hoc diagnostics. E4 has partial rather than complete end-to-end executable support.

## Experimental structure

| Experiment | Role | Repository entry point | Status |
|---|---|---|---|
| E1 | Bentong nested grouped model-family development | `code/04_model_development/` | Executable notebooks retained |
| E2 | Fixed S2+R1 grouped Bentong benchmark | `code/05_bentong_benchmark/` | Executable notebook; formal polygon results verified |
| E3 | Principal independent geographic-transfer evaluation: frozen Bentong model applied to Pahang outside Bentong | `code/06_external_transfer/` | Workflow retained; exact execution requires authorised Pahang data and the fitted bundle excluded from the initial release |
| E4 | Fixed-R1 feature-group sensitivity | Shared SVM components plus aggregate outputs | Partial executable support; no self-contained end-to-end generator |
| E5 | Pahang-trained nested grouped internal evaluation | `code/07_posthoc_analysis/E5_E6_Pahang_grouped_SVM.ipynb` | Executable notebook retained |
| E6 | Rubber sample-coverage sensitivity | Same E5/E6 notebook | Executable post-hoc analysis retained |

See [experiment mapping](docs/experiment_mapping.md) for inputs, outputs, metrics, and evidence boundaries.

## Repository structure

- `code/04_model_development/`: cleaned E1 RF, XGBoost, and SVM notebooks.
- `code/05_bentong_benchmark/`: verified E2 fixed-configuration notebook.
- `code/06_external_transfer/`: E3 frozen-model transfer and GEE deployment-preparation notebooks.
- `code/07_posthoc_analysis/`: E5/E6 notebook and diagnostic scripts.
- `code/08_figures/`: safe workflow-figure generator.
- `gee/`: parameterised Earth Engine preprocessing, sampling, and classification scripts.
- `models/`: privacy-safe frozen-model manifest; the local fitted bundle is excluded from the initial release pending approval.
- `example_data/`: schema and private-input guidance; no real locations.
- `outputs/tables/`: aggregate publication tables and figure-source summaries.
- `outputs/figures/`: selected publication figures without exact sample locations.
- `docs/`: workflow, experiment mapping, inventory, data availability, and reproducibility notes.
- `review/`: decisions still requiring author confirmation.

## Installation

Python 3.10 or later is recommended.

```bash
python -m venv .venv
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
```

The frozen model was originally recorded with Python 3.12.13, NumPy 2.0.2, pandas 2.2.2, scikit-learn 1.6.1, and joblib 1.5.3. These versions are provenance information, not fabricated repository-wide pins. Reproducing serialized-model predictions is safest in a matching environment.

See [environment compatibility](docs/environment_compatibility.md) for recorded versions, unknown historical versions, and compatibility limits.

## Reproducibility

Set the private input root before opening a notebook:

```bash
export DURIAN_DATA_ROOT=/path/to/authorised/private_data
export DURIAN_OUTPUT_ROOT=/path/to/run_outputs
jupyter lab
```

On PowerShell:

```powershell
$env:DURIAN_DATA_ROOT = 'D:\authorised\private_data'
$env:DURIAN_OUTPUT_ROOT = 'D:\durian_runs'
jupyter lab
```

The cleaned notebooks resolve these variables and otherwise default to the ignored `private_data/` and `outputs/runs/` directories. Required private filenames and layouts are documented in [workflow.md](docs/workflow.md). Do not execute notebooks against the archived source project.

To rebuild the safe workflow figure:

```bash
python code/08_figures/figure3_workflow.py
```

The checked-in aggregate tables and figures document the locked manuscript-level checkpoints: E1 OA ≈ 0.851, E2 OA ≈ 0.855, E3 OA ≈ 0.704, E3 Durian F1 ≈ 0.717, E3 Rubber F1 ≈ 0.381, and E5 OA ≈ 0.836. The repository does not alter outputs to force those values.

The exact fitted estimator is not part of the initial release. Direct E3 reproduction requires authorised Pahang inputs and an author-approved copy of `svm_final_bundle.joblib` whose SHA-256 matches `models/FROZEN_MODEL_MANIFEST.json`. Joblib uses Python pickle semantics; never load an untrusted copy.

## Data availability

The initial release provides code, documentation, aggregate tables, approved figures, and the privacy-safe frozen-model manifest. Exact reference-sample coordinates, sensitive field-survey locations, raw pixel tables, row-level geographic predictions, full polygon geometries, and the fitted model bundle are not publicly released. See [data availability](docs/data_availability.md).

## Citation

If you use this repository, please cite the repository using the metadata provided in [CITATION.cff](CITATION.cff). The associated manuscript is not yet published.

## License

No explicit repository license has yet been assigned. `LICENSE_STATUS = PENDING_AUTHOR_CONFIRMATION`.

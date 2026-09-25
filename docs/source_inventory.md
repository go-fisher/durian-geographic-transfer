# Source inventory

The source project was inspected recursively and left unchanged. A top-level accessible-file scan found 3,636 files (approximately 2.11 GB) in 912 directories. The tree also contains embedded Python runtimes, LibreOffice profiles, archive duplicates, and reparse-point or stale extracted paths; those inflated a deeper link-aware enumeration and are not research assets.

## File-type overview

| Type | Approximate count | Decision summary |
|---|---:|---|
| PNG | 1,248 | Selected aggregate figures included; exact-location and duplicate figures excluded. |
| JSON | 909 | Key frozen-model manifest included; checkpoints and run caches excluded. |
| CSV | 349 | Aggregate, identifier-free tables included; raw and row-level reference tables excluded. |
| PDF | 138 | Manuscript/submission and duplicate figure PDFs excluded. |
| Markdown | 118 | Used as evidence; repository documentation rewritten for publication. |
| Python | 83 | Core diagnostic and figure code curated; audit/build utilities and temporary scripts excluded. |
| Jupyter notebook | 8 plus six filename-copy variants | Six final experiment notebooks included as cleaned copies; obsolete/duplicate predecessors excluded. |
| JavaScript | 6 | Three research GEE scripts included with private asset IDs parameterised. |
| TIFF | 71 | Excluded as large publication or exact-context assets. |
| DOCX | 66 | Manuscripts and administrative files excluded. |
| XLSX | 43 | Control workbooks inspected through retained audit summaries; excluded from public code repository. |
| GIS vectors | 1 shapefile set, 3 GeoJSON, related sidecars | Sensitive or licensing-dependent; excluded. |
| Joblib | 2 | One canonical frozen bundle included; duplicate estimator file excluded. |

## Curated inventory

| Original relative path or family | Type | Apparent purpose | Repository decision |
|---|---|---|---|
| `README_START_HERE.md`; `02_FACTS/FACTS_VERSION_v2.md` | Markdown | Locked project controls and headline results | Excluded as internal controls; used to write docs |
| `09_SUBMISSION/RSASE_FINAL_CONSISTENCY_CLOSURE/RSASE_FINAL_CONSISTENCY_v1.docx` | DOCX | Latest final-consistency manuscript inspected | Excluded; manuscript artefact |
| `09_SUBMISSION/RSASE_FINAL_CONSISTENCY_CLOSURE/RSASE_SUPPLEMENTARY_FINAL_CONSISTENCY_v1.docx` | DOCX | Latest supplementary methods/results inspected | Excluded; manuscript artefact |
| `04_METHODS_CODE/GEE/geecode_result_colab/01_GEE_feature_sampling.js` | GEE JavaScript | Bentong S2/S1/NASADEM feature construction and polygon sampling | Included, modified copy |
| `.../01_GEE_feature_sampling_pahang.js` | GEE JavaScript | Pahang S2 sampling for frozen transfer | Included, modified copy |
| `.../08_GEE_SVM_classification_export.js` | GEE JavaScript | Deployment parity check and optional map export | Included, modified copy |
| `04_METHODS_CODE/PYTHON/geecode_result_colab/“02_RF_grouped_validation.ipynb”的副本` | Notebook | E1 RF nested grouped validation | Included, cleaned copy |
| `.../“03_XGBoost_grouped_validation.ipynb”的副本` | Notebook | E1 XGBoost nested grouped validation | Included, cleaned copy |
| `.../“04_SVM_grouped_validation.ipynb”的副本` | Notebook | E1 SVM nested grouped validation and shared E4 components | Included, cleaned copy |
| `99_ARCHIVE_ORIGINALS/E2_Bentong_fixed_S2_R1_grouped_OOF.ipynb` | Notebook | Verified E2 fixed S2+R1 grouped benchmark | Included, cleaned copy; archive location is authoritative per later audit |
| `E3_Bentong_frozen_S2_R1_to_Pahang_external_validation.ipynb` | Notebook | Current E3 reconstruction with locked-result checks | Included, cleaned copy |
| `04_METHODS_CODE/PYTHON/geecode_result_colab/Copy of 05_Pahang_S2_external_validation.ipynb` | Notebook | Earlier E3 workflow | Duplicate/obsolete candidate; excluded |
| `.../Copy of 06_Pahang_S2_SVM_grouped_validation.ipynb` | Notebook | E5 and E6 grouped/post-hoc analyses | Included, cleaned copy |
| `.../Copy of 07_prepare_SVM_GEE_deployment.ipynb` | Notebook | GEE deployment-table preparation and parity inputs | Included as a cleaned code-only copy; generated deployment tables remain private |
| `04_METHODS_CODE/REFERENCE_DATA/RAW_INPUTS/*.csv` | CSV | Raw Bentong and Pahang pixel features with coordinates and IDs | Sensitive; excluded |
| `04_METHODS_CODE/REFERENCE_DATA/MAPPINGS/combine_allgroups_numbered.csv` | CSV | Reference grouping map | Sensitive; excluded |
| `04_METHODS_CODE/REFERENCE_DATA/MAPPINGS/SOURCE_ARCHIVES/*.zip` | ZIP/GIS | Reference polygon archives | Sensitive; excluded |
| `00_AUDIT_REPORTS/_E3_VISUAL_DIAGNOSTIC_WORK/samples_pahang.*` | Shapefile | Exact Pahang reference geometry | Sensitive; excluded |
| `05_FIGURES/FINAL_SOURCE_DATA/Figure_1_exact_reference_centroids.csv` | CSV | Exact reference locations | Sensitive; excluded |
| `05_FIGURES/FINAL/Figure_1_study_area_exact_locations.*` | Figure | Exact-location study-area graphic | Sensitive under this repository brief; excluded |
| `00_AUDIT_REPORTS/_E3_VISUAL_DIAGNOSTIC_WORK/*` | Raster/CSV/GIS | Exact candidate windows and selected E3 cases | Sensitive; excluded |
| `03_RESULTS/E3/.../pahang_pixel_predictions.csv` | CSV | Row-level predictions with longitude/latitude | Sensitive; excluded |
| `03_RESULTS/**/oof_*predictions.csv` and fold assignments | CSV | Reference-linked row-level predictions/folds | Requires review; excluded from public copy |
| `04_METHODS_CODE/MANIFESTS/FROZEN_MODEL/svm_final_bundle.joblib` | Model | Frozen S2+R1 pipeline used in E3 | Included; author release approval required |
| `.../svm_final_model.joblib` | Model | Duplicate estimator already represented by bundle | Duplicate candidate; excluded |
| `06_CODE/TARGETED_REVISION/derive_revision_statistics.py` | Python | Aggregate metrics and group bootstrap from retained predictions | Included, modified copy |
| `06_CODE/TARGETED_REVISION/feature_space_diagnostic.py` | Python | Post-hoc S2 source-target feature-space diagnostic | Included, modified copy |
| `06_CODE/MANUSCRIPT_REPRODUCTION/figure3_workflow.py` | Python | Safe evidence-sequence figure generation | Included, modified copy |
| `06_CODE/MANUSCRIPT_REPRODUCTION/outputs/tables/Table_1–Table_6.*` | CSV/Markdown | Final aggregate manuscript tables | Included |
| `05_FIGURES/FINAL_SOURCE_DATA/Figure_3–Figure_5` and `Figure_S1–S5` CSVs | CSV | Aggregate figure source tables | Included |
| `05_FIGURES/FINAL` and `FINAL_SUPPLEMENTARY` selected PNG/SVG files | Figure | Publication figures without exact reference locations | Included selectively |
| `05_FIGURES/FIGURE_REBUILD_ROUND/FIGURE_1/*generalised*` | Figure | Generalised study-area view | Included as a non-exact-location figure |
| `00_AUDIT_REPORTS/**`, `07_DRAFT/**`, most `09_SUBMISSION/**` | Mixed | Audit history, drafting, submission packages | Obsolete/administrative candidates; excluded |
| `99_ARCHIVE_ORIGINALS/**` | Mixed | Historical originals and duplicates | Excluded except the verified E2 notebook |

## Privacy and publication risks found

- Exact longitude/latitude and pixel-derived centroids.
- Full polygon geometry and shapefile component sets.
- Field and case-context rasters with exact outlines or centroids.
- Reference-linked `sample_uid`, `group_uid`, `pixel_uid`, and `s_uuid` tables.
- Personal execution metadata embedded in original notebook outputs.
- Local Windows paths containing a username and a personal-folder name.
- Private Google Earth Engine project/asset IDs and Google Drive paths.

No credential value was intentionally copied. Private asset identifiers were replaced with placeholders rather than published.

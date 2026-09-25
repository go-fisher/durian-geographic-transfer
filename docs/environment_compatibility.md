# Environment compatibility

This note separates versions recorded for the frozen SVM from versions that are unknown. It is not a fabricated full environment lock.

## Recorded versions

The locked frozen-model manifest records the environment used for the retained S2+R1 estimator:

| Component | Recorded version or platform | Evidence scope |
|---|---|---|
| Python | 3.12.13 | Frozen SVM environment |
| NumPy | 2.0.2 | Frozen SVM environment |
| pandas | 2.2.2 | Frozen SVM environment |
| scikit-learn | 1.6.1 | Frozen SVM creation and loading |
| joblib | 1.5.3 | Frozen SVM serialization |
| Platform | Linux x86-64, glibc 2.35 | Frozen SVM environment |

These values come from `models/FROZEN_MODEL_MANIFEST.json`. They do not establish exact versions for every E1-E6 analysis.

## Versions unknown

- XGBoost version used for the retained E1 results;
- SciPy version used with the frozen SVM;
- exact Matplotlib, seaborn, Pillow, CairoSVG, Jupyter, and IPython versions;
- package build strings and solver metadata needed for a complete archival environment.

No exact version should be inferred or added merely because a package is currently available. GeoPandas, Shapely, and Rasterio are not imported by the released Python workflow and are not repository requirements.

## Likely version-sensitive components

- **scikit-learn and joblib:** serialized estimator loading is most reliable with the recorded versions. Joblib uses pickle semantics; never load an untrusted model.
- **NumPy and SciPy:** numerical and binary compatibility can affect estimator loading or secondary numerical outputs.
- **XGBoost:** an unknown historical version limits exact E1 rerun claims.
- **pandas:** version changes can affect data coercion, grouping, and generated artefacts.
- **Plotting packages:** version changes can affect visual layout without changing scientific values.

## Initial-release implication

The fitted estimator is excluded from the initial release. Exact deserialization compatibility is therefore relevant mainly if the bundle is approved for later release or supplied under authorised access. Direct E3 reproduction additionally requires authorised Pahang inputs.

The unpinned `requirements.txt` remains a dependency overview. A model-compatibility environment may later pin only the recorded Python, NumPy, pandas, scikit-learn, and joblib versions, while explicitly marking SciPy and other missing provenance as unknown. A repository-wide lock should not be presented as historical until the missing XGBoost and SciPy versions are recovered from trusted evidence.

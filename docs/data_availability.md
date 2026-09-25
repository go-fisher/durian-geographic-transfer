# Data availability

## Publicly provided in the initial release

- cleaned code and notebooks for preprocessing, model development, validation, geographic-transfer evaluation, and diagnostic analyses;
- parameterised Google Earth Engine scripts;
- workflow and reproducibility documentation;
- aggregate publication tables without stable reference identifiers;
- approved non-location-disclosing publication figures;
- the privacy-safe frozen-model manifest.

## Not publicly provided

- exact reference-sample coordinates and sensitive field-survey locations;
- raw pixel-level reference datasets;
- complete reference-polygon geometries, exact-centroid tables, and shapefiles;
- row-level geographic predictions or fold tables containing stable reference identifiers;
- private Google Earth Engine asset identifiers and local/cloud-drive paths;
- the fitted `svm_final_bundle.joblib` estimator in the initial release.

The manuscript provides a generalised representation of the study areas and reference-sample distribution. Deliberate non-release of exact location data is a privacy and data-governance decision, not a claim that those data do not exist or a failure of the retained code.

Access to additional reference information may be considered subject to data-use, privacy, institutional, and research constraints. Any later release of exact locations or geometries requires a separate author and institutional decision and must not be inferred from the presence of aggregate results here.

Direct reproduction of E3 with the exact frozen estimator requires authorised Pahang inputs and an author-approved model bundle matching `models/FROZEN_MODEL_MANIFEST.json`. The manifest is included, but the fitted binary is excluded from the initial release pending author and applicable institutional approval.

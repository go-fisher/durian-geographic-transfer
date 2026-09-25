# Example data and private input contract

No real reference samples are included. The experiment notebooks expect authorised private inputs beneath `DURIAN_DATA_ROOT` (default: `private_data/`, which is ignored by Git).

Minimum input names used by the retained notebooks include:

- `Bentong_pixel_samples_2025_v1.csv`
- `Pahang_without_Bentong_S2_pixel_samples_2025_v1.csv`
- prior-run folders containing the retained RF, XGBoost, and SVM fold assignments where a notebook explicitly reuses them

Core identifiers are `pixel_uid`, `sample_uid`, and `group_uid`. Feature columns depend on the experiment. The frozen S2 transfer model expects this exact order:

`B3, B4, B5, B6, B7, B8, B8A, B11, B12, NDVI, NDRE, NDWI, EVI`

Do not place real coordinates or reference geometries in this directory. Use the ignored `private_data/` directory or an external authorised path.


# Frozen model

`svm_final_bundle.joblib` is the retained Bentong S2+R1 pipeline used for E3. The locked manifest records its SHA-256, ordered predictors, class encoding, algorithm settings, training-row count, random seed, and original software environment.

The fitted bundle is retained locally for controlled author review but is excluded from the initial public release by an exact `.gitignore` rule. It contains fitted support-vector information and non-scientific source-path metadata. The privacy-safe `FROZEN_MODEL_MANIFEST.json` remains in the release set. Direct E3 execution requires an authorised external copy of the hash-matched bundle plus authorised Pahang inputs.

The separate `svm_final_model.joblib` source file was not copied because it duplicates the fitted estimator already present in the bundle. The bundle is the notebook input referenced by the transfer workflow.

Never load an unverified joblib file from an untrusted source. Verify any authorised bundle copy against the manifest hash before deserialisation.

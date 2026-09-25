// ============================================================================
// 08_GEE_SVM_classification_export.js
//
// Formal map products:
//   1. Bentong 2025 classification from the frozen Bentong SVM + S2 + R1 model.
//   2. Pahang-without-Bentong 2025 transfer classification from the SAME model.
//
// Required preparation:
//   Run 07_prepare_SVM_GEE_deployment.ipynb and upload its three CSV tables to
//   the exact GEE asset IDs below.
//
// Important:
//   A sklearn .joblib file cannot run directly in Earth Engine. The classifier
//   trained here is a deployment replica. It preserves the frozen weighted
//   scaler, feature order, effective RBF gamma, class IDs and the C-SVC settings
//   exposed by GEE, and approximates continuous training weights by deterministic
//   resampling. Frozen sklearn tol=0.001 remains audit metadata because the GEE
//   API documents terminationEpsilon only for epsilon-SVR, not C-SVC.
//
// Two-stage use:
//   Stage A — keep enableClassificationExports=false. Run the script and inspect
//             GEE replica vs frozen-sklearn agreement in the Console.
//   Stage B — only after acceptable agreement, change it to true. Rerun and
//             start four Tasks: two Image Assets and two Drive GeoTIFF exports.
//
// Date interval:
//   2025-01-01 through 2026-01-01 (end date is exclusive).
// ============================================================================


// ============================================================================
// 0. Configuration
// ============================================================================

var CONFIG = {
  // Replace only these project-specific asset paths. Do not commit private IDs.
  bentongAsset:
    'projects/YOUR_GEE_PROJECT/assets/bentong_boundary',
  pahangWithoutBentongAsset:
    'projects/YOUR_GEE_PROJECT/assets/pahang_without_bentong',

  // Upload the three tables created by notebook 07 to these IDs.
  deploymentTrainingAsset:
    'projects/YOUR_GEE_PROJECT/assets/' +
    'bentong_svm_s2_r1_deployment_training',
  deploymentVerificationAsset:
    'projects/YOUR_GEE_PROJECT/assets/' +
    'bentong_svm_s2_r1_deployment_verification',
  deploymentConfigAsset:
    'projects/YOUR_GEE_PROJECT/assets/' +
    'bentong_svm_s2_r1_deployment_config',

  // Formal output Image Assets.
  bentongOutputAsset:
    'projects/YOUR_GEE_PROJECT/assets/' +
    'bentong_svm_s2_r1_classification_2025',
  pahangTransferOutputAsset:
    'projects/YOUR_GEE_PROJECT/assets/' +
    'pahang_without_bentong_bentong_svm_transfer_classification_2025',

  // Drive outputs. Large exports may contain several tiled GeoTIFF files with
  // the same prefix; together they form one logical classification map.
  driveFolder: 'GEE_Durian',
  bentongDrivePrefix:
    'Bentong_frozen_SVM_S2_R1_classification_2025',
  pahangTransferDrivePrefix:
    'Pahang_without_Bentong_frozen_SVM_transfer_classification_2025',

  startDate: '2025-01-01',
  endDate: '2026-01-01',
  exportScaleM: 10,

  // Sentinel-2 cloud/shadow settings copied exactly from feature sampling.
  s2SceneCloudPercent: 90,
  s2CloudProbability: 55,
  s2DarkNirThreshold: 0.15,
  s2CloudProjectionKm: 2,
  s2BufferM: 80,

  // Operational deployment-parity threshold, not an accuracy threshold.
  minimumReplicaAgreement: 0.95,
  minimumPerClassReplicaAgreement: 0.90,

  // SAFETY LOCK: leave false on the first run.
  enableClassificationExports: false,

  // Optional QA only. These do not create formal map products.
  showPahangLayer: false,
  calculateAreaSummaries: false
};


var RAW_FEATURES = [
  'B3', 'B4', 'B5', 'B6', 'B7',
  'B8', 'B8A', 'B11', 'B12',
  'NDVI', 'NDRE', 'NDWI', 'EVI'
];

var Z_FEATURES = [
  'z_B3', 'z_B4', 'z_B5', 'z_B6', 'z_B7',
  'z_B8', 'z_B8A', 'z_B11', 'z_B12',
  'z_NDVI', 'z_NDRE', 'z_NDWI', 'z_EVI'
];

var CLASS_IDS = [0, 1, 2, 3, 4, 5, 6];
var CLASS_NAMES = [
  'Built-up/Bare soil',
  'Durian',
  'Forest',
  'Other agriculture',
  'Oil palm',
  'Rubber',
  'Water'
];

// Index equals class_id.
var CLASS_PALETTE = [
  'B7A27A', // 0 Built-up/Bare soil
  'D7191C', // 1 Durian
  '006837', // 2 Forest
  'F6C85F', // 3 Other agriculture
  '7FBF7B', // 4 Oil palm
  '8C510A', // 5 Rubber
  '2C7BB6'  // 6 Water
];


// ============================================================================
// 1. Load and audit study areas and deployment tables
// ============================================================================

var bentongFc = ee.FeatureCollection(CONFIG.bentongAsset);
var pahangWithoutBentongFc = ee.FeatureCollection(
  CONFIG.pahangWithoutBentongAsset
);
var bentongAoi = bentongFc.geometry();
var pahangWithoutBentongAoi = pahangWithoutBentongFc.geometry();

var deploymentTraining = ee.FeatureCollection(
  CONFIG.deploymentTrainingAsset
);
var deploymentVerification = ee.FeatureCollection(
  CONFIG.deploymentVerificationAsset
);
var deploymentConfig = ee.FeatureCollection(
  CONFIG.deploymentConfigAsset
);
var configFeature = ee.Feature(deploymentConfig.first());
var trainingRowCountMatches = deploymentTraining.size().eq(
  ee.Number(configFeature.get('deployment_training_rows'))
);
var verificationRowCountMatches = deploymentVerification.size().eq(
  ee.Number(configFeature.get('verification_rows'))
);
var configRowCountMatches = deploymentConfig.size().eq(1);

print('===== INPUT ASSET AUDIT =====');
print('Bentong boundary feature count:', bentongFc.size());
print(
  'Pahang-without-Bentong boundary feature count:',
  pahangWithoutBentongFc.size()
);
print('Deployment training rows:', deploymentTraining.size());
print('Deployment verification rows:', deploymentVerification.size());
print('Deployment config rows (must be 1):', deploymentConfig.size());
print('Deployment training first row:', deploymentTraining.first());
print('Deployment verification first row:', deploymentVerification.first());
print('Deployment configuration:', configFeature);
print(
  'Training-row count matches config:',
  trainingRowCountMatches
);
print(
  'Verification-row count matches config:',
  verificationRowCountMatches
);
print('Config-row count is exactly 1:', configRowCountMatches);


// ============================================================================
// 2. Sentinel-2 feature builder
//
// This function is kept identical to the Bentong/Pahang sampling scripts:
//   - COPERNICUS/S2_SR_HARMONIZED plus S2 cloud probability;
//   - identical SCL and projected cloud-shadow masking;
//   - annual median after reflectance scaling;
//   - identical NDVI, NDRE, NDWI and EVI formulas;
//   - B3 reference projection and bilinear resampling.
// ============================================================================

var S2_SOURCE_BANDS = [
  'B2', 'B3', 'B4', 'B5', 'B6',
  'B7', 'B8', 'B8A', 'B11', 'B12'
];

function buildSentinel2Features(aoi, regionName) {
  var s2Sr = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
    .filterBounds(aoi)
    .filterDate(CONFIG.startDate, CONFIG.endDate)
    .filter(
      ee.Filter.lt(
        'CLOUDY_PIXEL_PERCENTAGE',
        CONFIG.s2SceneCloudPercent
      )
    );

  var s2CloudProbability = ee.ImageCollection(
    'COPERNICUS/S2_CLOUD_PROBABILITY'
  )
    .filterBounds(aoi)
    .filterDate(CONFIG.startDate, CONFIG.endDate);

  var joined = ee.ImageCollection(
    ee.Join.saveFirst('s2cloudless').apply({
      primary: s2Sr,
      secondary: s2CloudProbability,
      condition: ee.Filter.equals({
        leftField: 'system:index',
        rightField: 'system:index'
      })
    })
  ).filter(ee.Filter.notNull(['s2cloudless']));

  function addCloudShadowMask(image) {
    var cloudProbability = ee.Image(image.get('s2cloudless'))
      .select('probability');

    var clouds = cloudProbability
      .gt(CONFIG.s2CloudProbability)
      .rename('clouds');

    var notWater = image.select('SCL').neq(6);

    var darkPixels = image.select('B8')
      .lt(CONFIG.s2DarkNirThreshold * 10000)
      .and(notWater)
      .rename('dark_pixels');

    var shadowAzimuth = ee.Number(90).subtract(
      ee.Number(image.get('MEAN_SOLAR_AZIMUTH_ANGLE'))
    );

    // At 100 m working scale, 1 km corresponds to 10 pixels.
    var cloudProjection = clouds
      .directionalDistanceTransform(
        shadowAzimuth,
        CONFIG.s2CloudProjectionKm * 10
      )
      .reproject({
        crs: image.select('B8').projection(),
        scale: 100
      })
      .select('distance')
      .mask()
      .rename('cloud_transform');

    var shadows = cloudProjection
      .and(darkPixels)
      .rename('shadows');

    var cloudShadowMask = clouds
      .or(shadows)
      .focalMin(20, 'circle', 'meters', 1)
      .focalMax(CONFIG.s2BufferM, 'circle', 'meters', 1)
      .rename('cloud_shadow_mask');

    return image.addBands(cloudShadowMask);
  }

  function applyMaskAndScale(image) {
    var scl = image.select('SCL');

    var sclMask = scl.neq(0)
      .and(scl.neq(1))
      .and(scl.neq(3))
      .and(scl.neq(8))
      .and(scl.neq(9))
      .and(scl.neq(10))
      .and(scl.neq(11));

    var clearMask = image.select('cloud_shadow_mask').not();

    return image
      .select(S2_SOURCE_BANDS)
      .updateMask(sclMask)
      .updateMask(clearMask)
      .divide(10000)
      .copyProperties(image, image.propertyNames());
  }

  var masked = joined
    .map(addCloudShadowMask)
    .map(applyMaskAndScale);

  // Use B3 as the common 10 m reference grid, exactly as during sampling.
  var referenceProjection = ee.Image(masked.first())
    .select('B3')
    .projection();

  var validCount = masked
    .select('B4')
    .count()
    .rename('valid_count')
    .setDefaultProjection(referenceProjection)
    .clip(aoi);

  var median = masked
    .median()
    .setDefaultProjection(referenceProjection)
    .clip(aoi);

  var ndvi = median
    .normalizedDifference(['B8', 'B4'])
    .rename('NDVI');

  var ndre = median
    .normalizedDifference(['B8A', 'B5'])
    .rename('NDRE');

  var ndwi = median
    .normalizedDifference(['B3', 'B8'])
    .rename('NDWI');

  // B2 is used only for EVI and is not retained as a model predictor.
  var evi = median.expression(
    '2.5 * ((NIR - RED) / (NIR + 6 * RED - 7.5 * BLUE + 1))',
    {
      NIR: median.select('B8'),
      RED: median.select('B4'),
      BLUE: median.select('B2')
    }
  ).rename('EVI');

  var predictors = median
    .select([
      'B3', 'B4', 'B5', 'B6', 'B7',
      'B8', 'B8A', 'B11', 'B12'
    ])
    .addBands(ndvi)
    .addBands(ndre)
    .addBands(ndwi)
    .addBands(evi)
    .setDefaultProjection(referenceProjection)
    .resample('bilinear')
    .select(RAW_FEATURES)
    .toFloat()
    .clip(aoi);

  print(regionName + ' S2 SR image count:', s2Sr.size());
  print(regionName + ' S2 joined image count:', joined.size());
  print(regionName + ' raw predictor bands:', predictors.bandNames());

  return {
    predictors: predictors,
    validCount: validCount,
    referenceProjection: referenceProjection
  };
}


// ============================================================================
// 3. Apply the exact frozen weighted scaler
// ============================================================================

function standardizePredictorImage(rawPredictors) {
  var standardizedBands = RAW_FEATURES.map(function(rawBand) {
    var mean = ee.Number(configFeature.get('mean_' + rawBand));
    var scale = ee.Number(configFeature.get('scale_' + rawBand));
    return rawPredictors
      .select(rawBand)
      .subtract(mean)
      .divide(scale)
      .rename('z_' + rawBand);
  });

  return ee.Image.cat(standardizedBands)
    .select(Z_FEATURES)
    // sklearn StandardScaler and the uploaded z_* table use float64 values.
    .toDouble();
}


// ============================================================================
// 4. Train the GEE deployment replica
//
// gee_cost is already compensated for the systematic-resampling multiplier by
// notebook 07. Do not replace it manually with the frozen sklearn C.
// ============================================================================

var effectiveGamma = ee.Number(
  configFeature.get('effective_gamma')
);
var geeCost = ee.Number(configFeature.get('gee_cost'));
var deploymentClassifier = ee.Classifier.libsvm({
  decisionProcedure: 'Voting',
  svmType: 'C_SVC',
  kernelType: 'RBF',
  shrinking: true,
  gamma: effectiveGamma,
  cost: geeCost
}).train({
  features: deploymentTraining,
  classProperty: 'class_id',
  inputProperties: Z_FEATURES
});

print('===== GEE DEPLOYMENT CLASSIFIER =====');
print('Classifier:', deploymentClassifier);
print('Effective gamma:', effectiveGamma);
print('Compensated GEE cost:', geeCost);
print(
  'Frozen sklearn tolerance (metadata only):',
  configFeature.get('frozen_sklearn_tolerance')
);
print(
  'GEE C-SVC tolerance note:',
  configFeature.get('gee_c_svc_tolerance_note')
);
print('Expected standardized bands:', Z_FEATURES);


// ============================================================================
// 5. Mandatory GEE-replica vs frozen-sklearn agreement check
//
// Actual = sklearn_pred from the untouched frozen model.
// Predicted = gee_pred from the Earth Engine deployment replica.
// This is deployment parity, not a new scientific accuracy estimate.
// ============================================================================

var verificationPredictions = deploymentVerification.classify(
  deploymentClassifier,
  'gee_pred'
);

var agreementMatrix = verificationPredictions.errorMatrix(
  'sklearn_pred',
  'gee_pred',
  CLASS_IDS
);
var replicaAgreement = agreementMatrix.accuracy();
var agreementBySklearnClass = agreementMatrix.producersAccuracy();
var agreementPass = replicaAgreement.gte(
  CONFIG.minimumReplicaAgreement
);
var agreementByClassList = ee.List(
  ee.Array(agreementBySklearnClass).toList()
).flatten();
var agreementByClassDictionary = ee.Dictionary.fromLists(
  CLASS_NAMES,
  agreementByClassList
);
var minimumObservedClassAgreement = ee.Number(
  agreementByClassList.reduce(ee.Reducer.min())
);
var perClassAgreementPass = minimumObservedClassAgreement.gte(
  CONFIG.minimumPerClassReplicaAgreement
);

var mismatchCount = verificationPredictions
  .map(function(feature) {
    var agrees = ee.Number(feature.get('sklearn_pred')).eq(
      ee.Number(feature.get('gee_pred'))
    );
    return feature.set(
      'deployment_agrees',
      ee.Number(ee.Algorithms.If(agrees, 1, 0))
    );
  })
  .filter(ee.Filter.eq('deployment_agrees', 0))
  .size();

print('===== MANDATORY DEPLOYMENT AGREEMENT CHECK =====');
print(
  'Rows are frozen-sklearn predictions vs GEE-replica predictions.'
);
print('Class order:', CLASS_IDS);
print('Class names:', CLASS_NAMES);
print('Agreement confusion matrix:', agreementMatrix);
print('Overall replica agreement:', replicaAgreement);
print('Agreement by frozen-sklearn class:', agreementBySklearnClass);
print('Mismatch row count:', mismatchCount);
print(
  'Operational minimum agreement:',
  CONFIG.minimumReplicaAgreement
);
print('Overall threshold passed:', agreementPass);
print(
  'Per-class replica agreement:',
  agreementByClassDictionary
);
print(
  'Minimum observed per-class agreement:',
  minimumObservedClassAgreement
);
print(
  'Operational minimum per-class agreement:',
  CONFIG.minimumPerClassReplicaAgreement
);
print('Per-class threshold passed:', perClassAgreementPass);

var finalReadinessFlag = ee.Number(
  ee.List([
    trainingRowCountMatches,
    verificationRowCountMatches,
    configRowCountMatches,
    agreementPass,
    perClassAgreementPass
  ]).reduce(ee.Reducer.min())
).eq(1);

var finalExportReadiness = ee.Dictionary({
  READY_FOR_FORMAL_EXPORT: finalReadinessFlag,
  training_row_count_matches: trainingRowCountMatches,
  verification_row_count_matches: verificationRowCountMatches,
  config_has_exactly_one_row: configRowCountMatches,
  overall_replica_agreement: replicaAgreement,
  required_overall_agreement: CONFIG.minimumReplicaAgreement,
  overall_agreement_passed: agreementPass,
  per_class_replica_agreement: agreementByClassDictionary,
  minimum_observed_class_agreement: minimumObservedClassAgreement,
  required_minimum_class_agreement:
    CONFIG.minimumPerClassReplicaAgreement,
  per_class_agreement_passed: perClassAgreementPass,
  mismatch_rows: mismatchCount,
  class_3_reporting_name: 'Other agriculture'
});

print('===== FINAL EXPORT READINESS =====');
print(finalExportReadiness);
print(
  'Do not interpret this value as validation accuracy. Formal accuracy comes ' +
  'from the completed grouped and external validation experiments.'
);

// Descriptive label comparison only; not a formal validation result.
var descriptiveTruthMatrix = verificationPredictions.errorMatrix(
  'true_class_id',
  'gee_pred',
  CLASS_IDS
);
print(
  'Descriptive true label vs GEE matrix (NOT formal validation):',
  descriptiveTruthMatrix
);


// ============================================================================
// 6. Build and classify the two formal regions
// ============================================================================

function classifyRegion(aoi, regionName, productName) {
  var featureStack = buildSentinel2Features(aoi, regionName);
  var standardized = standardizePredictorImage(
    featureStack.predictors
  );

  var classified = standardized
    .classify(deploymentClassifier)
    .rename('class_id')
    .updateMask(featureStack.validCount.gt(0))
    .clip(aoi)
    .toUint8()
    .set({
      product_name: productName,
      model_source: 'Bentong frozen SVM + S2 + R1',
      deployment_type: 'GEE LibSVM replica after parity check',
      transfer_application:
        regionName === 'Bentong' ? 'no' : 'yes',
      feature_set: 'S2',
      class_property: 'class_id',
      class_mapping:
        '0=Built-up/Bare soil;1=Durian;2=Forest;' +
        '3=Other agriculture;4=Oil palm;5=Rubber;6=Water',
      class_3_reporting_note:
        'Frozen training label Mixed agriculture is reported as ' +
        'Other agriculture; numeric class_id remains 3.',
      start_date: CONFIG.startDate,
      end_date_exclusive: CONFIG.endDate,
      scale_m: CONFIG.exportScaleM,
      s2_composite: 'annual median after cloud/shadow masking',
      invalid_pixel_policy: 'masked; Drive noData=255',
      replica_agreement_reference:
        'verification table sklearn_pred vs gee_pred'
    });

  return {
    rawPredictors: featureStack.predictors,
    standardizedPredictors: standardized,
    validCount: featureStack.validCount,
    classification: classified,
    referenceProjection: featureStack.referenceProjection
  };
}

var bentongResult = classifyRegion(
  bentongAoi,
  'Bentong',
  'Bentong frozen SVM S2 R1 classification 2025'
);

var pahangTransferResult = classifyRegion(
  pahangWithoutBentongAoi,
  'Pahang without Bentong',
  'Pahang without Bentong transfer classification using frozen Bentong SVM 2025'
);

print('===== FORMAL MAP AUDIT =====');
print(
  'Bentong classification bands:',
  bentongResult.classification.bandNames()
);
print(
  'Pahang transfer classification bands:',
  pahangTransferResult.classification.bandNames()
);
print(
  'Bentong projection:',
  bentongResult.referenceProjection
);
print(
  'Pahang transfer projection:',
  pahangTransferResult.referenceProjection
);


// ============================================================================
// 7. Map display and legend
// ============================================================================

var classVis = {
  min: 0,
  max: 6,
  palette: CLASS_PALETTE
};

Map.centerObject(bentongFc, 10);
Map.addLayer(
  bentongResult.classification,
  classVis,
  'Bentong frozen SVM classification 2025',
  true
);
Map.addLayer(
  bentongResult.validCount,
  {min: 0, max: 30, palette: ['8B0000', 'FFD166', '006837']},
  'Bentong valid observation count (QA)',
  false
);

if (CONFIG.showPahangLayer) {
  Map.addLayer(
    pahangTransferResult.classification,
    classVis,
    'Pahang frozen-Bentong-model transfer classification 2025',
    false
  );
}

Map.addLayer(
  bentongFc.style({
    color: 'FFFFFF',
    fillColor: '00000000',
    width: 2
  }),
  {},
  'Bentong boundary',
  true
);
Map.addLayer(
  pahangWithoutBentongFc.style({
    color: 'FFFF00',
    fillColor: '00000000',
    width: 1
  }),
  {},
  'Pahang without Bentong boundary',
  false
);

var legend = ui.Panel({
  style: {
    position: 'bottom-left',
    padding: '8px 12px'
  }
});
legend.add(ui.Label({
  value: 'Class ID',
  style: {fontWeight: 'bold', fontSize: '14px'}
}));
CLASS_NAMES.forEach(function(className, index) {
  var colorBox = ui.Label({
    style: {
      backgroundColor: '#' + CLASS_PALETTE[index],
      padding: '8px',
      margin: '0 6px 4px 0'
    }
  });
  var label = ui.Label({
    value: index + ' — ' + className,
    style: {margin: '0 0 4px 0'}
  });
  legend.add(ui.Panel({
    widgets: [colorBox, label],
    layout: ui.Panel.Layout.Flow('horizontal')
  }));
});
Map.add(legend);


// ============================================================================
// 8. Optional class-area QA summaries
//
// Disabled by default because full-resolution Pahang reduction can be costly.
// These summaries are not exported as additional formal products.
// ============================================================================

function printClassAreaSummary(classImage, region, regionName) {
  var areaHa = ee.Image.pixelArea()
    .divide(10000)
    .rename('area_ha')
    .addBands(classImage.rename('class_id'));

  var groupedArea = areaHa.reduceRegion({
    reducer: ee.Reducer.sum().group({
      groupField: 1,
      groupName: 'class_id'
    }),
    geometry: region,
    scale: CONFIG.exportScaleM,
    maxPixels: 1e13,
    tileScale: 4
  });
  print(regionName + ' class area (ha):', groupedArea);
}

if (CONFIG.calculateAreaSummaries) {
  printClassAreaSummary(
    bentongResult.classification,
    bentongAoi,
    'Bentong'
  );
  printClassAreaSummary(
    pahangTransferResult.classification,
    pahangWithoutBentongAoi,
    'Pahang without Bentong transfer'
  );
}


// ============================================================================
// 9. Formal exports
//
// SAFETY: no tasks are created while enableClassificationExports=false.
// Earth Engine does not automatically block a client-side export based on a
// server-side accuracy number. Inspect the Console first, then deliberately
// change the flag to true.
// ============================================================================

function queueFormalExports(
  classImage,
  region,
  assetId,
  assetDescription,
  driveDescription,
  driveFilePrefix
) {
  Export.image.toAsset({
    image: classImage,
    description: assetDescription,
    assetId: assetId,
    region: region,
    scale: CONFIG.exportScaleM,
    maxPixels: 1e13,
    pyramidingPolicy: {'.default': 'mode'}
  });

  // Keep class 0 distinct from noData by using 255 as the GeoTIFF noData value.
  var driveImage = classImage.unmask(255).toUint8();

  Export.image.toDrive({
    image: driveImage,
    description: driveDescription,
    folder: CONFIG.driveFolder,
    fileNamePrefix: driveFilePrefix,
    region: region,
    scale: CONFIG.exportScaleM,
    maxPixels: 1e13,
    fileDimensions: 8192,
    shardSize: 256,
    skipEmptyTiles: true,
    fileFormat: 'GeoTIFF',
    formatOptions: {
      cloudOptimized: true,
      noData: 255
    }
  });
}

if (CONFIG.enableClassificationExports) {
  print(
    'EXPORT LOCK OPEN. Four formal export tasks are being created. ' +
    'Start them manually in the Tasks tab.'
  );

  queueFormalExports(
    bentongResult.classification,
    bentongAoi,
    CONFIG.bentongOutputAsset,
    'Bentong_SVM_S2_R1_classification_2025_ASSET',
    'Bentong_SVM_S2_R1_classification_2025_DRIVE',
    CONFIG.bentongDrivePrefix
  );

  queueFormalExports(
    pahangTransferResult.classification,
    pahangWithoutBentongAoi,
    CONFIG.pahangTransferOutputAsset,
    'Pahang_Bentong_SVM_transfer_classification_2025_ASSET',
    'Pahang_Bentong_SVM_transfer_classification_2025_DRIVE',
    CONFIG.pahangTransferDrivePrefix
  );
} else {
  print(
    'EXPORT LOCKED: enableClassificationExports=false. ' +
    'Inspect the deployment agreement matrix and per-class agreement first.'
  );
  print(
    'If overall agreement is below the operational threshold, return to ' +
    'notebook 07, increase RESAMPLE_MULTIPLIER, regenerate/re-upload all ' +
    'three deployment tables, and repeat this check.'
  );
}


// ============================================================================
// End of script
// ============================================================================

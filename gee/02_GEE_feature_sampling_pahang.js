// ============================================================================
// 01_GEE_feature_sampling_pahang.js
// Pahang-without-Bentong 2025 Sentinel-2 feature sampling for frozen model
//
// Purpose:
//   1. Build the same Sentinel-2 feature stack used by the final frozen Bentong model.
//   2. Audit the Pahang external-validation polygon sample asset.
//   3. Extract valid 10 m pixels while preserving sample_uid and group_uid.
//   4. Export a pixel-level CSV for Pahang external validation / transferability testing.
//
// Frozen-model decision is documented in ../models/FROZEN_MODEL_MANIFEST.json.
//
// Final frozen model:
//   SVM + S2 + R1
//   RBF-SVC, C=10.0, gamma=scale, tol=0.001
//
// Final S2 predictors:
//   B3, B4, B5, B6, B7, B8, B8A, B11, B12, NDVI, NDRE, NDWI, EVI
//
// Important:
//   - This script does not extract Sentinel-1 or DEM features, because the
//     frozen model uses S2-only predictors.
//   - This script does not use previously downloaded GeoTIFF files.
//   - B2 is used only to calculate EVI and is not exported as a predictor.
//   - valid_count is exported only for QA and is not a model predictor.
//   - For Pahang samples, class_id is retained as the within-class spatial group
//     number. Use label_id as the model class label.
// ============================================================================


// ============================================================================
// 0. Configuration
// ============================================================================

var CONFIG = {
  // Replace only these project-specific asset paths. Do not commit private IDs.
  aoiAsset:
    'projects/YOUR_GEE_PROJECT/assets/pahang_without_bentong',
  samplesAsset:
    'projects/YOUR_GEE_PROJECT/assets/pahang_reference_polygons',

  startDate: '2025-01-01',
  // filterDate end is exclusive, so use 2026-01-01 for the full 2025 year.
  endDate: '2026-01-01',

  sampleScaleM: 10,
  tileScale: 4,

  // Sentinel-2 cloud/shadow parameters.
  s2SceneCloudPercent: 90,
  s2CloudProbability: 55,
  s2DarkNirThreshold: 0.15,
  s2CloudProjectionKm: 2,
  s2BufferM: 80,

  driveFolder: 'GEE_Durian',
  csvDescription: 'Pahang_without_Bentong_S2_pixel_samples_2025_v1',
  csvFilePrefix: 'Pahang_without_Bentong_S2_pixel_samples_2025_v1',

  // CSV is the main output for Colab/sklearn external validation.
  // Keep this false unless you also want a GEE FeatureCollection asset copy.
  exportPixelAsset: false,
  pixelSamplesAsset:
    'projects/YOUR_GEE_PROJECT/assets/pahang_without_bentong_S2_pixel_samples_2025_v1'
};


// Stable seven-class encoding used by every later script/notebook.
// Never change these IDs after model development begins.
var CLASS_TO_ID = ee.Dictionary({
  'Built-up/Bare soil': 0,
  'Durian': 1,
  'Forest': 2,
  'Mixed agriculture': 3,
  'Oil palm': 4,
  'Rubber': 5,
  'Water': 6
});

var CLASS_NAMES = [
  'Built-up/Bare soil',
  'Durian',
  'Forest',
  'Mixed agriculture',
  'Oil palm',
  'Rubber',
  'Water'
];


// Predictor names must match the frozen SVM + S2 model exactly.
var S2_PREDICTOR_BANDS = [
  'B3', 'B4', 'B5', 'B6', 'B7',
  'B8', 'B8A', 'B11', 'B12',
  'NDVI', 'NDRE', 'NDWI', 'EVI'
];

var PREDICTOR_BANDS = S2_PREDICTOR_BANDS;

var REQUIRED_SAMPLE_FIELDS = [
  'sample_uid',
  'group_uid',
  'class_lv2',
  'class_id',
  'label_id'
];

var EXPORT_METADATA_FIELDS = [
  'pixel_uid',
  'sample_uid',
  'group_uid',
  'class_lv2',
  'label_id',
  'class_id',
  'spatial_group_no',
  's_uuid',
  'domain',
  'longitude',
  'latitude'
];


// ============================================================================
// 1. Study area and sample audit
// ============================================================================

var aoiFc = ee.FeatureCollection(CONFIG.aoiAsset);
var aoi = aoiFc.geometry();

var samplesRaw = ee.FeatureCollection(CONFIG.samplesAsset)
  .filterBounds(aoi);

var samples = samplesRaw.map(function(feature) {
  var className = ee.String(feature.get('class_lv2'));
  var labelId = ee.Number(CLASS_TO_ID.get(className, -1)).toInt();

  // In the Pahang sample file, class_id is not the model label.
  // It is the within-class spatial group number used to build group_uid.
  var spatialGroupNo = feature.get('class_id');

  return feature.set({
    label_id: labelId,
    spatial_group_no: spatialGroupNo,
    domain: 'Pahang_without_Bentong'
  });
});

print('===== PAHANG SAMPLE ASSET AUDIT =====');
print('First sample:', samples.first());
print('Sample property names:', samples.first().propertyNames());
print('Pahang sample count (expected 652):', samples.size());
print(
  'Unique sample_uid count (expected 652):',
  samples.aggregate_array('sample_uid').distinct().size()
);
print(
  'Unique group_uid count (expected 268):',
  samples.aggregate_array('group_uid').distinct().size()
);
print('Class counts:', samples.aggregate_histogram('class_lv2'));
print('Numeric label_id counts:', samples.aggregate_histogram('label_id'));
print(
  'Samples with all required fields (expected 652):',
  samples.filter(ee.Filter.notNull(REQUIRED_SAMPLE_FIELDS)).size()
);
print(
  'Samples with an unknown class (expected 0):',
  samples.filter(ee.Filter.eq('label_id', -1)).size()
);
print(
  'IMPORTANT:',
  'Use label_id as the model class label. class_id is retained as the ' +
  'within-class spatial group number.'
);
print('Locked class order:', CLASS_NAMES);

Map.centerObject(aoi, 8);
Map.addLayer(aoiFc, {color: 'blue'}, 'Pahang without Bentong boundary', false);
Map.addLayer(samples, {color: 'yellow'}, 'Pahang polygon samples', true);


// ============================================================================
// 2. Sentinel-2 feature builder
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

  // Use B3 as the common 10 m reference grid.
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

  // B2 is used here only and is not retained as an independent predictor.
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
    .select(PREDICTOR_BANDS)
    .toFloat()
    .clip(aoi);

  print(regionName + ' S2 SR image count:', s2Sr.size());
  print(regionName + ' S2 joined image count:', joined.size());
  print(regionName + ' S2 predictor bands:', predictors.bandNames());
  print(
    regionName + ' valid_count min/max:',
    validCount.reduceRegion({
      reducer: ee.Reducer.minMax(),
      geometry: aoi,
      scale: 100,
      maxPixels: 1e13,
      tileScale: CONFIG.tileScale
    })
  );

  return {
    predictors: predictors,
    validCount: validCount,
    referenceProjection: referenceProjection
  };
}


// ============================================================================
// 3. Build the Pahang-without-Bentong S2 feature stack
// ============================================================================

var pahangStack = buildSentinel2Features(aoi, 'Pahang_without_Bentong');
var finalPredictors = pahangStack.predictors;

print('===== FINAL S2 FEATURE STACK =====');
print('Expected predictor count:', PREDICTOR_BANDS.length);
print('Expected predictor names:', PREDICTOR_BANDS);
print('Actual predictor names:', finalPredictors.bandNames());
print(
  'Missing expected bands (expected empty):',
  ee.List(PREDICTOR_BANDS).removeAll(finalPredictors.bandNames())
);
print(
  'Unexpected extra bands (expected empty):',
  finalPredictors.bandNames().removeAll(PREDICTOR_BANDS)
);

Map.addLayer(
  finalPredictors.select('NDVI'),
  {min: 0, max: 1, palette: ['brown', 'yellow', 'green']},
  'Pahang without Bentong NDVI 2025',
  false
);


// ============================================================================
// 4. Extract valid pixels from the polygon samples
// ============================================================================

// Coordinates are metadata for QA/model-conversion checks only.
// They must never be included in PREDICTOR_BANDS.
var coordinateBands = ee.Image.pixelLonLat()
  .rename(['longitude', 'latitude']);

var samplingImage = finalPredictors
  .addBands(pahangStack.validCount)
  .addBands(coordinateBands);

var pixelSamples = samplingImage.sampleRegions({
  collection: samples,
  properties: [
    'sample_uid',
    'group_uid',
    'class_lv2',
    'label_id',
    'class_id',
    'spatial_group_no',
    's_uuid',
    'domain'
  ],
  scale: CONFIG.sampleScaleM,
  projection: pahangStack.referenceProjection,
  tileScale: CONFIG.tileScale,
  geometries: false
});

// Remove records missing any predictor. Do not replace missing data with -9999.
pixelSamples = pixelSamples
  .filter(ee.Filter.notNull(PREDICTOR_BANDS))
  .filter(ee.Filter.gte('label_id', 0));

// A stable pixel-level identifier is useful when comparing sklearn and GEE
// predictions after converting the final model.
pixelSamples = pixelSamples.map(function(feature) {
  var longitude = ee.Number(feature.get('longitude'));
  var latitude = ee.Number(feature.get('latitude'));

  var pixelUid = ee.String(feature.get('sample_uid'))
    .cat('_')
    .cat(longitude.format('%.6f'))
    .cat('_')
    .cat(latitude.format('%.6f'));

  // Export.table.toAsset requires non-null geometry. Reconstruct the pixel
  // centre as a WGS84 point while keeping sampleRegions geometries=false.
  var pixelGeometry = ee.Geometry.Point(
    [longitude, latitude],
    'EPSG:4326'
  );

  return feature
    .set('pixel_uid', pixelUid)
    .setGeometry(pixelGeometry);
});

var allSampleUids = ee.List(
  samples.aggregate_array('sample_uid')
).distinct();

var sampledUids = ee.List(
  pixelSamples.aggregate_array('sample_uid')
).distinct();

print('===== PIXEL SAMPLING QA =====');
print('Total exported pixel rows:', pixelSamples.size());
print('Samples containing valid pixels:', sampledUids.size());
print(
  'Samples without any valid pixel (expected empty):',
  allSampleUids.removeAll(sampledUids)
);
print('First exported pixel row:', pixelSamples.first());
print(
  'Pixel class counts by label_id:',
  pixelSamples.aggregate_histogram('label_id')
);


// ============================================================================
// 5. Export Pahang external-validation S2 data
// ============================================================================

var EXPORT_SELECTORS = EXPORT_METADATA_FIELDS
  .concat(PREDICTOR_BANDS)
  .concat(['valid_count']);

print('CSV export columns:', EXPORT_SELECTORS);

Export.table.toDrive({
  collection: pixelSamples,
  description: CONFIG.csvDescription,
  folder: CONFIG.driveFolder,
  fileNamePrefix: CONFIG.csvFilePrefix,
  fileFormat: 'CSV',
  selectors: EXPORT_SELECTORS
});

if (CONFIG.exportPixelAsset) {
  Export.table.toAsset({
    collection: pixelSamples,
    description: CONFIG.csvDescription,
    assetId: CONFIG.pixelSamplesAsset
  });
}


// ============================================================================
// 6. Next-stage note
// ============================================================================

print(
  'NEXT STEP:',
  'Run the Console audits first. Start the CSV task only after sample counts, ' +
  'label_id mapping, S2 band list, and missing-sample list are correct. In Colab, ' +
  'use label_id as the true class label for external validation.'
);

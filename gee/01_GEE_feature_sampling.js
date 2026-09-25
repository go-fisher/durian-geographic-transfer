// ============================================================================
// 01_GEE_feature_sampling.js
// Bentong 2025 multi-source feature construction + polygon pixel sampling
//
// Purpose:
//   1. Build one reproducible Sentinel-2 + Sentinel-1 + NASADEM feature stack.
//   2. Audit the final polygon sample asset.
//   3. Extract valid 10 m pixels while preserving sample_uid and group_uid.
//   4. Create CSV and Earth Engine Asset export tasks.
//
// Important:
//   - This script does not use previously downloaded GeoTIFF files.
//   - B2 is used only to calculate EVI.
//   - valid_count is exported only for QA and is not an RF predictor.
//   - angle_median and hillshade are excluded.
//   - Aspect is encoded as eastness/northness to avoid the 0/360 discontinuity.
// ============================================================================


// ============================================================================
// 0. Configuration
// ============================================================================

var CONFIG = {
  // Replace only these project-specific asset paths. Do not commit private IDs.
  bentongAsset: 'projects/YOUR_GEE_PROJECT/assets/bentong_boundary',
  pahangAsset: 'projects/YOUR_GEE_PROJECT/assets/pahang_boundary',
  samplesAsset: 'projects/YOUR_GEE_PROJECT/assets/bentong_reference_polygons',

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

  // Use 'BOTH', 'ASCENDING', or 'DESCENDING'.
  // BOTH preserves the strategy used in the previous exploratory script.
  s1OrbitPass: 'BOTH',

  driveFolder: 'GEE_Durian',
  csvDescription: 'Bentong_pixel_samples_2025_v1',
  csvFilePrefix: 'Bentong_pixel_samples_2025_v1',

  // This Asset copy is useful later when testing the converted RF in GEE.
  exportTrainingAsset: true,
  trainingPixelsAsset:
    'projects/YOUR_GEE_PROJECT/assets/bentong_training_pixels_2025_v1'
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


// Predictor names are the single source of truth for sampling and modelling.
var S2_PREDICTOR_BANDS = [
  'B3', 'B4', 'B5', 'B6', 'B7',
  'B8', 'B8A', 'B11', 'B12',
  'NDVI', 'NDRE', 'NDWI', 'EVI'
];

var S1_PREDICTOR_BANDS = [
  'VV_median', 'VH_median',
  'VV_stdDev', 'VH_stdDev',
  'VV_p10', 'VV_p90',
  'VH_p10', 'VH_p90',
  'VH_VV_ratio_dB'
];

var DEM_PREDICTOR_BANDS = [
  'elevation', 'slope', 'eastness', 'northness'
];

var PREDICTOR_BANDS = S2_PREDICTOR_BANDS
  .concat(S1_PREDICTOR_BANDS)
  .concat(DEM_PREDICTOR_BANDS);

var REQUIRED_SAMPLE_FIELDS = [
  'sample_uid',
  'group_uid',
  'class_lv2',
  'CLUSTER_ID'
];

var EXPORT_METADATA_FIELDS = [
  'pixel_uid',
  'sample_uid',
  'group_uid',
  'class_lv2',
  'class_id',
  'CLUSTER_ID',
  'domain',
  'longitude',
  'latitude'
];


// ============================================================================
// 1. Study areas and sample audit
// ============================================================================

var bentongFc = ee.FeatureCollection(CONFIG.bentongAsset);
var pahangFc = ee.FeatureCollection(CONFIG.pahangAsset);
var bentongAoi = bentongFc.geometry();
var pahangAoi = pahangFc.geometry();

var samplesRaw = ee.FeatureCollection(CONFIG.samplesAsset)
  .filterBounds(bentongAoi);

var samples = samplesRaw.map(function(feature) {
  var className = ee.String(feature.get('class_lv2'));
  var classId = ee.Number(CLASS_TO_ID.get(className, -1)).toInt();

  return feature.set({
    class_id: classId,
    domain: 'Bentong'
  });
});

print('===== SAMPLE ASSET AUDIT =====');
print('First sample:', samples.first());
print('Sample property names:', samples.first().propertyNames());
print('Bentong sample count (expected 557):', samples.size());
print(
  'Unique sample_uid count (expected 557):',
  samples.aggregate_array('sample_uid').distinct().size()
);
print(
  'Unique group_uid count (expected 206):',
  samples.aggregate_array('group_uid').distinct().size()
);
print('Class counts:', samples.aggregate_histogram('class_lv2'));
print('Numeric class counts:', samples.aggregate_histogram('class_id'));
print(
  'Samples with all required fields (expected 557):',
  samples.filter(ee.Filter.notNull(REQUIRED_SAMPLE_FIELDS)).size()
);
print(
  'Samples with an unknown class (expected 0):',
  samples.filter(ee.Filter.eq('class_id', -1)).size()
);
print('Locked class order:', CLASS_NAMES);

Map.centerObject(bentongAoi, 10);
Map.addLayer(bentongFc, {color: 'red'}, 'Bentong boundary', false);
Map.addLayer(pahangFc, {color: 'blue'}, 'Pahang boundary', false);
Map.addLayer(samples, {color: 'yellow'}, 'Final polygon samples', true);


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
    .select(S2_PREDICTOR_BANDS)
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
// 3. Sentinel-1 feature builder
// ============================================================================

function buildSentinel1Features(aoi, regionName) {
  var collection = ee.ImageCollection('COPERNICUS/S1_GRD')
    .filterBounds(aoi)
    .filterDate(CONFIG.startDate, CONFIG.endDate)
    .filter(ee.Filter.eq('instrumentMode', 'IW'))
    .filter(ee.Filter.eq('resolution_meters', 10))
    .filter(
      ee.Filter.listContains(
        'transmitterReceiverPolarisation',
        'VV'
      )
    )
    .filter(
      ee.Filter.listContains(
        'transmitterReceiverPolarisation',
        'VH'
      )
    );

  print(
    regionName + ' S1 orbit-pass histogram:',
    collection.aggregate_histogram('orbitProperties_pass')
  );
  print(
    regionName + ' S1 relative-orbit histogram:',
    collection.aggregate_histogram('relativeOrbitNumber_start')
  );

  if (CONFIG.s1OrbitPass !== 'BOTH') {
    collection = collection.filter(
      ee.Filter.eq('orbitProperties_pass', CONFIG.s1OrbitPass)
    );
  }

  var used = collection.select(['VV', 'VH']);
  var referenceProjection = ee.Image(used.first())
    .select('VV')
    .projection();

  var vvMedian = used.select('VV')
    .median()
    .rename('VV_median');

  var vhMedian = used.select('VH')
    .median()
    .rename('VH_median');

  var vvStd = used.select('VV')
    .reduce(ee.Reducer.stdDev())
    .rename('VV_stdDev');

  var vhStd = used.select('VH')
    .reduce(ee.Reducer.stdDev())
    .rename('VH_stdDev');

  var vvPercentiles = used.select('VV')
    .reduce(ee.Reducer.percentile([10, 90]))
    .rename(['VV_p10', 'VV_p90']);

  var vhPercentiles = used.select('VH')
    .reduce(ee.Reducer.percentile([10, 90]))
    .rename(['VH_p10', 'VH_p90']);

  // In dB space, VH - VV is the log-scale polarization ratio.
  var vhVvRatio = vhMedian
    .subtract(vvMedian)
    .rename('VH_VV_ratio_dB');

  var predictors = vvMedian
    .addBands(vhMedian)
    .addBands(vvStd)
    .addBands(vhStd)
    .addBands(vvPercentiles)
    .addBands(vhPercentiles)
    .addBands(vhVvRatio)
    .setDefaultProjection(referenceProjection)
    .resample('bilinear')
    .select(S1_PREDICTOR_BANDS)
    .toFloat()
    .clip(aoi);

  print(regionName + ' S1 image count used:', used.size());
  print(regionName + ' S1 predictor bands:', predictors.bandNames());

  return predictors;
}


// ============================================================================
// 4. NASADEM terrain feature builder
// ============================================================================

function buildTerrainFeatures(aoi, regionName) {
  // Derive terrain products before clipping to avoid AOI-edge artifacts.
  var dem = ee.Image('NASA/NASADEM_HGT/001')
    .select('elevation');

  var terrain = ee.Terrain.products(dem);
  var elevation = terrain.select('elevation').rename('elevation');
  var slope = terrain.select('slope').rename('slope');
  var aspect = terrain.select('aspect');

  // Convert circular aspect degrees to two continuous components.
  var aspectRadians = aspect.multiply(Math.PI / 180);
  var eastness = aspectRadians.sin().rename('eastness');
  var northness = aspectRadians.cos().rename('northness');

  var predictors = elevation
    .addBands(slope)
    .addBands(eastness)
    .addBands(northness)
    .setDefaultProjection(dem.projection())
    .resample('bilinear')
    .select(DEM_PREDICTOR_BANDS)
    .toFloat()
    .clip(aoi);

  print(regionName + ' terrain predictor bands:', predictors.bandNames());

  return predictors;
}


// ============================================================================
// 5. Build the Bentong feature stack
// ============================================================================

function buildFeatureStack(aoi, regionName) {
  var s2 = buildSentinel2Features(aoi, regionName);
  var s1 = buildSentinel1Features(aoi, regionName);
  var terrain = buildTerrainFeatures(aoi, regionName);

  var predictors = s2.predictors
    .addBands(s1)
    .addBands(terrain)
    .select(PREDICTOR_BANDS)
    .toFloat()
    .clip(aoi);

  return {
    predictors: predictors,
    validCount: s2.validCount,
    referenceProjection: s2.referenceProjection
  };
}

var bentongStack = buildFeatureStack(bentongAoi, 'Bentong');
var finalPredictors = bentongStack.predictors;

print('===== FINAL FEATURE STACK =====');
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
  'Bentong NDVI 2025',
  false
);

Map.addLayer(
  finalPredictors.select('VV_median'),
  {min: -20, max: 0},
  'Bentong VV median 2025',
  false
);


// ============================================================================
// 6. Extract valid pixels from the polygon samples
// ============================================================================

// Coordinates are metadata for QA/model-conversion checks only.
// They must never be included in PREDICTOR_BANDS.
var coordinateBands = ee.Image.pixelLonLat()
  .rename(['longitude', 'latitude']);

var samplingImage = finalPredictors
  .addBands(bentongStack.validCount)
  .addBands(coordinateBands);

var pixelSamples = samplingImage.sampleRegions({
  collection: samples,
  properties: [
    'sample_uid',
    'group_uid',
    'class_lv2',
    'class_id',
    'CLUSTER_ID',
    'domain'
  ],
  scale: CONFIG.sampleScaleM,
  projection: bentongStack.referenceProjection,
  tileScale: CONFIG.tileScale,
  geometries: false
});

// Remove records missing any predictor. Do not replace missing data with -9999.
pixelSamples = pixelSamples
  .filter(ee.Filter.notNull(PREDICTOR_BANDS))
  .filter(ee.Filter.gte('class_id', 0));

// A stable pixel-level identifier is useful when comparing sklearn and GEE
// predictions after converting the final Random Forest.
pixelSamples = pixelSamples.map(function(feature) {
  var longitude = ee.Number(feature.get('longitude'));
  var latitude = ee.Number(feature.get('latitude'));

  var pixelUid = ee.String(feature.get('sample_uid'))
    .cat('_')
    .cat(longitude.format('%.6f'))
    .cat('_')
    .cat(latitude.format('%.6f'));

  // Export.table.toAsset requires non-null geometry.  Reconstruct the pixel
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


// ============================================================================
// 7. Export training data
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

if (CONFIG.exportTrainingAsset) {
  Export.table.toAsset({
    collection: pixelSamples,
    description: 'Bentong_training_pixels_2025_v1',
    assetId: CONFIG.trainingPixelsAsset
  });
}


// ============================================================================
// 8. Next-stage note
// ============================================================================

print(
  'NEXT STEP:',
  'Run the Console audits first. Start the CSV/Asset tasks only after the ' +
  'sample counts, class mapping, band list, and missing-sample list are correct.'
);

// Pahang is intentionally not classified here. The later classification script
// will call buildFeatureStack(pahangAoi, 'Pahang') so Bentong and Pahang use the
// exact same functions, dates, masks, band names, and resampling rules.

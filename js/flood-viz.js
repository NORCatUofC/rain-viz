var map = L.map('map', {
  center: [41.88, -87.63],
  zoom: 10,
  minZoom: 9,
  maxZoom: 16,
  maxBounds: [[41.644335, -87.940267], [42.0231311, -87.524044]]
});

L.tileLayer('https://cartodb-basemaps-{s}.global.ssl.fastly.net/light_all/{z}/{x}/{y}.png',
  { attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, &copy; <a href="https://carto.com/attributions">CARTO</a>' }
).addTo(map);

var floodLayer = L.tileLayer("https://s3.amazonaws.com/chi-311-flooding/chi_311_flooding_tiles/{z}/{x}/{y}.png").addTo(map);
var basementFloodLayer = L.tileLayer("https://s3.amazonaws.com/chi-311-flooding/chi_311_flooding_basement_tiles/{z}/{x}/{y}.png");

function zipStyleFunc(feature) {
  return {color: '#bc1818', fillColor: '#bc1818', weight: 0.75, fillOpacity: 0.0};
}
function commStyleFunc(feature) {
  return {color: '#31890f', fillColor: '#31890f', weight: 0.75, fillOpacity: 0.0};
}
// Styling for choropleth layers
function getZipColor(d) {
  return d > 6000 ? '#238b45' : // to 7526 max
         d > 4000 ? '#74c476' :
         d > 2000 ? '#bae4b3' :
                    '#edf8e9';  // 0 min
}

function getCommColor(d) {
  return d > 8000 ? '#a50f15' : // to 8874 max
         d > 6000 ? '#de2d26' :
         d > 4000 ? '#fb6a4a' :
         d > 2000 ? '#fcae91' :
                    '#fee5d9';  // 107 min
}
function zipScaleFunc(feature) {
  return {color: '#000', fillColor: getZipColor(feature.properties.all_calls), weight: 0.5, fillOpacity: 1.0};
}
function commScaleFunc(feature) {
  return {color: '#000', fillColor: getCommColor(feature.properties.all_calls), weight: 0.5, fillOpacity: 1.0};
}

var zipLayer = new L.geoJson(null, {style: zipStyleFunc, onEachFeature: function(feature, layer) {
  layer.bindPopup("<strong>Zip:</strong> " + feature.properties.zip);
  layer.on({
        mouseover: function(e) { layer.setStyle({fillOpacity: 0.4});},
        mouseout: function(e) { layer.setStyle({fillOpacity: 0.0});}
  });
}});

var commLayer = new L.geoJson(null, {style: commStyleFunc, onEachFeature: function(feature, layer) {
  layer.bindPopup("<strong>Community Area:</strong> " + feature.properties.comm_area);
  layer.on({
        mouseover: function(e) { layer.setStyle({fillOpacity: 0.4});},
        mouseout: function(e) { layer.setStyle({fillOpacity: 0.0});}
  });
}});

var zipScaleLayer = new L.geoJson(null, {style: zipScaleFunc, onEachFeature: function(feature, layer) {
  layer.bindPopup("<strong>Zip:</strong> " + feature.properties.zip + "<br>" +
                  "<strong>All Flood Calls:</strong> " + feature.properties.all_calls + "<br>" +
                  "<strong>Basement Flooding Calls:</strong> " + feature.properties.basement_calls);
}});

var commScaleLayer = new L.geoJson(null, {style: commScaleFunc, onEachFeature: function(feature, layer) {
  layer.bindPopup("<strong>Community Area:</strong> " + feature.properties.comm_area + "<br>" +
                  "<strong>All Flood Calls:</strong> " + feature.properties.all_calls + "<br>" +
                  "<strong>Basement Flooding Calls:</strong> " + feature.properties.basement_calls);
}});

var heatmapLayers = {"All Flooding Calls": floodLayer,
                     "Basement Flooding Calls": basementFloodLayer,
                     "Calls by Zip Code": zipScaleLayer,
                     "Calls by Community Area": commScaleLayer};
var boundaryLayers = {"Zip Codes": zipLayer,
                      "Community Areas": commLayer};

L.control.layers(heatmapLayers, boundaryLayers).addTo(map);

// Change the legend based on the topmost active layer
var zipScaleLevels = [0, 2000, 4000, 6000, 7526];
var commScaleLevels = [107, 2000, 4000, 6000, 8000, 8874];

var callLegend = "<h4>311 Flooding Call Heatmap</h4>" +
                 "<p>Heatmap distribution of 311 calls for water in street flooding " +
                 "and water in basement flooding from January 2009 to September 2016</p>";
var basementLegend = "<h4>311 Basement Flooding Call Heatmap</h4>" +
                     "<p>Heatmap distribution of 311 calls for basement flooding " +
                     "from January 2009 to September 2016</p>";

function getZipLegend() {
  var zipScaleLegend = "<h4>311 Flooding Calls by Zip</h4>";
  for (var i = 0; i < zipScaleLevels.length - 1; ++i) {
    zipScaleLegend += '<i style="background:' + getZipColor(zipScaleLevels[i] + 1) + '"></i> ' +
      zipScaleLevels[i] + '&ndash;' + zipScaleLevels[i + 1] + '<br>';
  }
  return zipScaleLegend;
}
function getCommLegend() {
  var commScaleLegend = "<h4>311 Flooding Calls by Community Area</h4>";
  for (var i = 0; i < commScaleLevels.length - 1; ++i) {
    commScaleLegend += '<i style="background:' + getCommColor(commScaleLevels[i] + 1) + '"></i> ' +
      commScaleLevels[i] + '&ndash;' + commScaleLevels[i + 1] + '<br>';
  }
  return commScaleLegend;
}

var info = L.control({position: "bottomleft"});

info.onAdd = function (map) {
    this._div = L.DomUtil.create('div', 'info'); // create a div with a class "info"
    this._div.innerHTML = callLegend;
    return this._div;
};

// method that we will use to update the control based on feature properties passed
info.update = function (updatedText) {
    this._div.innerHTML = updatedText;
};

info.addTo(map);

map.on("baselayerchange", function(eventLayer){
    if (eventLayer.name === "All Flooding Calls"){
      info.update(callLegend);
    }
    else if (eventLayer.name === "Basement Flooding Calls") {
      info.update(basementLegend);
    }
    else if (eventLayer.name === "Calls by Zip Code") {
      info.update(getZipLegend());
    }
    else if (eventLayer.name === "Calls by Community Area") {
      info.update(getCommLegend());
    }
});

var zipReq = new XMLHttpRequest();
zipReq.open("GET", "data/chi_zip_web.geojson", true);
zipReq.onload = function() {
    if (zipReq.status === 200) {
        var jsonResponse = JSON.parse(zipReq.responseText);
        jsonResponse.features.map(function(feature) {
          zipLayer.addData(feature);
          zipScaleLayer.addData(feature);
        });
    }
    else {
        console.log('error');
    }
};
zipReq.onerror = function() {
    console.log('error');
};
zipReq.send();

var commReq = new XMLHttpRequest();
commReq.open("GET", "data/chi_comm_web.geojson", true);
commReq.onload = function() {
    if (commReq.status === 200) {
        var jsonResponse = JSON.parse(commReq.responseText);
        jsonResponse.features.map(function(feature) {
          commLayer.addData(feature);
          commScaleLayer.addData(feature);
        });
    }
    else {
        console.log('error');
    }
};
commReq.onerror = function() {
    console.log('error');
};
commReq.send();

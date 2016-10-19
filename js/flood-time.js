var baseLayer = L.tileLayer('https://cartodb-basemaps-{s}.global.ssl.fastly.net/dark_all/{z}/{x}/{y}.png', {
  attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, &copy; <a href="https://carto.com/attributions">CARTO</a>'
});

var map = L.map('map', {
  center: [41.88, -87.63],
  zoom: 10,
  minZoom: 10,
  maxZoom: 16,
  maxBounds: [[41.644335, -87.940267], [42.0231311, -87.524044]]
});

map.addLayer(baseLayer);

// Based off of http://bl.ocks.org/pbogden/16417ea36900f44710b2
var svg = d3.select(map.getPanes().overlayPane).append("svg"),
    g = svg.append("g").attr("class", "leaflet-zoom-hide");
var transform = d3.geo.transform({point: projectPoint}),
    path = d3.geo.path().projection(transform);
var dataset = [];
var pathBounds = {};

d3.json("data/comm_bboxes.topojson", function(error, bboxes) {
  var features = bboxes.objects.comm_bboxes.geometries.map(function(d) {
    return topojson.feature(bboxes, d);
  });
  var all = topojson.merge(bboxes, bboxes.objects.comm_bboxes.geometries);

  var cells = g.selectAll("path")
      .data(features)
      .enter()
      .append("path")
      .attr("fill-opacity",0);

  map.on("viewreset", reset);
  reset();

  // Reposition the SVG to cover the features.
  function reset() {
    var bounds = path.bounds(all),
        topLeft = bounds[0],
        bottomRight = bounds[1];

    svg.attr("width", bottomRight[0] - topLeft[0])
       .attr("height", bottomRight[1] - topLeft[1])
       .style("left", topLeft[0] + "px")
       .style("top", topLeft[1] + "px");

    g.attr("transform", "translate(" + -topLeft[0] + "," + -topLeft[1] + ")");

    cells.attr("d", path);
    cells.append("canvas");
  }
  g.selectAll("path").each(function(d) {
    pathBounds[d.properties.comm_area] = path.bounds(d);
  });
});

// Use Leaflet to implement a D3 geometric transformation.
function projectPoint(x, y) {
  // Returns the map layer point that corresponds to the given geographical coordinates
  var point = map.latLngToLayerPoint(new L.LatLng(y, x));
  this.stream.point(point.x, point.y);
}

function makeBounds(comm) {
  var bounds = pathBounds[comm];
  return {
    x: (Math.random() * (bounds[1][0] - bounds[0][0])) + bounds[0][0],
    y: (Math.random() * (bounds[1][1] - bounds[0][1])) + bounds[0][1]
  };
}

// Based off of http://chriswhong.com/projects/phillybiketheft/
d3.csv("data/flood_calls_30min_1mo.csv", function(collection) {
  /* Add a LatLng object to each item in the dataset */
  collection.forEach(function(d) {
    var loc = makeBounds(d.comm_area);
    d.UnixDate = Math.floor(new Date(d.timestamp)/1000);
    d.LatLng = new L.LatLng(loc.y,loc.x);
    d.x = loc.x;
    d.y = loc.y;
  });

  var time = 1470286800;
  var previousTime;

  var filtered = collection.filter(function(d){
    return (d.UnixDate < 1474002001);
  });


  function update() {
    previousTime = time;
    time = time + 1800;//86400;
    if (time >= 1474002001) {
      clearTimeout();
    }

    showDateTime(time);

    grab = collection.filter(function(d){
      return (d.UnixDate <= time)&&(d.UnixDate > previousTime);
    });
    filtered = grab;
    var feature = g.selectAll("circle")
      .data(filtered,function(d){
        return d.comm_area;
      });
    feature.enter().append("circle").attr("fill",function(d){
      if(d.call_type=='Water in Basement') return "blue";
      if(d.call_type=='Water in Street') return "red";

    }).attr("r",0).transition().duration(100).attr("r",function(d){
      return map.getZoom();
    });

    feature.exit().transition().duration(350)
      .attr("r",function(d){return map.getZoom()/2;})
      .style("opacity",0)
      .remove();

    feature.attr("cx",function(d) { return d.x});
    feature.attr("cy",function(d) { return d.y});

    setTimeout(update,100);
  }

  function showDateTime(unixtime){
    var newDate = new Date();
    newDate.setTime(unixtime*1000);
    dateString = newDate.toString();
    dateString = dateString.slice(0,21);
    document.getElementById("timestamp").innerHTML = dateString;
  }

  update();
});

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

// Gradient pulled from http://www.visualcinnamon.com/2016/05/animate-gradient-imitate-flow-d3.html
//Container for the gradient
var defs = svg.append("defs");
//Append a linear horizontal gradient
var linearGradient = defs.append("linearGradient")
	.attr("id","animate-gradient") //unique id to reference the gradient by
	.attr("x1","200%")
	.attr("y1","0%")
	.attr("x2","100%")
	.attr("y2","0")
	//Make sure the areas before 0% and after 100% (along the x)
	//are a mirror image of the gradient and not filled with the
	//color at 0% and 100%
	.attr("spreadMethod", "reflect");

// Same color at beginning and end for smooth transition
var colors = ["#f39c12", "#fcd9b0", "#f39c12"];

linearGradient.selectAll(".stop")
	.data(colors)
	.enter().append("stop")
	.attr("offset", function(d,i) { return i/(colors.length-1); })
	.attr("stop-color", function(d) { return d; });

linearGradient.append("animate")
	.attr("attributeName","x1")
	.attr("values","200%;100%")
	.attr("dur","1s")
	.attr("repeatCount","indefinite");

linearGradient.append("animate")
	.attr("attributeName","x2")
	.attr("values","100%;0%")
	.attr("dur","1s")
	.attr("repeatCount","indefinite");

d3.json("data/mwrd_riverways.geojson", function(data) {
  var transform = d3.geo.transform({point: projectPoint}),
      path = d3.geo.path().projection(transform);

  var feature = g.selectAll("path")
    .data(data.features)
    .enter()
    .append("path")
    .attr("d", path)
    .style("fill-opacity", 0)
    .attr("stroke-width", 3)
    .attr("stroke", "url(#animate-gradient)");

  map.on("viewreset", reset);
  reset();

  function reset() {
    var bounds = path.bounds(data),
    topLeft = bounds[0],
    bottomRight = bounds[1];

    svg.attr("width", bottomRight[0] - topLeft[0])
      .attr("height", bottomRight[1] - topLeft[1])
      .style("left", topLeft[0] + "px")
      .style("top", topLeft[1] + "px");

    g.attr("transform", "translate(" + -topLeft[0] + "," + -topLeft[1] + ")");

    feature.attr("d", path);
  }

  function projectPoint(x, y) {
    var point = map.latLngToLayerPoint(new L.LatLng(y, x));
    this.stream.point(point.x, point.y);
  }
});

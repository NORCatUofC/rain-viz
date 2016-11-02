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

var info = L.control({position: "bottomleft"});

info.onAdd = function (map) {
    this._div = L.DomUtil.create('div', 'info'); // create a div with a class "info"
    this._div.innerHTML = '<h4>Legend</h4>' +
      '<p><canvas id="legend-canvas"></canvas> Rain by intensity</p>' +
      '<p><svg xmlns="http://www.w3.org/2000/svg" version="1.1" style= "width:10px; height:10px">'  +
      '<circle cx="5" cy="5" r="5" fill="#3366ff"/>' +
  		'</svg><span>Basement Flooding</span></p>';
    return this._div;
};

info.addTo(map);

// Based off of http://bl.ocks.org/pbogden/16417ea36900f44710b2
// Declare global variables for going through timestamps
// Need to refine this, make into actual time scale potentially, but
// currently the timestamps are regular by hour
var svg = d3.select(map.getPanes().overlayPane).append("svg"),
    commSvg = d3.select(map.getPanes().overlayPane).append("svg"),
    csoSvg = d3.select(map.getPanes().overlayPane).append("svg"),
    g = svg.append("g").attr("class", "leaflet-zoom-hide"),
    commG = commSvg.append("g").attr("class", "leaflet-zoom-hide"),
    csoG = csoSvg.append("g").attr("class", "leaflet-zoom-hide");
var timeIdx = 0;
var dataset = [];
var timeRow = [];
var dateNotice = document.getElementById("date");
var unixDate = 1366174800;
var transform = d3.geo.transform({point: projectPoint}),
    path = d3.geo.path().projection(transform);
var pathBounds = {};
var commAll;
var intervalStep = 200;

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

var csoFeature;
var csoData;

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

d3.json("data/chicago_grid.topojson", function(error, grid) {
  var features = grid.objects.chicago_grid.geometries.map(function(d) {
    return topojson.feature(grid, d);
  });
  var all = topojson.merge(grid, grid.objects.chicago_grid.geometries);

  var cells = g.selectAll("path")
      .data(features)
      .enter()
      .append("path")
      .attr("class", "rain-cell");

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
});

d3.json("data/comm_bboxes.topojson", function(error, bboxes) {
  var features = bboxes.objects.comm_bboxes.geometries.map(function(d) {
    return topojson.feature(bboxes, d);
  });
  commAll = topojson.merge(bboxes, bboxes.objects.comm_bboxes.geometries);
  features.forEach(function(d) {
    pathBounds[d.properties.comm_area] = d3.geo.bounds(d);
  });

  map.on("viewreset", reset);
  reset();

  // Reposition the SVG to cover the features.
  function reset() {
    var bounds = path.bounds(commAll),
        topLeft = bounds[0],
        bottomRight = bounds[1];

    commSvg.attr("width", bottomRight[0] - topLeft[0])
       .attr("height", bottomRight[1] - topLeft[1])
       .style("left", topLeft[0] + "px")
       .style("top", topLeft[1] + "px");

    commG.attr("transform", "translate(" + -topLeft[0] + "," + -topLeft[1] + ")");
  }
  addCallData();
});

// Use Leaflet to implement a D3 geometric transformation.
function projectPoint(x, y) {
  // Returns the map layer point that corresponds to the given geographical coordinates
  var point = map.latLngToLayerPoint(new L.LatLng(y, x));
  this.stream.point(point.x, point.y);
}

d3.csv("data/april_2013_grid_15min.csv", function(data) {
   dataset = data.map(function(d) {
     // Overly complicated one-liner to get the timestamp as first item, then get
     // array of all values in order without keys
     return [d["timestamp"]].concat(Object.keys(d).slice(0,-1).map(function(k){return parseFloat(d[k]);}));
   });
});

// Iterates through rows of CSV with timestamps, resets on end
// Now CSV is every 15 minutes
function updateTime() {
  if (timeIdx === dataset.length) {
    timeIdx = 0;
    unixDate = 1366174800;
  }
  if (dataset.length > 0) {
    timeRow = dataset[timeIdx];
    unixDate = Math.floor(new Date(dataset[timeIdx][0])/1000);
    dateNotice.innerText = timeRow[0];
    timeIdx += 1;
  }
}
setInterval(updateTime, intervalStep);


var RainLayer = L.CanvasLayer.extend({
  // HTML Canvas rain effect based off of https://codepen.io/ruigewaard/pen/JHDdF
  // Need to size off of level of zoom
  makeRain: function(gridCell, canvas, speed) {
    var cbb = canvas.getBoundingClientRect();
    var ctx = canvas.getContext('2d');
    var bb = gridCell.getBoundingClientRect();
    var _zoom = this.zoomLevel;

    // Need cutoff because extremely low values skew things
    // Increasing from 100 to 200 because doing 15 minutes instead of an hour
    if (timeRow[speed+1] > 0.1) {
      speed = Math.floor(timeRow[speed + 1] * 200);
    }
    else {
      speed = 0;
    }

    for (var c = 0; c < speed; c++) {
      // Create random locations based off of bounding box off of d3 path location
      // Need to subtract difference between overall canvas offset and the D3 path
      var r = {
        x: (Math.random() * bb.width) + (bb.left - cbb.left),
        y: (Math.random() * bb.height) + (bb.top - cbb.top),
        l: Math.random() * 1,
        xs: -4 + Math.random() * 4 + 2,
        ys: Math.random() * 20 + 10
      };
      ctx.beginPath();
      ctx.moveTo(r.x, r.y);

      // Scale length based on zoom value
      var yEnd = r.y + (((_zoom-10)+1)* 3);

      ctx.lineTo(r.x, yEnd);
      ctx.stroke();
      // Arbitrary for slight movements
      r.y += 0.1;
      if (r.x > (bb.right - cbb.left) || r.y > (bb.bottom - cbb.top)) {
        r.x = (Math.random() * bb.width) + (bb.left - cbb.left);
        r.y = 0;
      }
    }
  },
  rainScaling: function(canvas) {
    var gridCells = d3.selectAll("path")[0];
    // Make sure timeRow has been populated, if so, run
    if (timeRow.length > 0) {
      for (var i = 0; i < gridCells.length; ++i) {
        this.makeRain(gridCells[i], canvas, i);
      }
    }
  },
  render: function() {
    var canvas = this.getCanvas();
    var w = canvas.width;
    var h = canvas.height;
    var ctx = canvas.getContext('2d');

    // Can clear out whole rect because doing full animationFrames
    ctx.clearRect(0, 0, w, h);
    // Could scale this color based on intensity as well
    ctx.strokeStyle = 'rgba(174,194,224,0.5)';
    this.zoomLevel = map.getZoom();
    ctx.lineWidth = 1;
    // Scale lineWidth based on zoom
    if (map.getZoom() > 10) {
      ctx.lineWidth = map.getZoom() - 10;
    }
    ctx.lineCap = 'round';

    this.rainScaling(canvas);
    this.redraw();
  },
  // Adding back in to change line about resetting on move as well
  onAdd: function (map) {
    this._map = map;

    // add container with the canvas to the tile pane
    // the container is moved in the oposite direction of the
    // map pane to keep the canvas always in (0, 0)
    var tilePane = this._map._panes.tilePane;
    var _container = L.DomUtil.create('div', 'leaflet-layer');
    _container.appendChild(this._canvas);
    _container.appendChild(this._backCanvas);
    this._backCanvas.style.display = 'none';
    tilePane.appendChild(_container);

    this._container = _container;

    // hack: listen to predrag event launched by dragging to
    // set container in position (0, 0) in screen coordinates
    if (map.dragging.enabled()) {
      map.dragging._draggable.on('predrag', function() {
        var d = map.dragging._draggable;
        L.DomUtil.setPosition(this._canvas, { x: -d._newPos.x, y: -d._newPos.y });
      }, this);
    }

    map.on({ 'viewreset': this._reset }, this);
    // CHANGED //
    map.on('move', this._reset, this);
    map.on('resize', this._reset, this);
    map.on({
        'zoomanim': this._animateZoom,
        'zoomend': this._endZoomAnim
    }, this);

    if(this.options.tileLoader) {
      this._initTileLoader();
    }

    this._reset();
  }
});

var rainLayer = new RainLayer();
rainLayer.addTo(map);

function makePoint(bounds) {
  return {
    x: (Math.random() * (bounds[1][0] - bounds[0][0])) + bounds[0][0],
    y: (Math.random() * (bounds[1][1] - bounds[0][1])) + bounds[0][1]
  };
}

function addCallData() {
  canvasEl = document.getElementById("legend-canvas");
  rainLayer.makeRain(canvasEl, canvasEl, 1);
  // Based off of http://chriswhong.com/projects/phillybiketheft/
  d3.csv("data/april_2013_wib_calls.csv", function(collection) {
    /* Add a LatLng object to each item in the dataset */
    collection.forEach(function(d) {
      var loc = makePoint(pathBounds[d.comm_area]);
      d.UnixDate = Math.floor(new Date(d.timestamp)/1000);
      d.LatLng = new L.LatLng(loc.y,loc.x);
    });

    function update() {
      grab = collection.filter(function(d){
        // Changing unix diff to 15 minutes (900)
        return (d.UnixDate <= unixDate)&&(d.UnixDate > (unixDate - 900));
      });
      filtered = grab;

      // Return ID as value, so that even if the timestamp exists already still adds
      var feature = commG.selectAll("circle").data(filtered, function(d) {return d.id;});
      feature.enter().append("circle").attr("fill","#3366ff").attr("r",5).style("opacity",0.75);

      map.on("viewreset",updatePoint);
      updatePoint();

      function updatePoint() {
        commG.selectAll("circle").attr("transform", function(d) {
          return "translate(" + map.latLngToLayerPoint(d.LatLng).x + "," +
          map.latLngToLayerPoint(d.LatLng).y + ")";
        });
      }

      feature.exit().transition().duration(500)
        .attr("r",function(d){return map.getZoom()/2;})
        .style("opacity",0)
        .remove();
    }
    update();
    setInterval(update, intervalStep);
  });
}

d3.json("data/mwrd_riverways.geojson", function(data) {
  csoData = data;

  map.on("viewreset", reset);
  reset();

  function reset() {
    var bounds = path.bounds(data),
    topLeft = bounds[0],
    bottomRight = bounds[1];

    csoSvg.attr("width", bottomRight[0] - topLeft[0])
      .attr("height", bottomRight[1] - topLeft[1])
      .style("left", topLeft[0] + "px")
      .style("top", topLeft[1] + "px");

    csoG.attr("transform", "translate(" + -topLeft[0] + "," + -topLeft[1] + ")");

    if (csoFeature != undefined) {
      csoFeature.attr("d", path);
    }
  }
  addEventData();
});


function addEventData() {
  d3.csv("data/april_2013_cso.csv", function(collection) {
    var csoFeatures = collection.map(function(d) {
      var feature = getSegment(parseInt(d.river_segment_id));
      if (feature !== null) {
        feature.properties.unixOpen = Math.floor(new Date(d.open_timestamp)/1000);
        feature.properties.unixClose = Math.floor(new Date(d.close_timestamp)/1000);
        return feature;
      }
      return null;
    }).filter(function(d) { return d != null; });

    function getSegment(segmentId) {
      var feature = null;
      csoData.features.forEach(function(d) {
        if (d.properties.SEGMENT_ID === segmentId) {
          feature = d;
        }
      });
      return feature;
    }

    function update() {
      grab = csoFeatures.filter(function(d){
        return (d.properties.unixClose >= unixDate)&&(d.properties.unixOpen <= unixDate);
      });
      filtered = grab;

      // Return ID as value, so that even if the timestamp exists already still adds
      csoFeature = csoG.selectAll("path")
        .data(filtered, function(d) { return d.properties.SEGMENT_ID});

      csoFeature.enter()
        .append("path")
        .attr("d", path)
        .style("fill-opacity", 0)
        .attr("stroke-width", 3)
        .attr("stroke", "url(#animate-gradient)");

      csoFeature.exit()
        .transition()
        .duration(350)
        .style("opacity",0)
        .remove();
    }

    update();
    setInterval(update, intervalStep);
  });
}

var baseLayer = L.tileLayer('http://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png', {
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

d3.json("data/chicago_grid.topojson", function(error, grid) {
  var transform = d3.geo.transform({point: projectPoint}),
      path = d3.geo.path().projection(transform);

  var features = grid.objects.chicago_grid.geometries.map(function(d) {
    return topojson.feature(grid, d);
  });
  var all = topojson.merge(grid, grid.objects.chicago_grid.geometries);

  var cells = g.selectAll("path")
      .data(features)
      .enter()
      .append("path");

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

// Use Leaflet to implement a D3 geometric transformation.
function projectPoint(x, y) {
  // Returns the map layer point that corresponds to the given geographical coordinates
  var point = map.latLngToLayerPoint(new L.LatLng(y, x));
  this.stream.point(point.x, point.y);
}


// Declare global variables for going through timestamps
// Need to refine this, make into actual time scale potentially, but
// currently the timestamps are regular by hour
var timeIdx = 0;
var dataset = [];
var timeRow = [];
var dateNotice = document.getElementById("date");

d3.csv("data/chi_grid_1mo_hr.csv", function(data) {
   dataset = data.map(function(d) {
     // Overly complicated one-liner to get the timestamp as first item, then get
     // array of all values in order without keys
     return [d["timestamp"]].concat(Object.keys(d).slice(0,-1).map(function(k){return parseFloat(d[k]);}));
   });
});

// Iterates through rows of CSV with timestamps, resets on end
function updateTime() {
  if (timeIdx === dataset.length) {
    timeIdx = -1;
  }
  if (dataset.length > 0) {
    timeIdx += 1;
    timeRow = dataset[timeIdx];
    dateNotice.innerText = timeRow[0];
  }
}
setInterval(updateTime, 100);


var RainLayer = L.CanvasLayer.extend({
  // HTML Canvas rain effect based off of https://codepen.io/ruigewaard/pen/JHDdF
  // Need to size off of level of zoom
  makeRain: function(gridCell, canvas, speed) {
    var cbb = canvas.getBoundingClientRect();
    var ctx = canvas.getContext('2d');
    var bb = gridCell.getBoundingClientRect();
    var _zoom = this.zoomLevel;

    // Need cutoff because extremely low values skew things
    if (timeRow[speed+1] > 0.1) {
      speed = Math.floor(timeRow[speed + 1] * 100);
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

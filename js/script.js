var baseLayer = L.tileLayer('http://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png', {
  attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, &copy; <a href="https://carto.com/attributions">CARTO</a>'
});

var map = L.map('map', {
  center: [41.88, -87.63],
  zoom: 10,
  minZoom: 9,
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

// Need to figure out how to redraw existing random rain items on map move without
// starting over, and another way of making it slower without this interval
var RainLayer = L.CanvasLayer.extend({
  rainArray: [],
  // HTML Canvas rain effect based off of https://codepen.io/ruigewaard/pen/JHDdF
  // Need to size off of level of zoom
  makeRain: function(gridCell, canvas, speed) {
    var ctx = canvas.getContext('2d');
    var bb = gridCell.getBoundingClientRect();
    ctx.clearRect(bb.left, bb.top, bb.width, bb.height);
    var rainArr = this.rainArray;

    for(var c = 0; c < rainArr.length; c++) {
      var r = {
        x: (rainArr[c].x * bb.width) + bb.left,
        y: (rainArr[c].y * bb.height) + bb.top,
        l: rainArr[c].l * 1,
        xs: -4 + rainArr[c].xs * 4 + 2,
        ys: rainArr[c].ys * 20 + 10
      };
      ctx.beginPath();
      ctx.moveTo(r.x, r.y);
      // ctx.lineTo(p.x + p.l * p.xs, p.y + p.l * p.ys);
      ctx.lineTo(r.x, r.y + 3);
      ctx.stroke();
      r.y += (speed / (rainArr.length * 1.5)) * bb.height;
      // r.y += r.ys;
      if (r.x > bb.right || r.y > bb.bottom) {
        r.x = (Math.random() * bb.width) + bb.left;
        r.y = 0;
      }
    }
  },
  rainScaling: function(canvas) {
    var _times = this.startTimes;
    var gridCells = d3.selectAll("path")[0];
    var current = new Date().getTime();
    for (var i = 0; i < gridCells.length; ++i) {
      var delta = current - _times[i];
      if (delta > 100) {
        this.makeRain(gridCells[i], canvas, i);
        _times[i] = new Date().getTime();
      }
    }
  },
  // Need to have separate start time for each cell
  startTimes: Array(365).fill(new Date().getTime()),
  render: function() {
    var canvas = this.getCanvas();
    var w = canvas.width;
    var h = canvas.height;
    var ctx = canvas.getContext('2d');

    // Could scale this color based on intensity as well
    ctx.strokeStyle = 'rgba(174,194,224,0.5)';
    ctx.lineWidth = 1;
    ctx.lineCap = 'round';

    // var init = [];
    this.rainArray = [];
    var _rainArr = this.rainArray;

    // Here's where density of rain can be increased
    var maxParts = 15;
    for(var a = 0; a < maxParts; a++) {
      _rainArr.push({
        x: Math.random(),
        y: Math.random(),
        l: Math.random(),
        xs: Math.random(),
        ys: Math.random()
      });
    };
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

var baseLayer = L.tileLayer('https://cartodb-basemaps-{s}.global.ssl.fastly.net/light_all/{z}/{x}/{y}.png', {
  attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, &copy; <a href="https://carto.com/attributions">CARTO</a>'
});

var map = L.map('map', {
  center: [41.88, -87.73],
  zoom: initialZoom,
  minZoom: 9,
  maxZoom: 16,
  maxBounds: [[41.0, -88.5], [43.5, -87.0]]
});

map.addLayer(baseLayer);

// Based off of http://bl.ocks.org/pbogden/16417ea36900f44710b2
// Declare global variables for going through timestamps
// Need to refine this, make into actual time scale potentially, but
// currently the timestamps are regular by hour
var svg = d3.select(map.getPanes().overlayPane).append("svg"),
    csoSvg = d3.select(map.getPanes().overlayPane).append("svg"),
    g = svg.append("g").attr("class", "leaflet-zoom-hide"),
    csoG = csoSvg.append("g").attr("class", "leaflet-zoom-hide");

// Geographic path transformation variables
var transform = d3.geo.transform({point: projectPoint}),
    path = d3.geo.path().projection(transform);
var pathBounds = {};
var commAll;

// Time incrementing variables
var timeIdx = 0;
var dataset = [];
var timeRow = [];
var dateNotice = document.getElementById("date");
var unixDate = 1366174800;
var intervalStep = 200;
var intervalArr = [];

// Time chart variables
var timeChart = document.querySelector(".time-chart");
var timeChartWidth = timeChart.offsetWidth;
var timeChartHeight = timeChart.offsetHeight;
var precipChartData, callChartData, csoChartData;
var precipChartPath, callChartPath, csoChartPath;

var x = d3.time.scale()
  .range([0, timeChartWidth]);
var y = d3.scale.linear()
  .range([timeChartHeight, 0]);
// Epoch timestamps for 4/17/2013 and 4/21/2013
x.domain([new Date(1366200000000), new Date(1366545600000)]);

var xAxis = d3.svg.axis()
  .scale(x)
  .orient("bottom");
var yAxis = d3.svg.axis()
  .scale(y)
  .orient("left")
  .ticks(4);

var timeChartSvg = d3.select(".time-chart").append("svg")
  .attr("width", timeChartWidth)
  .attr("height", timeChartHeight)
  .attr("class","time-chart")
  .append("g");

// define the clipPath
timeChartSvg.append("clipPath")
    .attr("id", "line-clip")
  .append("rect")
    .attr("x", 0)
    .attr("y", 0)
    .attr("width", 0)
    .attr("height", timeChartHeight);

// Line chart addition
function makeTimeChart(timeChartData) {
  var area = d3.svg.area()
    .interpolate("basis")
    .x(function(d) { return x(d.time); })
    .y0(timeChartHeight)
    .y1(function(d) { return y(d.precip); });

  y.domain([0, d3.max(timeChartData, function (d) { return d.precip; })]);

  precipChartPath = timeChartSvg.append("path").attr("class", "time-chart precip-data")
    .attr("d", area(timeChartData))
    .attr("clip-path", "url(#line-clip)");

  timeChartSvg.append("g")
    .attr("class", "x axis time-chart")
    .attr("transform", "translate(0," + timeChartHeight + ")")
    .call(xAxis)
    .append("text")
    .attr("y", 9)
    .attr("x", 39)
    .attr("dy", ".71em")
    .style("text-anchor", "end")
    .text("Time");

  timeChartSvg.append("g")
    .attr("class", "y axis time-chart")
    .call(yAxis)
    .append("text")
    .attr("transform", "rotate(-90)")
    .attr("y", 6)
    .attr("dy", ".71em")
    .attr("font-size", "11px")
    .style("text-anchor", "end")
    .text("Rain, Calls, CSOs");
}

function makeCallTimeChart(callData) {
  var area = d3.svg.area()
    .interpolate("basis")
    .x(function(d) { return x(d.time); })
    .y0(timeChartHeight)
    .y1(function(d) { return y(d.calls); });

  y.domain([0, d3.max(callData, function (d) { return d.calls; })]);

  callChartPath = timeChartSvg.append("path").attr("class", "time-chart call-data")
    .attr("d", area(callData))
    .attr("clip-path", "url(#line-clip)");
}

function makeCsoTimeChart(eventData) {
  var area = d3.svg.area()
    .interpolate("basis")
    .x(function(d) { return x(d.time); })
    .y0(timeChartHeight)
    .y1(function(d) { return y(d.events); });

  y.domain([0, d3.max(eventData, function (d) { return d.events; })]);

  csoChartPath = timeChartSvg.append("path").attr("class", "time-chart cso-data")
    .attr("d", area(eventData))
    .attr("clip-path", "url(#line-clip)");
}

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

function makeDate(dateString) {
  var d = dateString.split(/[^0-9]/);
  var newDate = new Date(d[0], d[1]-1, d[2], d[3], d[4], d[5]);
  return newDate;
}

function roundMinutes(date) {
    date.setHours(date.getHours() + Math.round(date.getMinutes()/60));
    date.setMinutes(0);
    return date;
}

d3.json(baseUrl + "/data/chicago_grid.topojson", function(error, grid) {
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

d3.json(baseUrl + "/data/comm_bboxes.topojson", function(error, bboxes) {
  var features = bboxes.objects.comm_bboxes.geometries.map(function(d) {
    return topojson.feature(bboxes, d);
  });
  commAll = topojson.merge(bboxes, bboxes.objects.comm_bboxes.geometries);
  features.forEach(function(d) {
    pathBounds[d.properties.comm_area] = d3.geo.bounds(d);
  });
  addCallData();
});

// Use Leaflet to implement a D3 geometric transformation.
function projectPoint(x, y) {
  // Returns the map layer point that corresponds to the given geographical coordinates
  var point = map.latLngToLayerPoint(new L.LatLng(y, x));
  this.stream.point(point.x, point.y);
}

d3.csv(baseUrl + "/data/april_2013_grid_15min_mdw.csv", function(data) {
   dataset = data.map(function(d) {
     // Overly complicated one-liner to get the timestamp as first item, then get
     // array of all values in order without keys
     return [d["timestamp"], d["midway_precip"]].concat(Object.keys(d).slice(0,-2).map(function(k){return parseFloat(d[k]);}));
   });
   precipChartData = data.filter(function(d) {
     return d.midway_precip > 0;}
   ).map(function(d) {
     var item = {
       time: makeDate(d.timestamp),
       precip: d.midway_precip
     };
     return item;
   });
   makeTimeChart(precipChartData);
});

var rainCount = 0.0;
var rainCountSpan = document.getElementById("rain-counter");

// Iterates through rows of CSV with timestamps, resets on end
// Now CSV is every 15 minutes
function updateTime() {
  if (dataset.length > 0) {
    if (timeIdx === dataset.length) {
      intervalArr.forEach(function(d) { clearInterval(d); });
      csoG.selectAll("path").remove();
      g.selectAll("canvas").remove();
      return;
    }
    timeRow = dataset[timeIdx];
    var date = makeDate(dataset[timeIdx][0]);
    d3.select("#line-clip rect").attr("width", x(date));
    unixDate = Math.floor(date/1000);
    dateNotice.innerHTML = "<p>" + date.toLocaleDateString() + "</p><p>" + date.toLocaleTimeString() + "</p>";
    rainCount += parseFloat(dataset[timeIdx][1]);
    rainCountSpan.textContent = rainCount.toFixed(2);
    timeIdx += 1;
  }
}
intervalArr.push(setInterval(updateTime, intervalStep));


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
    if (timeRow[speed+2] > 0.1) {
      speed = Math.floor(timeRow[speed+2] * 100);
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
      var yEnd = r.y + (((_zoom-9)+1)* 3);

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
    ctx.strokeStyle = 'rgba(51,64,116,0.5)';
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

var callCount = 0;
var callCountSpan = document.getElementById('flood-counter');

function addCallData() {
  // Based off of http://chriswhong.com/projects/phillybiketheft/
  d3.csv(baseUrl + "/data/april_2013_wib_calls.csv", function(collection) {
    /* Add a LatLng object to each item in the dataset */
    collection.forEach(function(d) {
      var loc = makePoint(pathBounds[d.comm_area]);
      d.UnixDate = Math.floor(makeDate(d.timestamp)/1000);
      d.LatLng = new L.LatLng(loc.y,loc.x);
    });

    callChartData = d3.nest()
      .key(function(d) { return roundMinutes(makeDate(d.timestamp)); })
      .rollup(function(v) { return v.length; })
      .entries(collection)
      .map(function(d) { return { time: Date.parse(d.key), calls: d.values }; });

    makeCallTimeChart(callChartData);

    function update() {
      grab = collection.filter(function(d){
        // Changing unix diff to 15 minutes (900)
        return (d.UnixDate <= unixDate)&&(d.UnixDate > (unixDate - 900));
      });
      filtered = grab;
      callCount += filtered.length;
      callCountSpan.textContent = callCount.toString();

      // Return ID as value, so that even if the timestamp exists already still adds
      var feature = g.selectAll("circle.call-data").data(filtered, function(d) {return d.id;});
      feature.enter()
        .append("circle")
        .attr("class", "call-data")
        .attr("fill","#c91a1a")
        .attr("r",5)
        .style("opacity",0.75);

      map.on("viewreset",updatePoint);
      updatePoint();

      function updatePoint() {
        g.selectAll("circle.call-data").attr("transform", function(d) {
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
    intervalArr.push(setInterval(update, intervalStep));
  });
}

d3.json(baseUrl + "/data/mwrd_riverways.geojson", function(data) {
  csoData = data;

  map.on("viewreset", resetCso);
  resetCso();

  function resetCso() {
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

var csoCountSpan = document.getElementById('cso-counter');

function addEventData() {
  d3.csv(baseUrl + "/data/april_2013_cso.csv", function(collection) {
    var csoFeatures = [];
    for (var i = 0; i < collection.length; ++i) {
      var d = collection[i];
      var feature = getSegment(parseInt(d.river_segment_id));
      if (feature !== null) {
        feature.properties.id = i;
        feature.properties.unixOpen = Math.floor(makeDate(d.open_timestamp)/1000);
        feature.properties.unixClose = Math.floor(makeDate(d.close_timestamp)/1000);
        csoFeatures.push(feature);
      }
    }

    csoChartData = d3.nest()
      .key(function(d) { return roundMinutes(makeDate(d.open_timestamp)); })
      .rollup(function(v) { return v.length; })
      .entries(collection)
      .map(function(d) { return {time: Date.parse(d.key), events: d.values };});

    makeCsoTimeChart(csoChartData);

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
      // TODO: some items are very brief, skew data because don't appear
      grab = csoFeatures.filter(function(d){
        return (d.properties.unixOpen <= unixDate)&&(d.properties.unixClose > unixDate);
      });
      filtered = grab;

      // Return ID as value, so that even if the timestamp exists already still adds
      csoFeature = csoG.selectAll("path.cso-data")
        .data(filtered, function(d) { return d.properties.id; });

      csoFeature.enter()
        .append("path")
        .attr("d", path)
        .attr("class", "cso-data")
        .style("fill-opacity", 0)
        .attr("stroke-width", 3)
        .attr("stroke", "url(#animate-gradient)");

      countFilter = csoFeatures.filter(function(d) {
        return (d.properties.unixOpen <= unixDate);
      });
      csoCountSpan.textContent = countFilter.length.toString();

      csoFeature.exit()
        .transition()
        .duration(350)
        .style("opacity",0)
        .remove();
    }

    update();
    intervalArr.push(setInterval(update, intervalStep));
  });
}

// Rain animation in legend
var legendCanvas = document.getElementById("legend-canvas");

function makeLegendRain() {
  var lCtx = legendCanvas.getContext('2d');
  var w = legendCanvas.width;
  var h = legendCanvas.height;
  lCtx.strokeStyle = 'rgba(51,64,116,0.5)';
  lCtx.lineWidth = 1;
  lCtx.lineCap = 'round';
  lCtx.fillRect(0,0,w,h);

  var init = [];
  var maxDrops = 25;
  for (var c = 0; c < maxDrops; c++) {
    // Create random locations based off of bounding box off of d3 path location
    // Need to subtract difference between overall canvas offset and the D3 path
    init.push({
      x: Math.random() * w,
      y: Math.random() * h,
      l: Math.random() * 1,
      xs: -4 + Math.random() * 4 + 2,
      ys: Math.random() * 10 + 10
    });
  }

  var particles = [];
  for(var b = 0; b < maxDrops; b++) {
    particles[b] = init[b];
  }

  function draw() {
    lCtx.clearRect(0, 0, w, h);
    // lCtx.fillRect(0,0,w,h);
    for(var c = 0; c < particles.length; c++) {
      var p = particles[c];
      lCtx.beginPath();
      lCtx.moveTo(p.x, p.y);
      lCtx.lineTo(p.x + p.l * p.xs, p.y + p.l * p.ys);
      lCtx.stroke();
    }
    move();
  }

  function move() {
    for(var b = 0; b < particles.length; b++) {
      var p = particles[b];
      p.x += p.xs;
      p.y += p.ys;
      if(p.x > w || p.y > h) {
        p.x = Math.random() * w;
        p.y = -20;
      }
    }
  }

  setInterval(draw, 100);
}

makeLegendRain();

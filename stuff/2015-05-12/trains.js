"use strict";

function Train(track, leaveTrack) {
  this.track = track;
  
  this.n = null;
  this.segment = null;
  this.station = null;
  this.i = null;
  this.remainder = null;
  this.state = "starting";

  this.leaveTrack = leaveTrack;

  this.pos = { x : 500, y : 500 };
  this.last_time = null;
}
Train.extend({
  render : function (ctxt, time) {
    var timeDelta;
    if (this.last_time === null) {
      timeDelta = 0;
    } else {
      timeDelta = time - this.last_time;
    }
    this.last_time = time;
    if (timeDelta > 1000 / 30) { timeDelta = 1000 / 30; }
    
    var x, y;
    if (this.station === null) {
      this.pos.x = x = 150 + 28 * this.i;
      this.pos.y = y = 30;
    } else {
      var pos = this.station.trainPos();
      x = pos.x;
      y = pos.y;
    }
    if (this.state === "arrived") {
      this.pos.x = x;
      this.pos.y = y;
    }
    if (this.state === "traveling") {
      var pos2 = this.next_station.trainPos();
      var alpha = Math.pow(0.9, timeDelta / (1000 / 60));
      x = alpha * this.pos.x + (1 - alpha) * pos2.x;
      y = alpha * this.pos.y + (1 - alpha) * pos2.y;
      this.arrived = (Math.abs(x - this.pos.x) + Math.abs(y - this.pos.y)) <= 1;
      this.pos.x = x;
      this.pos.y = y;
    }
    ctxt.fillStyle = "#999";
    ctxt.fillRect(x, y - 15, 25, 13);
    ctxt.fillRect(x, y - 20, 12, 5);
    ctxt.lineWidth = 1;
    ctxt.strokeStyle = "#333";
    ctxt.beginPath();
    ctxt.moveTo(x + 2, y - 11.5); ctxt.lineTo(x + 25 - 2, y - 11.5);
    ctxt.moveTo(x + 2, y -9.5); ctxt.lineTo(x + 25 - 2, y - 9.5);
    ctxt.moveTo(x + 2, y -7.5); ctxt.lineTo(x + 25 - 2, y - 7.5);
    ctxt.moveTo(x + 5, y - 18.5); ctxt.lineTo(x + 11, y - 18.5);
    ctxt.moveTo(x + 5, y - 16.5); ctxt.lineTo(x + 11, y - 16.5);
    ctxt.stroke();
    
    ctxt.fillStyle = "#000";
    ctxt.beginPath();
    ctxt.arc(x + 4, y - 2.5, 2.5, 0, Math.PI * 2, true);
    ctxt.fill();
    ctxt.beginPath();
    ctxt.arc(x + 25 - 4, y - 2.5, 2.5, 0, Math.PI * 2, true);
    ctxt.fill();

    ctxt.fillStyle = "#fff";
    ctxt.font = "10px serif";
    ctxt.textAlign = "left";
    ctxt.textBaseline = "bottom";
    if (this.n !== null) {
      ctxt.fillText("" + this.n, x + 13, y - 15);
    }
    //ctxt.fillText("" + this.state, x, y - 27);
  },

  step : function () {
    if (this.segment === null) {
      if (this.state === "stopped")
        return;
      if (this.track.segments[0].lock()) {
        this.segment = this.track.segments[0];
      } else {
        return;
      }
    }

    if (this.station === null) {
      this.station = this.segment.stations[0];
      this.state = "arrived";
      return;
    }

    switch (this.state) {
    case "arrived" :
      this.segment.unwarn();
      if (this.segment.j === 0 && this.station.i === 0) {
        var n = this.track.next_n;
        if (n < 2) {
          if (n >= 1) {
            this.track.next_n--;
            this.station.value(this.station.value() + 2);
          }
          this.segment.unlock();
          this.segment = null;
          this.station = null;
          this.state = "stopped";
          return;
        }
        this.n = n;
        this.track.next_n--;

        this.remainder = 0;
        this.station.value(this.station.value() + 1);
      }
      var d = this.station.value() + 10 * this.remainder;
      this.station.value((d / this.n)|0);
      this.remainder = d % this.n;
      this.state = "leaving";
      break;
    case "leaving" :
      if (this.station.i === this.segment.stations.length - 1) {
        this.state = "switching";
      } else {
        this.next_station = this.segment.stations[this.station.i + 1];
        this.state = "traveling";
        this.arrived = false;
      }
      break;
    case "switching" :
      var next_i = (this.segment.j + 1) % this.track.segments.length;
      if (this.track.segments[next_i].lock()) {
        this.next_segment = this.track.segments[next_i];
        this.next_station = this.next_segment.stations[0];
        this.state = "unswitching";
      } else if (this.leaveTrack && next_i === 0) {
        this.state = "starting";
        this.segment.unlock();
        this.station = null;
        this.next_segment = this.segment = null;
      }
      break;
    case "unswitching" :
      this._segmentToUnlock = this.segment;
      this.segment = this.next_segment;
      this.state = "traveling";
      this.arrived = false;
      break;
    case "traveling" :
      this.station = this.next_station;
      if (this.arrived && Math.random() >= 0.5) {
        if (this._segmentToUnlock) {
          this._segmentToUnlock.unlock();
          this._segmentToUnlock = null;
        }
        this.state = "arrived";
      }
      break;
    }
  }
});

function Station(segment, i) {
  this.segment = segment;
  this.i = i;
  this._value = 0;
  this._oldValue = null;
  this._anim = 0;
  this.last_time = null;
  this.pos = { x : null, y : null, width : 30, height : 60, startwidth : 60, endwidth : 60 };
  this.at_start = false;
  this.at_end = false;
}
Station.extend({
  value : function (/*opt*/newV) {
    if (arguments.length === 0) {
      return this._value;
    } else {
      this._oldValue = this._value;
      this._anim = -0.4;
      this._value = newV;
      return this;
    }
  },
  place : function (x, y, at_start, at_end) {
    this.pos.x = x;
    this.pos.y = y;
    this.at_start = at_start;
    this.at_end = at_end;
  },
  signalPos : function () {
    var x = this.pos.x;
    var y = this.pos.y + this.pos.width;
    if (this.at_start) { x += this.pos.startwidth - this.pos.width; }
    return { x : x, y : y };
  },
  trainPos : function () {
    var x = this.pos.x + 2;
    var y = this.pos.y + this.pos.width - 3;
    if (this.at_start) { x += this.pos.startwidth - this.pos.width; }
    return { x : x, y : y };
  },
  render : function (ctxt, time) {
    var timeDelta;
    if (this.last_time === null) {
      timeDelta = 0;
    } else {
      timeDelta = time - this.last_time;
    }
    this.last_time = time;
    if (timeDelta > 1000 / 30) { timeDelta = 1000 / 30; }

    ctxt.fillStyle = "#fff";
    var x = this.pos.x;
    var y = this.pos.y + this.pos.width;
    if (this.at_start) { x += this.pos.startwidth - this.pos.width; }
    
    ctxt.fillRect(x, y, this.pos.width-1, this.pos.width);

    
    ctxt.save();
    ctxt.beginPath();
    ctxt.moveTo(x, y); ctxt.lineTo(x + this.pos.width - 1, y);
    ctxt.lineTo(x + this.pos.width - 1, y + this.pos.width);
    ctxt.lineTo(x, y + this.pos.width);
    ctxt.clip();

    ctxt.fillStyle = "#000";
    ctxt.font = "24px serif";
    ctxt.textAlign = "center";
    ctxt.textBaseline = "middle";

    if (this._oldValue !== null && this._anim < 1.05) {
      var animAlpha = Math.pow(0.85, timeDelta / (1000 / 60));
      this._anim = animAlpha * this._anim + (1 - animAlpha) * 1.07;
    } else {
      var animAlpha2 = Math.pow(0.6, timeDelta / (1000 / 60));
      this._oldValue = null;
      this._anim = animAlpha2 * this._anim + (1 - animAlpha2) * 1;
    }
    var h = this.pos.width;
    if (this._oldValue !== null) {
      ctxt.fillText('' + this._oldValue, x + this.pos.width / 2, y + this.pos.width / 2 + this._anim * h);
    }
    ctxt.fillText('' + this._value, x + this.pos.width / 2, y + this.pos.width / 2 - (1 - this._anim) * h);
    ctxt.restore();

    
    ctxt.strokeStyle = "#8090a0";
    ctxt.lineWidth = 2;
    ctxt.beginPath();
    ctxt.moveTo(x, y - 3);
    ctxt.lineTo(x + this.pos.width, y - 3);
    ctxt.stroke();

    var self = this;
    function drawOrb(x, y, r) {
      var rdisp = Math.sin(time / 100) * 0.4;
      var rdisp2 = Math.sin(time / 100 + Math.PI / 4) * 0.7;
      ctxt.fillStyle = "#7df9ff";
      ctxt.beginPath();
      ctxt.arc(x, y, r + rdisp,
               0, Math.PI * 2, true);
      ctxt.fill();
      ctxt.fillStyle = "#9dffff";
      ctxt.beginPath();
      ctxt.arc(x, y, 0.5 * r + rdisp2,
               0, Math.PI * 2, true);
      ctxt.fill();
    }

    if (this.at_start) {
      drawOrb(x - this.pos.width/2 - 2, y - this.pos.width/2, (this.pos.startwidth - this.pos.width) / 2);
    }
    if (this.at_end) {
      drawOrb(x + 3*this.pos.width/2 + 2, y - this.pos.width/2, (this.pos.startwidth - this.pos.width) / 2);
    }

  }
});

function TrackSegment(track, length, j) {
  this.track = track;
  this.j = j;
  this.signal = false;
  this.warning = false;
//  if (Math.random() > 0.5) this.signal = true;
  this.stations = [];
  for (var i = 0; i < length; i++) {
    this.stations.push(new Station(this, i));
  }
}
TrackSegment.extend({
  lock : function () {
    if (!this.signal) {
      this.signal = true;
      this.warning = true;
      return true;
    } else {
      return false;
    }
  },
  unwarn : function () {
    this.warning = false;
  },
  unlock : function () {
    this.signal = false;
  },
  place : function () {
    for (var i = 0; i < this.stations.length; i++) {
      this.track.place_station(this.stations[i]);
    }
  },
  render : function (ctxt, time) {

    var pos = this.stations[0].signalPos();
    ctxt.strokeStyle = "#000";
    ctxt.lineWidth = 4;
    ctxt.beginPath();
    ctxt.lineTo(pos.x + 2, pos.y);
    ctxt.lineTo(pos.x + 2, pos.y - 10);
    ctxt.stroke();
    ctxt.fillStyle = "#666";
    ctxt.fillRect(pos.x + 2 - 3, pos.y - 10 - 6, 6, 6);
    if (this.warning) {
      ctxt.fillStyle = "#0f0";
    } else if (this.signal) {
      ctxt.fillStyle = "#f00";
    } else {
      ctxt.fillStyle = "#ff0";
    }
    ctxt.beginPath();
    ctxt.arc(pos.x + 2, pos.y - 10 - 3, 2, 0, Math.PI * 2, true);
    ctxt.fill();

    for (var i = 0; i < this.stations.length; i++) {
      this.stations[i].render(ctxt, time);
    }

  }
});

function Track(nsegs, seglen, max_n) {
  this.segments = [];
  for (var i = 0; i < nsegs; i++) {
    this.segments.push(new TrackSegment(this, seglen, i));
  }
  this.pos = { x : 30, y : 30, width : 740, height : 540 };
  this.trains = [];

  this.flowx = 0;
  this.flowy = 60;
  this.stations_to_place = [];

  this.next_n = max_n;
}
Track.extend({
  new_train : function (leaveTrack) {
    var train = new Train(this, leaveTrack);
    this.trains.push(train);
    train.i = this.trains.length;
    return train;
  },
  place : function () {
    this.stations_to_place = [];
    for (var i = 0; i < this.segments.length; i++) {
      this.segments[i].place();
    }
    for (var i = 0; i < this.stations_to_place.length; i++) {
      var station = this.stations_to_place[i];
      if (this.stations_to_place.length - 1 === i
          || this.pos.width - this.flowx - station.pos.width < station.pos.endwidth) {
        station.place(this.pos.x + this.flowx, this.pos.y + this.flowy, this.flowx == 0, true);
        this.flowy += station.pos.height * 1.5;
        this.flowx = 0;
      } else {
        station.place(this.pos.x + this.flowx, this.pos.y + this.flowy, this.flowx == 0, false);
        if (this.flowx == 0) {
          this.flowx += station.pos.startwidth;
        } else {
          this.flowx += station.pos.width;
        }
      }
    }
  },
  place_station : function (station) {
    this.stations_to_place.push(station);
  },
  render : function (ctxt, time) {
    ctxt.fillStyle = "#000";
    ctxt.font = "24px serif";
    ctxt.textAlign = "left";
    ctxt.textBaseline = "top";
    ctxt.fillText("Next n: " + this.next_n, this.pos.x, this.pos.y);
    
    for (var i = 0; i < this.segments.length; i++) {
      this.segments[i].render(ctxt, time);
    }
    for (var i = 0; i < this.trains.length; i++) {
      this.trains[i].render(ctxt, time);
    }
  }
});

var dodraw = true;

function redraw(time, track) {
  window.requestAnimationFrame(function (time) {
    redraw(time, track);
  });

  dodraw = !dodraw;
//  if (!dodraw) { return; }

  var canvas = document.getElementById("canvas");
  var ctxt = canvas.getContext("2d");
  ctxt.fillStyle = "#84c011";
  ctxt.fillRect(0, 0, 800, 600);

  track.render(ctxt, time);
}

function showError(txt) {
  document.getElementById("error").innerHTML = txt;
}

var simulationInterval = null;

function buildTrainSystem() {
  window.clearInterval(simulationInterval);
  document.getElementById("error").innerHTML = "";
  
  var form = document.getElementById("settings");
  var numtrains = +form.elements['numtrains'].value;
  var numsegments = +form.elements['numsegs'].value;
  var numstations = +form.elements['numstations'].value;
  var maxdivisor = +form.elements['maxdivisor'].value;
  var leaveTrack = form.elements['leaveTrack'].checked;
  if (isNaN(numtrains) || numtrains <= 0) {
    showError("Number of trains must be non-negative integer");
    return;
  }
  if (isNaN(numsegments) || numsegments <= 0) {
    showError("Number of segments must be a non-negative integer");
    return;
  }
  if (isNaN(numstations) || numstations <= 0) {
    showError("Number of stations must be a non-negative integer");
    return;
  }
  if (isNaN(maxdivisor) || maxdivisor <= 0) {
    showError("Maximum divisor must be a non-negative integer");
    return;
  }

  var track = new Track(numsegments, numstations, maxdivisor);
  window.track = track;
  track.place();

  var trains = [];
  for (var i = 0; i < numtrains; i++) {
    trains.push(track.new_train(leaveTrack));
  }

  redraw(0, track);

  simulationInterval = window.setInterval(function () {
    var idxs = [];
    for (var i = 0; i < trains.length; i++) idxs.push(i);

    for (var i = idxs.length; i > 0; i--) {
      var ridx = (Math.random() * i)|0;
      var t = idxs[i-1];
      idxs[i-1] = idxs[ridx];
      idxs[ridx] = t;
    }

    idxs.forEach(function (i) {
      if (Math.random() < 0.99) {
        trains[i].step();
      }
    });
  }, 10);

}

window.addEventListener("load", function () {
  document.getElementById("settings").addEventListener("submit", function (e) {
    e.preventDefault();
    buildTrainSystem();
    return false;
  });
  
  buildTrainSystem();

}, false);

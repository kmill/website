function CanvasHolder(canvas) {
  this.canvas = canvas;
  this.ctxt = canvas.getContext("2d");
  this.resize = this.resize.bind(this).debounce(200);
  this.redraw = null;
  this._animate = null;
}
CanvasHolder.extend({
  engage : function () {
    window.addEventListener("resize", this.resize, false);
    this.resize();
  },
  resize : function () {
    var dim = this.canvas.parentElement.getBoundingClientRect();
    this.width = this.canvas.width = dim.width;
    this.height = this.canvas.height = dim.height;
    this.ensureAnimate();
  },
  ensureAnimate : function () {
    if (this._animate === null) {
      var self = this;
      this._animate = window.requestAnimationFrame(function (time) {
        self._animate = null;
        self.ensureAnimate();
        if (self.redraw !== null) {
          self.redraw(time, self);
        }
      });
    }
  }
});

function KeyboardListener() {
  this.keys = new Set;
  this.ctrl = false;
  this.alt = false;
  this.shift = false;

  var self = this;
  document.addEventListener("keydown", function (e) {
    self.ctrl = e.ctrlKey;
    self.alt = e.altKey || e.metaKey;
    self.shift = e.shiftKey;
    self.keys.add(e.keyCode);
    //console.log("down " + self.toString());
  }, false);
  document.addEventListener("keyup", function (e) {
    self.ctrl = e.ctrlKey;
    self.alt = e.altKey || e.metaKey;
    self.shift = e.shiftKey;
    self.keys.delete(e.keyCode);
    //console.log("up " + self.toString());
  }, false);
}
KeyboardListener.extend({
  toString : function () {
    var codes = [];
    this.keys.forEach(function (code) { codes.push(code); });
    return "KeyboardListener(ctrl=" + this.ctrl + ",alt=" + this.alt + ",shift=" + this.shift
      + ",[" + codes.toString() + "])";
  }
});

function drawPerson(time, holder) {
  var ctxt = holder.ctxt;
  var width = holder.width;
  var height = holder.height;

  ctxt.save();
  ctxt.lineWidth = 2;
  ctxt.rotate(Math.sin(time/1200) * 0.05);
  ctxt.fillStyle = "#000";

  // body
  ctxt.beginPath();
  ctxt.arc(0, -14, 14, 0, Math.PI * 2, true);
  ctxt.moveTo(0, 0);
  ctxt.lineTo(0, 30);
  ctxt.moveTo(4, -6);
  ctxt.arc(0, -6, 4, 0, Math.PI * 2, true);
  ctxt.moveTo(6, -16);
  ctxt.arc(4, -16, 2, 0, Math.PI * 2, true);
  ctxt.moveTo(-2, -16);
  ctxt.arc(-4, -16, 2, 0, Math.PI * 2, true);
  ctxt.stroke();
  // hair
  ctxt.beginPath();
  for (var i = -5; i <= 5; i++) {
    var x = i * 2.75;
    var y = -Math.sqrt(14*14 - x*x)-14;
    ctxt.moveTo(x, y);
    ctxt.lineTo(x + Math.sin(time/(102+i)) * 1 + Math.sin(time/504) * 1, y - 33 + Math.sin(time/(100+i)) * 1);
  }
  ctxt.stroke();

  // right leg;
  ctxt.save();
  ctxt.translate(0, 30);
  ctxt.rotate(Math.sin(time/500) * 0.2);
  ctxt.beginPath();
  ctxt.moveTo(0, 0);
  ctxt.lineTo(10, 30);
  ctxt.lineTo(17, 30);
  ctxt.stroke();
  ctxt.restore();

  // left leg;
  ctxt.save();
  ctxt.translate(0, 30);
  ctxt.rotate(Math.cos(time/500) * 0.2);
  ctxt.beginPath();
  ctxt.moveTo(0, 0);
  ctxt.lineTo(-10, 30);
  ctxt.lineTo(-17, 30);
  ctxt.stroke();
  ctxt.restore();

  // right arm;
  ctxt.save();
  ctxt.translate(0, 10);
  ctxt.rotate(Math.cos(time/300) * 0.2);
  ctxt.beginPath();
  ctxt.moveTo(0, 0);
  ctxt.lineTo(20, 0);
  ctxt.stroke();
  ctxt.restore();

  // left arm;
  ctxt.save();
  ctxt.translate(0, 10);
  ctxt.rotate(Math.sin(time/300) * 0.2);
  ctxt.beginPath();
  ctxt.moveTo(0, 0);
  ctxt.lineTo(-20, 0);
  ctxt.stroke();
  ctxt.restore();

  ctxt.restore();
}

var playerState = {
  x : 0,
  y : 50,
  vx : 0,
  vy : 3
};

function redraw(time, holder) {
  var ctxt = holder.ctxt;
  var width = holder.width;
  var height = holder.height;
  
  ctxt.fillStyle = "#87cefa";
  ctxt.fillRect(0,0,width,height);

  //ctxt.strokeStyle = "solid #000";
  //ctxt.rect(0.5,0.5,width-1,height-1);
  //ctxt.stroke();

  var maxX = 3;

  if (kl.keys.has(39)) {
    playerState.vx += 0.2;
    if (playerState.vx >= maxX) {
      playerState.vx = maxX;
    }
  }
  if (kl.keys.has(37)) {
    playerState.vx -= 0.2;
    if (playerState.vx <= -maxX) {
      playerState.vx = -maxX;
    }
  }

  playerState.vy += 2 * 1 / 1000;

  playerState.x += playerState.vx;
  playerState.y += playerState.vy;

  playerState.vx *= 0.99;

  playerState.y = (playerState.y + height) % height;
  playerState.x = (playerState.x + width) % width;

  var y = playerState.y;
  var x = (playerState.x + width / 2) % width;

  function circle(x, y, r) {
    ctxt.moveTo(x+r,y);
    ctxt.arc(x,y,r,0,2*Math.PI,true);
  }

  for (var i = 0; i < 30; i++) {
    ctxt.save();
    ctxt.fillStyle = "#fff";
    ctxt.translate((Math.sin(i * 3001) * width / 2 + width + Math.sin(i * 2001) * time / 300) % width, height/2 + height / 2 *Math.sin(i * 1000));
    ctxt.beginPath();
    circle(0, 0, 10);
    circle(8, -3, 10);
    circle(6, 6, 10);
    circle(16, 2, 10);
    circle(22, -2, 10);
    circle(20, 4, 10);
    ctxt.fill();
    ctxt.restore();
  }  
  ctxt.save();
  ctxt.translate(x, y);
  drawPerson(time, holder);
  ctxt.restore();
  ctxt.save();
  ctxt.translate(x, y + height);
  drawPerson(time, holder);
  ctxt.restore();
  ctxt.save();
  ctxt.translate(x, y - height);
  drawPerson(time, holder);
  ctxt.restore();
}

window.addEventListener("load", function () {
  var kl = window.kl = new KeyboardListener();
  var canvas = document.getElementById("game");
  window.canvas = canvas;
  var holder = new CanvasHolder(canvas);
  holder.redraw = redraw;
  holder.engage();
}, false);

"use strict";

var scr, play, keys;

function XYPoint(x, y) {
  this.XCoor = x|0;
  this.YCoor = y|0;
}

function spaces(n) {
  var s = '';
  for (var i = 0; i < n; i++) s += ' ';
  return s;
}

// Constants
const SPEEDCONST = 500;
const HITSELF = 1;
const BACKATTR = 0;
const OBJECTCOLOR = 1;
const WINDOWCOLOR = 14;
const SUNATTR = 3;
const SUNHAPPY = false;
const SUNSHOCK = true;
const RIGHTUP = 1;
const LEFTUP = 2;
const ARMSDOWN = 3;

// Global variables
var GorillaX = [null, 0, 0];
var GorillaY = [null, 0, 0];
var LastBuilding;
var LBan, RBan, UBan, DBan;
var GorD = [], GorL = [], GorR = [];

var gravity, Wind;

// Screen mode variables
var ScrHeight;
var ScrWidth;
var MaxCol;

// Screen color variables
var ExplosionColor;
var SunColor;
var BackColor;
var SunHit;

var SunHt;
var GHeight;
var MachSpeed = 0.5; // seconds to pause

function bytes(i) {
  return [i&0xff, (i>>>8)&0xff, (i>>>16)&0xff, (i>>>24)&0xff];
}

function FnRan(x) {
  return Math.floor(Math.random()*x) + 1;
}

function runPauseable(f, /*opt*/v) {
  var v = f.next(v);
  if (v.done) {
    console.log("finished pauseable");
    return;
  }
  var p = v.value;
  switch (p.cmd) {
  case "pause":
    window.setTimeout(function () {
      runPauseable(f);
    }, p.timeout);
    break;
  case "key":
    keys.nextKey(function (k) {
      runPauseable(f, k);
    });
    break;
  case "play":
    play.play(p.song);
    play.wake(function () {
      runPauseable(f);
    });
    break;
  default:
    throw new Error;
  }
}

function* start() {
  while (1) {
    InitVars();
    yield* Intro();
    var pName1 = [""], pName2 = [""], pNumGames = [0];
    yield* GetInputs(pName1, pName2, pNumGames);
    yield* GorillaIntro(pName1, pName2);
    yield* PlayGame(pName1, pName2, pNumGames);
  }
}

function InitVars() {
  ScrWidth = 640;
  ScrHeight = 350;
  GHeight = 25;
  LBan = [458758,202116096,471604224,943208448,943208448,943208448,471604224,202116096,0];
  DBan = [262153, -2134835200, -2134802239, -2130771968, -2130738945,8323072, 8323199, 4063232, 4063294];
  UBan = [262153, 4063232, 4063294, 8323072, 8323199, -2130771968, -2130738945, -2134835200,-2134802239];
  RBan = [458758, -1061109760, -522133504, 1886416896, 1886416896, 1886416896,-522133504,-1061109760,0];

  SunHt = 39;
}

function* Intro() {
  MaxCol = 80;
  scr.color(15,0);
  scr.cls();

  Center(3, "JavaScript                     ");
  Center(4, "Q B a s i c    G O R I L L A S");
  scr.line(180, 14*3+3, 280, 14*4-3, 4);
  scr.color(7);
  Center(6, "Copyright (C) Microsoft Corporation 1990");
  Center(8, "Your mission is to hit your opponent with the exploding");
  Center(9, "banana by varying the angle and power of your throw, taking");
  Center(10, "into account wind speed, gravity, and the city skyline.");
  Center(11, "The wind speed is shown by a directional arrow at the bottom");
  Center(12, "of the playing field, its length relative to its strength.");
  Center(24, "Press any key to continue");

//  scr.line(250, 14*5+3, 470, 14*6-3, 4);
  //  scr.line(254, 14*6-4, 465, 14*5+4, 4);
  Center(7, "                               (& Kyle Miller 2016)");
//  scr.line(290, 14*6+8, 340, 14*6+8, 4);

  play.play("MBT160O1L8CDEDCDL4ECC");
  yield* SparklePause();

  scr.flip();
}

function* GetInputs(pPlayer1, pPlayer2, pNumGames) {
  scr.color(7, 0);
  scr.cls();

  scr.locate(8, 15);
  scr.print("Name of Player 1 (Default = 'Player 1'): ");
  scr.flip();
  pPlayer1[0] = yield* lineInput();
  if (pPlayer1[0] === "") {
    pPlayer1[0] = "Player 1";
  } else {
    pPlayer1[0] = pPlayer1[0].slice(0, 10);
  }

  scr.locate(10, 15);
  scr.print("Name of Player 2 (Default = 'Player 2'): ");
  scr.flip();
  pPlayer2[0] = yield* lineInput();
  if (pPlayer2[0] === "") {
    pPlayer2[0] = "Player 2";
  } else {
    pPlayer2[0] = pPlayer2[0].slice(0, 10);
  }

  do {
    scr.locate(12, 56);
    scr.print(spaces(25));
    scr.locate(12, 13);
    scr.print("Play to how many total points (Default = 3)? ");
    scr.flip();
    var game = yield* lineInput();
    pNumGames[0] = ~~+game.slice(0, 2);
  } while (!(pNumGames[0] > 0 && game.length < 3 || game.length === 0));
  if (pNumGames[0] === 0) pNumGames[0] = 3;

  do {
    scr.locate(14, 53);
    scr.print(spaces(28));
    scr.locate(14, 17);
    scr.print("Gravity in Meters/Sec (Earth = 9.8)? ");
    scr.flip();
    var grav = yield* lineInput();
    gravity = +grav;
  } while (!(gravity > 0 || grav.length === 0));
  if (gravity === 0) gravity = 9.8;
}

function* GorillaIntro(pPlayer1, pPlayer2) {
  scr.locate(16, 34); scr.print("--------------");
  scr.locate(18, 34); scr.print("V = View Intro");
  scr.locate(19, 34); scr.print("P = Play Game");
  scr.locate(21, 35); scr.print("Your Choice?");
  scr.flip();

  var char = "";
  while (char === "") {
    char = yield {cmd:"key"};
  }

  var x = 278;
  var y = 175;

  scr.cls();
  scr.color(15, 0);
  SetScreen();

//  scr.setPalette(OBJECTCOLOR, BackColor);

  DrawGorilla(x, y, ARMSDOWN);
  scr.cls();
  DrawGorilla(x, y, LEFTUP);
  scr.cls();
  DrawGorilla(x, y, RIGHTUP);
  scr.cls();

  scr.setPalette(OBJECTCOLOR, 46);

  if (char.toUpperCase() === 'V') {
    Center(2, "Q B A S I C   G O R I L L A S");
    Center(5, "             STARRING:               ");
    Center(7, pPlayer1[0] + " AND " + pPlayer2[0]);

    scr.put(x-13, y, GorD);
    scr.put(x+47, y, GorD);
    scr.flip();
    yield* pause(1000);

    scr.put(x-13, y, GorL);
    scr.put(x+47, y, GorR);
    scr.flip();
    yield {cmd:"play",
           song:"t120o1l16b9n0baan0bn0bn0baaan0b9n0baan0b"};
    yield* pause(300);

    scr.put(x-13, y, GorR);
    scr.put(x+47, y, GorL);
    scr.flip();
    yield {cmd:"play",
           song:"o2l16e-9n0e-d-d-n0e-n0e-n0e-d-d-d-n0e-9n0e-d-d-n0e-"};
    yield* pause(300);

    scr.put(x-13, y, GorL);
    scr.put(x+47, y, GorR);
    scr.flip();
    yield {cmd:"play",
           song:"o2l16g-9n0g-een0g-n0g-n0g-eeen0g-9n0g-een0g-"};
    yield* pause(300);

    scr.put(x-13, y, GorR);
    scr.put(x+47, y, GorL);
    scr.flip();
    yield {cmd:"play",
           song:"o2l16b9n0baan0g-n0g-n0g-eeen0o1b9n0baan0b"};
    yield* pause(300);

    for (var i = 1; i <= 4; i++) {
      scr.put(x-13, y, GorL);
      scr.put(x+47, y, GorR);
      scr.flip();
      yield {cmd:"play",
             song:"T160O0L32EFGEFDC"};
      yield* pause(100);
      scr.put(x-13, y, GorR);
      scr.put(x+47, y, GorL);
      scr.flip();
      yield {cmd:"play",
             song:"T160O0L32EFGEFDC"};
      yield* pause(100);
    }
  }
}

function DrawGorilla(x, y, arms) {
  var i; // float

  // draw head
  scr.box(x-4, y, x+3, y+6, OBJECTCOLOR);
  scr.box(x-5, y+2, x+4, y+4, OBJECTCOLOR);

  // draw eyes/brow
  scr.line(x-3, y+2, x+2, y+2, 0);

  // draw nose
  for (var i = -2; i <= -1; i++) {
    scr.pset(x+i, y+4, 0);
    scr.pset(x+i+3, y+4, 0);
  }

  // neck
  scr.line(x-3, y+7, x+2, y+7, OBJECTCOLOR);

  // body
  scr.box(x-8, y+8, x+7, y+14, OBJECTCOLOR);
  scr.box(x-6, y+15, x+5, y+20, OBJECTCOLOR);

  // legs
  for (var i = 0; i <= 4; i++) {
    scr.circle(x+i, y+25, 10, OBJECTCOLOR, 3*Math.PI/4, 9*Math.PI/8);
    scr.circle(x-6+i, y+25, 10, OBJECTCOLOR, 15*Math.PI/8, Math.PI/4);
  }

  // chest
  scr.circle(x-5, y+10, 5, 0, 3*Math.PI/2, 0);
  scr.circle(x+5, y+10, 5, 0, Math.PI, 3*Math.PI/2);

  for (var i = -5; i <= -1; i++) {
    switch (arms) {
    case 1:
      // Right arm up
      scr.circle(x+i, y+14, 9, OBJECTCOLOR, 3*Math.PI/4, 5*Math.PI/4);
      scr.circle(x+5+i, y+4, 9, OBJECTCOLOR, 7*Math.PI/4, Math.PI/4);
      scr.get(x-15, y-1, x+14, y+28, GorR);
      break;
    case 2:
      // Left arm up
      scr.circle(x+i, y+4, 9, OBJECTCOLOR, 3*Math.PI/4, 5*Math.PI/4);
      scr.circle(x+5+i, y+14, 9, OBJECTCOLOR, 7*Math.PI/4, Math.PI/4);
      scr.get(x-15, y-1, x+14, y+28, GorL);
      break;
    case 3:
      scr.circle(x+i, y+14, 9, OBJECTCOLOR, 3*Math.PI/4, 5*Math.PI/4);
      scr.circle(x+5+i, y+14, 9, OBJECTCOLOR, 7*Math.PI/4, Math.PI/4);
      scr.get(x-15, y-1, x+14, y+28, GorD);
      break;
    }
  }
}

function SetScreen() {
  ExplosionColor = 2;
  BackColor = 1;
  scr.setPalette(0, 1);
  scr.setPalette(1, 46);
  scr.setPalette(2, 44);
  scr.setPalette(3, 54);
  scr.setPalette(5, 7);
  scr.setPalette(6, 4);
  scr.setPalette(7, 3);
  scr.setPalette(9, 63); // Display Color
}

function* lineInput() {
  var pos = scr.pos();
  scr.toggleCursor(true);
  scr.flip();
  var str = "";
  var ostr = "";
  var i = 0;
  while (true) {
    var k = yield {cmd:"key"};
    if (k.length === 1 && k.charCodeAt(0) >= 0x20 && k.charCodeAt(0) < 0x7f) {
      str = str.slice(0, i) + k + str.slice(i);
      i++;
    } else if (k === "Backspace") {
      if (i > 0) {
        str = str.slice(0, i-1) + str.slice(i);
        i--;
      }
    } else if (k === "ArrowLeft") {
      if (i > 0) {
        i--;
      }
    } else if (k === "ArrowRight") {
      if (i < str.length) {
        i++;
      }
    } else if (k === "Enter") {
      break;
    } else {
      console.log("key", k);
    }
    scr.locate(pos.row, pos.col);
    scr.print(str);
    for (var j = str.length; j < ostr.length; j++) {
      scr.print(' ');
    }
    ostr = str;
    scr.locate(pos.row, pos.col+i);
    scr.flip();
  }
  scr.toggleCursor(false);
  scr.flip();
  return str;
}

function* SparklePause() {
  scr.color(4, 0);
  var A = "*    *    *    *    *    *    *    *    *    *    *    *    *    *    *    *    *    ";

  while (keys.inkey() != "") { /* clear input buffer */ }

  while (keys.inkey() == "") {
    for (var a = 1; a <= 5; a++) {
      scr.locate(1, 1); // print horizontal sparkles
      scr.print(A.slice(a, a+80));
      scr.locate(22, 1);
      scr.print(A.slice(6-a, 6-a+80));
      
      for (var b = 2; b <= 21; b++) { // print vertical sparkles
        var c = (a + b) % 5;
        if (c == 1) {
          scr.locate(b, 80);
          scr.print('*');
          scr.locate(23-b, 1);
          scr.print('*');
        } else {
          scr.locate(b, 80);
          scr.print(' ');
          scr.locate(23-b, 1);
          scr.print(' ');
        }
      }

      scr.flip();
      yield* pause(1000/30);
    }
  }
}

function* PlayGame(pPlayer1, pPlayer2, pNumGames) {
  var BCoor = [];
  for (var i = 0; i <= 30; i++) {
    BCoor.push(new XYPoint(0, 0));
  }
  var TotalWins = [null, 0, 0];

  var J = 1;

  for (var i = 1; i <= pNumGames[0]; i++) {
    scr.cls();
    yield* MakeCityScape(BCoor);
    yield* PlaceGorillas(BCoor);
    yield* DoSun(SUNHAPPY);
    var Hit = false;
    while (!Hit) {
      J = 1-J;
      scr.locate(1, 1);
      scr.print(pPlayer1[0]);
      scr.locate(1, MaxCol - 1 - pPlayer2[0].length);
      scr.print(pPlayer2[0]);
      Center(23,
             TotalWins[1].toString().slice(0,1)
             +">Score<"
             +TotalWins[2].toString().slice(0,1));
      var pTosser = [J+1]; var Tossee = 3-J;
      scr.flip();

      //Plot the shot. Hit is true if Gorilla gets hit
      Hit = yield* DoShot(pTosser, GorillaX[pTosser[0]], GorillaY[pTosser[0]]);

      if (SunHit) yield* DoSun(SUNHAPPY);

      if (Hit) UpdateScores(TotalWins, pTosser[0], Hit);
    }
    yield* pause(1000);
  }

  scr.color(7, 0);
  scr.resetPalette();
  scr.cls();
  Center(8, "GAME OVER!");
  Center(10, "Score:");
  scr.locate(11, 30); scr.print(pPlayer1[0]);
  scr.locate(11, 50); scr.print(''+TotalWins[1]);
  scr.locate(12, 30); scr.print(pPlayer2[0]);
  scr.locate(12, 50); scr.print(''+TotalWins[2]);
  Center(24, "Press any key to continue");
  scr.flip();
  
  yield* SparklePause();
  scr.color(7, 0);
  scr.cls();

  scr.locate(25, 1); scr.print("Press any key to continue");
  scr.flip();
  yield {cmd:"key"};
}

function* MakeCityScape(BCoor) {
  var x = 2;
  var Slope = FnRan(6);
  var NewHt;
  switch (Slope) {
  case 1: NewHt = 15; break; // Upward slope
  case 2: NewHt = 130; break; // Downward slope
  case 3:
  case 4:
  case 5: NewHt = 15; break; // "V" slope - most common
  case 6: NewHt = 130; break; // Inverted "V" slope
  }

  var BottomLine = 335; // Bottom of bilding
  var HtInc = 10; // Increase value for new height
  var DefBWidth = 37; // Default building height
  var RandomHeight = 120; // Random height difference
  var WWidth = 3; // Window width
  var WHeight = 6; // Window height
  var WDifV = 15; // Counter for window spacing - vertical
  var WDifh = 10; // Counter for window spacing - horizontal

  var CurBuilding = 1;
  do {
    switch (Slope) {
    case 1: NewHt = NewHt + HtInc; break;
    case 2: NewHt = NewHt - HtInc; break;
    case 3:
    case 4:
    case 5:
      if (x > Math.floor(ScrWidth / 2)) {
        NewHt = NewHt - 2*HtInc;
      } else {
        NewHt = NewHt + 2*HtInc;
      }
      break;
    case 6: // fixed bug in original (had 4)
      if (x > Math.floor(ScrWidth / 2)) {
        NewHt = NewHt + 2*HtInc;
      } else {
        NewHt = NewHt - 2*HtInc;
      }
      break;
    }

    //Set width of building and check to see if it would go off the screen
    var BWidth = FnRan(DefBWidth) + DefBWidth;
    if (x + BWidth > ScrWidth) BWidth = ScrWidth - x - 2;

    //Set height of building and check to see if it goes below screen
    var BHeight = FnRan(RandomHeight) + NewHt;
    if (BHeight < HtInc) BHeight = HtInc;

    var MaxHeight = 0; // bug in original.  MaxHeight is not a variable! defaults to 0
    //Check to see if Building is too high
    if (BottomLine - BHeight <= MaxHeight + GHeight)
      BHeight = MaxHeight + GHeight - 5;

    //Set the coordinates of the building into the array
    BCoor[CurBuilding].XCoor = x;
    BCoor[CurBuilding].YCoor = BottomLine - BHeight;

    var BuildingColor = FnRan(3)+4;

    var BACKGROUND = 0; // bug in original. not a variable! defaults to 0
    //Draw the building, outline first, then filled
    function boxout(x1, y1, x2, y2, col) {
      scr.line(x1, y1, x2, y1, col);
      scr.line(x1, y2, x2, y2, col);
      scr.line(x1, y1, x1, y2, col);
      scr.line(x2, y1, x2, y2, col);
    }
    boxout(x-1, BottomLine+1, x+BWidth+1, BottomLine-BHeight-1, BACKGROUND);
    scr.box(x, BottomLine, x+BWidth, BottomLine-BHeight, BuildingColor);

    //Draw the windows
    var c = x+3;
    do {
      for (var i = BHeight - 3; i >= 7; i -= WDifV) {
        var WinColr;
        if (FnRan(4) === 1) {
          WinColr = 8;
        } else {
          WinColr = WINDOWCOLOR;
        }
        scr.box(c, BottomLine-i, c+WWidth, BottomLine-i+WHeight, WinColr);
      }
      scr.flip();
      yield* pause(10);
      c = c + WDifh;
    } while (!(c >= x + BWidth - 3));

    x = x + BWidth + 2;

    CurBuilding = CurBuilding + 1;
  } while (!(x > ScrWidth - HtInc));

  LastBuilding = CurBuilding - 1;

  // Set Wind speed
  Wind = FnRan(10) - 5;
  if (FnRan(3) === 1) {
    if (Wind > 0) {
      Wind = Wind + FnRan(10);
    } else {
      Wind = Wind - FnRan(10);
    }
  }

  // Draw Wind speed arrow
  if (Wind !== 0) {
    var WindLine = Wind * 3 * Math.floor(ScrWidth / 320);
    scr.line(Math.floor(ScrWidth/2), ScrHeight-5,
             Math.floor(ScrWidth/2) + WindLine, ScrHeight-5,
             ExplosionColor);
    var ArrowDir;
    if (Wind > 0) ArrowDir = -2; else ArrowDir = 2;
    scr.line(Math.floor(ScrWidth/2) + WindLine, ScrHeight-5,
             Math.floor(ScrWidth/2) + WindLine + ArrowDir, ScrHeight - 5 - 2,
             ExplosionColor);
    scr.line(Math.floor(ScrWidth/2) + WindLine, ScrHeight-5,
             Math.floor(ScrWidth/2) + WindLine + ArrowDir, ScrHeight - 5 + 2,
             ExplosionColor);
  }
  scr.flip();
}

function* PlaceGorillas(BCoor) {
  var XAdj = 14;
  var YAdj = 30;

  // Place gorillas on second or third building from edge
  var BNum;
  for (var i = 1; i <= 2; i++) {
    if (i === 1) BNum = FnRan(2)+1; else BNum = LastBuilding-FnRan(2);
    var BWidth = BCoor[BNum+1].XCoor - BCoor[BNum].XCoor;
    GorillaX[i] = BCoor[BNum].XCoor + Math.floor(BWidth / 2) - XAdj;
    GorillaY[i] = BCoor[BNum].YCoor - YAdj;
    scr.put(GorillaX[i], GorillaY[i], GorD);
    scr.flip();
    yield* pause(10);
  }
}

function* DoSun(Mouth) {
  var x = Math.floor(ScrWidth / 2),
      y = 25;
  
  // clear old sun
  scr.box(x-22, y-18, x+22, y+18, BACKATTR);

  // draw new sun:
  // body
  scr.circle(x, y, 12, SUNATTR, 0, 2*Math.PI);
  scr.paint(x, y, SUNATTR);

  // rays
  scr.line(x-20, y, x+20, y, SUNATTR);
  scr.line(x, y-15, x, y+15, SUNATTR);

  scr.line(x-15, y-10, x+15, y+10, SUNATTR);
  scr.line(x-15, y+10, x+15, y-10, SUNATTR);

  scr.line(x-8, y-13, x+8, y+13, SUNATTR);
  scr.line(x-8, y+13, x+8, y-13, SUNATTR);

  scr.line(x-18, y-5, x+18, y+5, SUNATTR);
  scr.line(x-18, y+5, x+18, y-5, SUNATTR);

  // mouth
  if (Mouth) { // draw "o" mouth
    scr.circle(x, y+5, 3, 0, 0, 2*Math.PI);
    scr.paint(x, y+5, 0, 0);
  } else { // draw smile
    scr.circle(x, y, 8, 0,
               (210*Math.PI/180), (330*Math.PI/180));
  }

  // eyes
  scr.circle(x-3, y-2, 1, 0, 0, 2*Math.PI);
  scr.circle(x+3, y-2, 1, 0, 0, 2*Math.PI);
  scr.pset(x-3, y-2, 0);
  scr.pset(x+3, y-2, 0);

  scr.flip();
}

function* DoShot(pPlayerNum, x, y) {
  // Input shot
  var LocateCol;
  if (pPlayerNum[0] === 1) {
    LocateCol = 1;
  } else {
    LocateCol = 66;
  }
  
  scr.locate(2, LocateCol);
  scr.print("Angle:");
  var Angle = yield* GetNum(2, LocateCol + 7);

  scr.locate(3, LocateCol);
  scr.print("Velocity:");
  var Velocity = yield* GetNum(3, LocateCol + 10);

  if (pPlayerNum[0] === 2) {
    Angle = 180 - Angle;
  }

  // Erase input
  for (var i = 1; i <= 4; i++) {
    scr.locate(i, 1);
    scr.print(spaces(30));
    scr.locate(i, 50);
    scr.print(spaces(30));
  }
  scr.flip();

  SunHit = false;
  var PlayerHit = yield* PlotShot(x, y, Angle, Velocity, pPlayerNum[0]);
  if (PlayerHit === 0) {
    return false;
  } else {
    if (PlayerHit === pPlayerNum[0]) pPlayerNum[0] = 3 - pPlayerNum[0];
    yield* VictoryDance(pPlayerNum[0]);
    return true;
  }
}

function* PlotShot(StartX, StartY, Angle, Velocity, PlayerNum) {
  Angle = Angle / 180 * Math.PI;
  var Radius = 2;

  var InitXVel = Math.cos(Angle) * Velocity;
  var InitYVel = Math.sin(Angle) * Velocity;

  var oldx = StartX;
  var oldy = StartY;

  // draw gorilla toss
  if (PlayerNum === 1) {
    scr.put(StartX, StartY, GorL);
  } else {
    scr.put(StartX, StartY, GorR);
  }
  scr.flip();
  play.play("MBo0L32A-L64CL16BL64A+");
  yield* pause(100);

  // redraw gorilla
  scr.put(StartX, StartY, GorD);
  scr.flip();

  var adjust = 4;

  var xedge = 9*(2-PlayerNum); // find leading edge of banana for check

  var Impact = false;
  var ShotInSun = false;
  var OnScreen = true;
  var PlayerHit = 0;
  var NeedErase = false;

  var StartXPos = StartX;
  var StartYPos = StartY - adjust - 3;

  var direction;
  if (PlayerNum === 2) {
    StartXPos = StartXPos + 25;
    direction = 4;
  } else {
    direction = -4;
  }

  var x, y, pointval;
  var oldrot = 0;
  var t = 0;

  if (Velocity < 2) { // shot too slow - hit self
    x = StartX;
    y = StartY;
    pointval = OBJECTCOLOR;
  }

  while (!Impact && OnScreen) {
    yield* pause(1000/20);
    if (NeedErase) {
      NeedErase = false;
      DrawBan(oldx|0, oldy|0, oldrot|0, false);
    }

    x = StartXPos + (InitXVel * t) + (0.5 * (Wind/5) * t * t);
    y = StartYPos + ((-1 * InitYVel * t) + (0.5 * gravity * t * t)) * ScrHeight / 350;

    if (x >= ScrWidth - 10 || x <= 3 || y >= ScrHeight - 3) {
      OnScreen = false;
    }

    if (OnScreen && y > 0) {
      // check it
      var LookY = 0;
      var LookX = 8*(2-PlayerNum);
      do {
        pointval = scr.point((x+LookX)|0, (y+LookY)|0);
        //console.log((x+LookX)|0, (y+LookY)|0, pointval);
        if (pointval === 0) {
          Impact = false;
          if (ShotInSun) {
            if (Math.abs(Math.floor(ScrWidth/2) - x) > 20 || y > SunHt) {
              ShotInSun = false;
            }
          }
        } else if (pointval === SUNATTR && y < SunHt) {
          if (!SunHit) yield* DoSun(SUNSHOCK);
          SunHit = true;
          ShotInSun = true;
        } else {
          Impact = true;
        }
        LookX = LookX + direction;
        LookY = LookY + 6;
      } while (!(Impact || LookX != 4));

      if (!ShotInSun && !Impact) {
        // plot it
        var rot = Math.floor((t*10) % 4);
        DrawBan(x|0, y|0, rot|0, true);
        NeedErase = true;
      }

      oldx = x;
      oldy = y;
      oldrot = rot;
    }

    t = t + 0.1;
  }

  if (pointval !== OBJECTCOLOR && Impact) {
    yield* DoExplosion((x+adjust)|0, (y+adjust)|0);
  } else if (pointval === OBJECTCOLOR) {
    PlayerHit = yield* ExplodeGorilla(x|0, y|0);
  }

  return PlayerHit;
}

function DrawBan(xc, yc, r, bc) {
//  console.log("drawban", xc, yc, r, bc);
  var meth = bc ? 0 : 1;
  switch(r) {
  case 0:
    scr.put(xc, yc, LBan, meth);
    break;
  case 1:
    scr.put(xc, yc, UBan, meth);
    break;
  case 2:
    scr.put(xc, yc, DBan, meth);
    break;
  case 3:
    scr.put(xc, yc, RBan, meth);
    break;
  }
  scr.flip();
}

function* DoExplosion(x, y) {
  play.play("MBO0L32EFGEFDC");
  var Radius = ScrHeight / 50;
  var Inc = 0.5;
  for (var c = 0; c <= Radius; c += Inc) {
    scr.circle(x, y, c, ExplosionColor, 0, 2*Math.PI);
    scr.flip();
    yield* pause(10);
  }
  for (var c = Radius; c >= 0; c -= Inc) {
    scr.circle(x, y, c, BACKATTR, 0, 2*Math.PI);
    scr.flip();
    yield* pause(30);
  }
}

function* ExplodeGorilla(x, y) {
  var XAdj = 12;
  var YAdj = 5;
  var SclX = ScrWidth / 320;
  var SclY = ScrHeight / 200;
  var PlayerHit;
  if (x < ScrWidth / 2) PlayerHit = 1; else PlayerHit = 2;
  play.play("MBO0L16EFGEFDC");
  for (var i = 1; i <= 8*SclX; i++) {
    scr.ellipse((GorillaX[PlayerHit]+3.5*SclX+XAdj)|0,
                (GorillaY[PlayerHit]+7*SclY+YAdj)|0,
                i, ExplosionColor, -1.57);
    /*scr.line((GorillaX[PlayerHit]+7*SclX)|0,
             (GorillaY[PlayerHit]+9*SclY-i)|0,
             GorillaX[PlayerHit]|0,
             (GorillaY[PlayerHit]+9*SclY-i)|0,
             ExplosionColor);*/
    scr.flip();
    yield* pause(5);
  }
  for (var i = 1; i <= 16*SclX; i++) {
    if (i < 8*SclX) {
      scr.ellipse((GorillaX[PlayerHit]+3.5*SclX+XAdj)|0,
                  (GorillaY[PlayerHit]+7*SclY+YAdj)|0,
                  8*SclX + 1 - i, BACKATTR, -1.57);
    }
    scr.ellipse((GorillaX[PlayerHit]+3.5*SclX+XAdj)|0,
                (GorillaY[PlayerHit]+YAdj)|0,
                i, (i%2)+1, -1.57);
    scr.flip();
    yield* pause(5);
  }
  for (var i = (24*SclX)|0; i >= 1; i--) {
    scr.ellipse((GorillaX[PlayerHit]+3.5*SclX+XAdj)|0,
                (GorillaY[PlayerHit]+YAdj)|0,
                i, BACKATTR, -1.57);
    scr.flip();
    yield* pause(8);
  }
  return PlayerHit;
}

function* VictoryDance(Player) {
  for (var i = 1; i <= 4; i++) {
    scr.put(GorillaX[Player], GorillaY[Player], GorL);
    scr.flip();
    yield {cmd:"play",
           song:"MFO0L32EFGEFDC"};
    yield* pause(200);
    scr.put(GorillaX[Player], GorillaY[Player], GorR);
    scr.flip();
    yield {cmd:"play",
           song:"MFO0L32EFGEFDC"};
    yield* pause(200);
  }
}

function UpdateScores(Record, PlayerNum, Results) {
  if (Results === HITSELF) {
    Record[Math.abs(PlayerNum-3)] += 1;
  } else {
    Record[PlayerNum]++;
  }
}

function* GetNum(Row, Col) {
  var Result = "";
  var Done = false;
  while (keys.inkey() !== "") { /* clear input bufer */ }

  while (!Done) {
    Result = Result.slice(0, 7);
    scr.locate(Row, Col);
    scr.print(Result + "_       ");
    scr.flip();
    var Kbd = yield {cmd:"key"};
    if ('0' <= Kbd && Kbd <= '9') {
      Result = Result + Kbd;
    } else if (Kbd === '.') {
      if (Result.indexOf('.') === -1) {
        Result = Result + Kbd;
      }
    } else if (Kbd === "Enter") {
      if (+Result > 360) {
        Result = "";
      } else {
        Done = true;
      }
    } else if (Kbd === "Backspace") {
      if (Result.length > 0) {
        Result = Result.slice(0, Result.length-1);
      }
    } else if (Kbd.length > 0) {
      play.play("T120o2g8");
    }
  }

  scr.locate(Row, Col);
  scr.print(Result + " ");

  return +Result;
}

function* pause(t) {
  yield {cmd:"pause",
         timeout:t};
}

function Center(Row, Text) {
  var Col = Math.floor(MaxCol / 2);
  scr.locate(Row, Math.floor(Col - (Text.length/2 + 0.5)));
  scr.print(Text);
}

function getImageData(img) {
  var canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  var ctxt = canvas.getContext('2d');
  ctxt.drawImage(img, 0, 0, img.width, img.height);
  return ctxt.getImageData(0, 0, img.width, img.height);
}

function ScreenMode(canvas) {
  this.canvas = canvas;
  this.ctxt = canvas.getContext('2d');

  var ratio = getPixelRatio(this.ctxt);
  if (ratio !== 1) {
    var oldwidth = this.canvas.width;
    var oldheight = this.canvas.height;
    this.canvas.width = ratio*oldwidth;
    this.canvas.height = ratio*oldheight;
    this.canvas.style.width = oldwidth+"px";
    this.canvas.style.height = oldheight+"px";
//    this.ctxt.scale(ratio, ratio);
  }

  this.bcanvas = document.createElement('canvas');
  this.bcanvas.width = 640;
  this.bcanvas.height = 350;
  this.bctxt = this.bcanvas.getContext('2d');
  this.imgdata = this.bctxt.getImageData(0, 0, this.bcanvas.width, this.bcanvas.height);

  this.text = [];

  this.fg = 7;
  this.bg = 0;

  this.defaultPalette = [
    0x000000,
    0x0000aa,
    0x00aa00,
    0x00aaaa,
    0xaa0000,
    0xaa00aa,
    0xaa5500,
    0xaaaaaa,
    0x555555,
    0x5555ff,
    0x55ff55,
    0x55ffff,
    0xff5555,
    0xff55ff,
    0xffff55,
    0xffffff,
  ];

  this.palette = this.defaultPalette.slice();

  this.cursorChar = [-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 255, 255];
  
  this.cls();
}
ScreenMode.prototype.setPalette = function (i, col) {
  var r = ((col>>2)&1)*2+((col>>5)&1),
      g = ((col>>1)&1)*2+((col>>4)&1),
      b = ((col>>0)&1)*2+((col>>3)&1);
  var tab = [0x00, 0x55, 0xAA, 0xFF];
  this.palette[i] = (tab[r]<<16)|(tab[g]<<8)|tab[b];
};
ScreenMode.prototype.resetPalette = function () {
  this.palette = this.defaultPalette.slice();
};
ScreenMode.prototype.flip = function () {
  this.bctxt.putImageData(this.imgdata, 0, 0);
  var crat = this.canvas.width / this.canvas.height;
  var brat = this.bcanvas.width / this.bcanvas.height;
  if (brat >= crat) {
    this.ctxt.drawImage(this.bcanvas,
                        0, 0, this.bcanvas.width, this.bcanvas.height,
                        0, 0, this.canvas.width, this.canvas.width/brat);
  } else {
    this.ctxt.drawImage(this.bcanvas,
                        0, 0, this.bcanvas.width, this.bcanvas.height,
                        0, 0, this.canvas.height*brat, this.canvas.height);
  }
};
ScreenMode.prototype.cls = function () {
  for (var i = 0; i < 80*25; i++) {
    this.text[i] = 0x20;
  }
  var data = this.imgdata.data;
  var bg = this.palette[this.bg];
  for (var i = 0; i < data.length; i += 4) {
    data[i+0] = bg>>>16;
    data[i+1] = (bg>>>8)&0xff;
    data[i+2] = bg&0xff;
    data[i+3] = 255;
  }
  this.flip();

  this.locate(0, 0);
};
ScreenMode.prototype.put = function (x, y, img, meth) {
  // img is an array of 32-bit ints from SCREEN 9 (four planes)
  function b(i) {
    var idx = i&0x3;
    return (img[i>>>2]>>>(idx<<3))&0xff;
  }
  var width = 1+(b(1)|b(0));
  var height = 1+(b(3)|b(2));
  var wup = (width+7)&~0x7;

  var data = this.imgdata.data;
  var wdata = this.bcanvas.width;
  for (var dy = 0; dy < height; dy++) {
    for (var dx = 0; dx < width; dx++) {
      var pix = 0;
      for (var p = 0; p < 4; p++) {
        var i = wup*(dy*4 + p) + dx;
        if (b((i>>>3)+4) & (1<<(7-(i&0x7))))
          pix |= (1<<p);
      }
      if (meth === 1) {
        pix ^= this.point(x+dx, y+dy);
      }
      var col = this.palette[pix];
      var off = (y+dy-1)*wdata+x+dx-1;
      data[4*off+0] = col>>>16;
      data[4*off+1] = (col>>>8)&0xff;
      data[4*off+2] = col&0xff;
    }
  }
};
ScreenMode.prototype.get = function (x1, y1, x2, y2, out) {
  function b(i) {
    var idx = i&0x3;
    return (out[i>>>2]>>>(idx<<3))&0xff;
  }
  function setb(i, v) {
    var idx = i&0x3;
    out[i>>>2] |= ((v&0xff) << (idx<<3));
  }

  var width = x2-x1+1;
  var height = x2-x1+1;
  setb(0, (width-1)&0xff);
  setb(1, (width-1)>>>8);
  setb(2, (height-1)&0xff);
  setb(3, (height-1)>>>8);
  var wup = (width+7)&~0x7;

  var data = this.imgdata.data;
  var wdata = this.bcanvas.width;
  for (var dy = 0; dy < height; dy++) {
    for (var dx = 0; dx < width; dx++) {
      var off = (y1+dy-1)*wdata+x1+dx-1;
      var col = (data[4*off+0]<<16)|(data[4*off+1]<<8)|(data[4*off+2]);
      for (var pix = 0; pix < 16; pix++) {
        if (this.palette[pix] === col)
          break;
      }
      for (var p = 0; p < 4; p++) {
        var i = wup*(dy*4+p) + dx;
        var by = b((i>>>3)+4);
        if ((1<<p)&pix) {
          by |= (1<<(7-(i&0x7)));
        } else {
          by &= ~(1<<(7-(i&0x7)));
        }
        setb((i>>>3)+4, by);
      }
    }
  }
};
ScreenMode.prototype.color = function (fg, bg) {
  if (fg !== void 0) {
    this.fg = fg;
  }
  if (bg !== void 0) {
    this.bg = bg;
  }
};
ScreenMode.prototype.locate = function (i, j) {
  this.i = i-1;
  this.j = j-1;
  while (this.j >= 80) {
    this.j -= 80;
    this.i++;
  }
  while (this.j < 0) {
    this.j += 80;
    this.i--;
  }

  if (this.lasti !== void 0) {
    this.char(this.lasti, this.lastj, this.charAt(this.lasti, this.lastj));
    this.char(this.i, this.j, -1);
    this.lasti = this.i;
    this.lastj = this.j;
  }
};
ScreenMode.prototype.pos = function () {
  return {row: this.i+1,
          col: this.j+1};
};
ScreenMode.prototype.print = function (text) {
  for (var k = 0; k < text.length; k++) {
    var c = text.charCodeAt(k);
    this.char(this.i, this.j, c);
    this.j++;
    if (this.j >= 80) {
      this.j = 0;
      this.i++;
    }
  }
};
ScreenMode.prototype.charAt = function (i, j) {
  return this.text[i*80+j];
};
ScreenMode.prototype.char = function (i, j, c) {
  if (0 <= c && c <= 255) {
    this.text[i*80+j] = c;
  }
  var data = this.imgdata.data;
  var char = c === -1 ? this.cursorChar : ega8x14[c];
  var w = this.bcanvas.width;
  var dy = i*14, dx = j*8;
  var fg = this.palette[this.fg],
      bg = this.palette[this.bg];
  for (var a = 0; a < 14; a++) {
    var row = char[a];
    if (row === -1) continue;
    for (var b = 0; b < 8; b++) {
      var off = w*(dy+a)+dx+b;
      if (row & 128) {
        data[4*off+0] = fg>>>16;
        data[4*off+1] = (fg>>>8)&0xff;
        data[4*off+2] = fg&0xff;
      } else {
        data[4*off+0] = bg>>>16;
        data[4*off+1] = (bg>>>8)&0xff;
        data[4*off+2] = bg&0xff;
      }
      row = row << 1;
    }
  }
};
ScreenMode.prototype.pset = function (x, y, col) {
  var c = this.palette[col];
  var off = this.bcanvas.width*(y-1)+x-1;
  var data = this.imgdata.data;
  data[4*off+0] = c>>>16;
  data[4*off+1] = (c>>>8)&0xff;
  data[4*off+2] = c&0xff;
};
ScreenMode.prototype.point = function (x, y) {
  var off = this.bcanvas.width*(y-1)+x-1;
  var data = this.imgdata.data;
  if (off < 0 || 4*off >= data.length) {
    return 0;
  }
  var col = (data[4*off+0]<<16)|(data[4*off+1]<<8)|(data[4*off+2]);
  for (var pix = 0; pix < 16; pix++) {
    if (this.palette[pix] === col)
      break;
  }
  return pix;
};
ScreenMode.prototype.box = function (x1, y1, x2, y2, col) {
  var temp;
  if (x1 > x2) {
    temp = x1; x1 = x2; x2 = temp;
  }
  if (y1 > y2) {
    temp = y1; y1 = y2; y2 = temp;
  }
  var data = this.imgdata.data;
  var w = this.bcanvas.width;
  var c = this.palette[col];
  for (var y = y1; y <= y2; y++) {
    for (var x = x1; x <= x2; x++) {
      var off = w*(y-1)+x-1;
      data[4*off+0] = c>>>16;
      data[4*off+1] = (c>>>8)&0xff;
      data[4*off+2] = c&0xff;
    }
  }
};
ScreenMode.prototype.line = function (x1, y1, x2, y2, col) {
  var dx = Math.abs(x2-x1);
  var sx = x1 < x2 ? 1 : -1;
  var dy = -Math.abs(y2-y1);
  var sy = y1 < y2 ? 1 : -1;
  var err = dx+dy;

  var data = this.imgdata.data;
  var w = this.bcanvas.width;
  var c = this.palette[col];

  for (;;) {
    var off = w*(y1-1)+x1-1;
    data[4*off+0] = c>>>16;
    data[4*off+1] = (c>>>8)&0xff;
    data[4*off+2] = c&0xff;

    if (x1 === x2 && y1 === y2) break;
    var e2 = 2*err;
    if (e2 >= dy) { err += dy; x1 += sx; }
    if (e2 <= dx) { err += dx; y1 += sy; }
  }
};
ScreenMode.prototype.circle = function (xm, ym, rad, col, sang, enang) {
  var data = this.imgdata.data;
  var w = this.bcanvas.width;
  var c = this.palette[col];

  var mpset = (x, y) => {
    var f = 0.05;
    var ang = (Math.atan2(ym-y, x-xm)+2*Math.PI)%(2*Math.PI);
    if (sang < enang) {
      if (sang <= ang+f && ang -f<= enang) {
        this.pset(x|0, y|0, col);
      }
    } else {
      if (ang-f <= enang || ang+f >= sang) {
        this.pset(x|0, y|0, col);
      }
    }
  };

  var x = -rad, y = 0, err = 2-2*rad;
  do {
    mpset(xm-x, ym+y);
    mpset(xm-y, ym-x);
    mpset(xm+x, ym-y);
    mpset(xm+y, ym+x);
    rad = err;
    if (rad <= y) {
      y++;
      err += y*2+1;
    }
    if (rad > x || err > y) {
      x++;
      err += x*2+1;
    }
  } while (x < 0);
};
ScreenMode.prototype.ellipse = function (xm, ym, rad, col, ecc) {
  var data = this.imgdata.data;
  var w = this.bcanvas.width;
  var c = this.palette[col];

  var x0, x1, y0, y1;
  if (ecc > 0) {
    x0 = (xm-rad*ecc)|0;
    x1 = (xm+rad*ecc)|0;
    y0 = (ym-rad)|0;
    y1 = (ym+rad)|0;
  } else {
    x0 = (xm-rad)|0;
    x1 = (xm+rad)|0;
    y0 = (ym+rad/ecc)|0;
    y1 = (ym-rad/ecc)|0;
  }

  var a = Math.abs(x1-x0);
  var b = Math.abs(y1-y0);
  var b1 = b&1;

  var dx = 4*(1-a)*b*b,
      dy = 4*(b1+1)*a*a;
  var err = dx+dy+b1*a*a;
  var e2;

  y0 += (b+1)/2; y1 = y0-b1;
  a *= 8*a;
  b1 = 8*b*b;

  do {
    this.pset(x1|0, y0|0, col);
    this.pset(x0|0, y0|0, col);
    this.pset(x0|0, y1|0, col);
    this.pset(x1|0, y1|0, col);
    e2 = 2*err;
    if (e2 <= dy) { y0++; y1--; err += dy += a; }
    if (e2 >= dx || 2*err > dy) {
      x0++; x1--; err += dx += b1;
    }
  } while (x0 <= x1);

  while (y0-y1 < b) {
    this.pset(x0-1, y0);
    this.pset(x1+1, y0++);
    this.pset(x0-1, y1);
    this.pset(x1+1, y1--);
  }
};
ScreenMode.prototype.paint = function (x, y, col) {
  var c = this.palette[col];
  var tosetx = [x-1];
  var tosety = [y-1];
  var data = this.imgdata.data;
  var wdata = this.bcanvas.width;
  var hdata = this.bcanvas.height;
  while (tosetx.length > 0) {
    x = tosetx.pop();
    y = tosety.pop();
    if (x < 0 || x >= wdata || y < 0 || y >= hdata) continue;
    var off = y*wdata+x;
    var curcol = (data[4*off+0]<<16)|(data[4*off+1]<<8)|(data[4*off+2]);
    if (curcol !== c) {
      data[4*off+0] = c>>>16;
      data[4*off+1] = (c>>>8)&0xff;
      data[4*off+2] = c&0xff;
      tosetx.push(x, x+1, x, x-1);
      tosety.push(y-1, y, y+1, y);
    }
  }
};
ScreenMode.prototype.toggleCursor = function (b) {
  function blinker() {
    if (this.lasti !== void 0) {
      this.char(this.lasti, this.lastj, this.charAt(this.lasti, this.lastj));
      this.lasti = void 0;
    } else {
      this.char(this.i, this.j, -1);
      this.lasti = this.i;
      this.lastj = this.j;
    }
    this.flip();
  }
  if (b) {
    if (this.blinkTimeout === void 0) {
      this.blinkTimeout = window.setInterval(blinker.bind(this), 1000/4);
    }
  } else {
    if (this.blinkTimeout !== void 0) {
      window.clearInterval(this.blinkTimeout);
      this.blinkTimeout = void 0;
    }
    if (this.lasti !== void 0) {
      this.char(this.lasti, this.lastj, this.charAt(this.lasti, this.lastj));
      this.flip();
    }
    this.lasti = void 0;
  }
};
ScreenMode.prototype.cursor = function (row, col) {
  this.cursor
  this.char(row-1, col-1, -1);
};

function Play() {
  this.buffer = [];
  this.context = new AudioContext();
  this.node = this.context.createScriptProcessor(2048, 0, 1);
  this.node.onaudioprocess = this._process.bind(this);
  this.node.connect(this.context.destination);
  this.j = 0;

  this.vol = 0.5;
  this.pitch = -1;
  this.end = -1;
  this.next = -1;

  this.filter = diffeq(10e-3, 50, 1/1e-6, 1.0/this.context.sampleRate, 0.1, 3000000);
}
Play.prototype._process = function (e) {
  var output = e.outputBuffer.getChannelData(0);
  var rate = this.context.sampleRate;
  var j = this.j;
  for (var i = 0; i < output.length; i++, j++) {
    var t = j/rate;
    if (this.pitch !== -1 && t >= this.next) {
      this.pitch = -1;
    }
    if (this.pitch === -1 && this.buffer.length > 0) {
      do {
        var b = this.buffer.shift();
        if (b.pitch >= 0) {
          this.pitch = Math.pow(2, (b.pitch+3)/12)*55;
        } else if (b.pitch === -3) {
          window.setTimeout(b.callback, 0);
          continue;
        } else {
          this.pitch = -2;
        }
        this.next = t+b.len;
        this.end = t+b.art*b.len;
        //console.log(this.pitch, this.next, this.end);
      } while (0);
    }
    var sample = 0;
    if (this.pitch >= 0 && t < this.end) {
      sample = ((this.pitch*t % 1) < 0.5 ? -1 : 1);
    } else {
      sample = 0;
    }
    output[i] = 1?this.vol*this.filter(sample):this.vol*sample;
    //output[i] = this.vol*sample;
  }
//  console.log(output[0]);
  this.j = j;
};
function diffeq(a, b, c, dt, k, s) {
  // ay''+by'+cy=f

  var y1 = 0.0, y2 = 0.0; // y_{n-1}, y_{n-2}
  var f1 = 0.0;

  return function (f) {
    f = k*f+(1-k)*f1;
    var df = f - f1;
    f1 = f;
    var y0 = (2*dt*dt*df + 2*(2*a-c*dt*dt)*y1 + (b*dt-2*a)*y2)/(2*a+b*dt);
    y2 = y1;
    y1 = y0;
    return s*y0;
  };
}
Play.prototype.play = function (s) {
  s = s.toUpperCase();
  var i = 0;
  var buffer = this.buffer;
  var arts = [0.5, 0.9, 1.0];
  var oct = 3;
  var len = 4;
  var art = 1;
  var tempo = 120;
  var mode = "fg";
  function num() {
    var d = false;
    var n = 0;
    while ('0' <= s[i] && s[i] <= '9') {
      d = true;
      n *= 10;
      n += s.charCodeAt(i) - '0'.charCodeAt(0);
      i++;
    }
    return d ? n : -1;
  }
  function note(i, len) {
    buffer.push({
      pitch: i,
      len: len * 60 / tempo,
      art: arts[art]
    });
  }
  function pause(len) {
    buffer.push({
      pitch: -2,
      len: len * 60 / tempo,
      art: arts[art]
    });
  }
  function sharpen() { buffer[buffer.length-1].pitch++; }
  function flatten() { buffer[buffer.length-1].pitch--; }
  function lengthen() { buffer[buffer.length-1].len *= 1.5; }
  while (i < s.length) {
    var c = s[i++];
    if (c === 'O') oct = +s[i++];
    else if (c === '<') oct--;
    else if (c === '>') oct++;
    else if ('A' <= c && c <= 'G') {
      var ltemp = num();
      note(oct*12 + [9, 11, 0, 2, 4, 5, 7][c.charCodeAt(0)-'A'.charCodeAt(0)],
           ltemp !== -1 ? 4/ltemp : len);
    } else if (c === 'N') {
      var n = num();
      if (n === 0) {
        pause(len);
      } else {
        note(n);
      }
    } else if (c === 'L') len = 4/num();
    else if (c === 'M') {
      c = s[i++];
      if (c === 'L') art = 2;
      else if (c === 'N') art = 1;
      else if (c === 'S') art = 0;
      else if (c === 'F') mode = "fg";
      else if (c === 'B') mode = "bg";
    } else if (c === 'P') pause(4/num());
    else if (c === 'T') tempo = num();
    else if (c === '#' || c === '+') sharpen();
    else if (c === '-') flatten();
    else if (c === '.') lengthen();
  }
};
Play.prototype.wake = function (callback) {
  this.buffer.push({
    pitch: -3,
    callback: callback
  });
};

function Keys(elt) {
  this.buffer = [];

  elt.addEventListener("keydown", e => {
    e.preventDefault();
    e.stopPropagation();
    console.log(e);
    if (this.listener) {
      var l = this.listener;
      this.listener = null;
      l(e.key);
    } else {
      this.buffer.push(e.key);
    }
  });

  this.listener = null;
}
Keys.prototype.inkey = function () {
  if (this.buffer.length > 0) {
    return this.buffer.shift();
  } else {
    return "";
  }
};
Keys.prototype.nextKey = function (callback) {
  this.listener = callback;
};

//   var imgdata = ctxt.getImageData(0, 0, this.canvas.width, this.canvas.height);
//   this.imgdata = imgdata;

//   var data = this.imgdata.data;
//   for (var i = 0; i < this.canvas.height; i++) {
//     for (var j = 0; j < this.canvas.width; j++) {
//       data[(this.canvas.width*i+j)*4 +3] = 255;
//     }
//   }
// //  this.ctxt.putImageData(this.imgdata, 0, 0);
// }

function getPixelRatio(context) {
    var backingStore = context.backingStorePixelRatio ||
          context.webkitBackingStorePixelRatio ||
          context.mozBackingStorePixelRatio ||
          context.msBackingStorePixelRatio ||
          context.oBackingStorePixelRatio ||
          context.backingStorePixelRatio || 1;

    return (window.devicePixelRatio || 1) / backingStore;
};

window.addEventListener("load", function () {
  var canvas = document.getElementById("canvas");

  canvas.tabIndex = 1;
  canvas.focus();
  scr = new ScreenMode(canvas);
  play = new Play();
  keys = new Keys(canvas);

  runPauseable(start());
}, false);

// screen mode 9 = 640x350


import utils from './utils';
import ajax from './ajax';
import input from './input';
import Sprite from './sprite';
import Map from './map';

log.trace('scene module load');

var scene = {
  playerSpriteCache: {},
  playerSprites: [],
  mapCache: {},
  thisStepFrame: 0,
  applyWaveIndex: 0
};

var abs = Math.abs;
var floor = Math.floor;
var round = Math.round;

// for hidden class
function SpriteToDraw(frame, x, y, layer) {
  this.frame = frame;
  this.pos = PAL_XY(x, y);
  this.layer = layer;
}

function compareByYASC(a, b) {
  return PAL_Y(a.pos) - PAL_Y(b.pos);
}

function compareByYDESC(a, b) {
  return PAL_Y(b.pos) - PAL_Y(a.pos);
}

function compareByLayerASC(a, b) {
  return a.layer - b.layer;
}

function compareByLayerDESC(a, b) {
  return b.layer - a.layer;
}

function compareSprite(a, b) {
  //var layer = -(a.layer - b.layer);
  //if (layer !== 0) return layer;
  return (PAL_Y(a.pos) - PAL_Y(b.pos));
}

var surface = null;

scene.init = function*(surf) {
  log.debug('[SCENE] init');
  surface = surf;
  global.scene = scene;
  var list = ['MAP', 'GOP', 'MGO'];
  yield ajax.loadMKF(list);
  list.forEach(function(name, i) {
    Files[name] = ajax.MKF[name];
  })
};

scene.makeScene = function*() {
  var scene = GameData.scene[Global.numScene - 1];
  if (!scene) return;
  yield scene.render();
};

scene.getPlayerSprite = function(i) {
  var player = Global.party[i];
  var playerID = player.playerRole;
  var spriteNum;
  if (i > Global.maxPartyMemberIndex && Global.numFollower > 0) {
    // 如果是跟随者，那么spriteNum就是它的ID
    spriteNum = playerID;
  } else {
    // 否则从GameData.playerRoles里获取spriteNum（我也不知道为虾米要这么搞……）
    spriteNum = GameData.playerRoles.spriteNum[playerID];
  }
  if (typeof spriteNum === 'undefined') {
    return null;
  }
  var cache = scene.playerSpriteCache;
  var sprite = cache[spriteNum];
  if (!sprite) {
    var chunk = Files.MGO.decompressChunk(spriteNum);
    sprite = cache[spriteNum] = new Sprite(chunk);
  }
  return sprite;
};

/**
 * Update the location and walking gesture of all the party members.
 */
scene.updateParty = function() {
  //log.trace('[Scene] updateParty');
  var trail = Global.trail;
  var viewport = Global.viewport;
  var partyOffset = Global.partyOffset;
  // Has user pressed one of the arrow keys?
  if (input.dir !== Direction.Unknown) {
    var xOffset = ((input.dir === Direction.West || input.dir === Direction.South) ? -16 : 16);
    var yOffset = ((input.dir === Direction.West || input.dir === Direction.North) ? -8 : 8);

    var xSource = PAL_X(viewport) + PAL_X(partyOffset);
    var ySource = PAL_Y(viewport) + PAL_Y(partyOffset);

    var xTarget = xSource + xOffset;
    var yTarget = ySource + yOffset;

    Global.partyDirection = input.dir;

    // Check for obstacles on the destination location
    if (!scene.checkObstacle(PAL_XY(xTarget, yTarget), true, 0)) {
      // Player will actually be moved. Store trail.
      for (var i = 3; i >= 0; i--) {
         trail[i + 1] = trail[i];
      }

      trail[0].direction = input.dir;
      trail[0].x = xSource;
      trail[0].y = ySource;

      // Move the viewport
      Global.viewport = PAL_XY(PAL_X(viewport) + xOffset, PAL_Y(viewport) + yOffset);

      // Update gestures
      scene.updatePartyGestures(true);

      return; // don't go further
    }
  }

  scene.updatePartyGestures(false);
};

/**
 * Update the gestures of all the party members.
 *
 * @param  {Boolean} walking  whether the party is walking or not.
 */
scene.updatePartyGestures = function(walking) {
  //log.trace('[Scene] updatePartyGestures ' + walking);
  var stepFrameFollower = 0;
  var stepFrameLeader = 0;
  var party = Global.party;
  var trail = Global.trail;
  var playerRoles = GameData.playerRoles;
  var maxPartyMemberIndex = Global.maxPartyMemberIndex;
  var viewport = Global.viewport;
  var partyOffset = Global.partyOffset;
  var partyDirection = Global.partyDirection;

  if (walking) {
    // Update the gesture for party leader
    scene.thisStepFrame = (scene.thisStepFrame + 1) % 4;
    if (scene.thisStepFrame & 1) {
       stepFrameLeader = ~~((scene.thisStepFrame + 1) / 2);
       stepFrameFollower = 3 - stepFrameLeader;
    } else {
       stepFrameLeader = 0;
       stepFrameFollower = 0;
    }

    party[0].x = PAL_X(partyOffset);
    party[0].y = PAL_Y(partyOffset);

    if (playerRoles.walkFrames[party[0].playerRole] === 4) {
       party[0].frame = partyDirection * 4 + scene.thisStepFrame;
    } else {
       party[0].frame = partyDirection * 3 + stepFrameLeader;
    }

    // Update the gestures and positions for other party members
    for (var i = 1; i <= maxPartyMemberIndex; i++) {
      party[i].x = trail[1].x - PAL_X(viewport);
      party[i].y = trail[1].y - PAL_Y(viewport);

      if (i === 2) {
        party[i].x += (trail[1].direction === Direction.East || trail[1].direction === Direction.West) ? -16 : 16;
        party[i].y += 8;
      } else {
        party[i].x += ((trail[1].direction === Direction.West || trail[1].direction === Direction.South) ? 16 : -16);
        party[i].y += ((trail[1].direction === Direction.West || trail[1].direction === Direction.North) ? 8 : -8);
      }

      // Adjust the position if there is obstacle
      var pos = PAL_XY(
        party[i].x + PAL_X(viewport),
        party[i].y + PAL_Y(viewport)
      );
      if (scene.checkObstacle(pos, true, 0)){
        party[i].x = trail[1].x - PAL_X(viewport);
        party[i].y = trail[1].y - PAL_Y(viewport);
      }

      // Update gesture for this party member
      if (playerRoles.walkFrames[party[i].playerRole] === 4) {
        party[i].frame = trail[2].direction * 4 + scene.thisStepFrame;
      } else {
        party[i].frame = trail[2].direction * 3 + stepFrameLeader;
      }
    }

    if (Global.numFollower > 0){
      party[maxPartyMemberIndex + 1].x = trail[3].x - PAL_X(viewport);
      party[maxPartyMemberIndex + 1].y = trail[3].y - PAL_Y(viewport);
      party[maxPartyMemberIndex + 1].frame = trail[3].direction * 3 + stepFrameFollower;
    }
  } else {
    // Player is not moved. Use the "standing" gesture instead of "walking" one.
    var i = playerRoles.walkFrames[party[0].playerRole];
    if (i === 0) {
       i = 3;
    }
    party[0].frame = partyDirection * i;

    for (i = 1; i <= maxPartyMemberIndex; i++) {
      var f = playerRoles.walkFrames[party[i].playerRole];
      if (f === 0) {
        f = 3;
      }
      party[i].frame = trail[2].direction * f;
    }

    if (Global.numFollower > 0) {
       party[maxPartyMemberIndex + 1].frame = trail[3].direction * 3;
    }

    scene.thisStepFrame &= 2;
    scene.thisStepFrame ^= 2;
  }
};

/**
 * Check if the specified location has obstacle or not.
 *
 * @param  {POS} pos                   the position to check.
 * @param  {Boolean} checkEventObjects fCheckEventObjects - TRUE if check for event objects, FALSE if only check for the map.
 * @param  {EventObject} selfObject    the event object which will be skipped.
 * @return {Boolean}                   TRUE if the location is obstacle, FALSE if not.
 */
scene.checkObstacle = function(pos, checkEventObjects, selfObject) {
  //log.trace('[Scene] checkObstacle(' + [pos, checkEventObjects, selfObject].join(',') + ')');
  if (PAL_X(pos) < 0 || PAL_X(pos) >= 2048 || PAL_Y(pos) < 0 || PAL_Y(pos) >= 2048) {
    return true;
  }
  // Check if the map tile at the specified position is blocking
  var x = ~~(PAL_X(pos) / 32);
  var y = ~~(PAL_Y(pos) / 16);
  var h = 0;
  var xr = PAL_X(pos) % 32;
  var yr = PAL_Y(pos) % 16;

  if ((xr + (yr * 2)) >= 16) {
    if ((xr + (yr * 2)) >= 48) {
      x++;
      y++;
    } else if ((32 - (xr + (yr * 2))) > 16) {
      x++;
    } else if ((32 - (xr + (yr * 2))) < 48) {
      h = 1;
    } else {
      y++;
    }
  }
  //if (xr + yr * 2 >= 16) {
  //  if (xr + yr * 2 >= 48) {
  //    x++;
  //    y++;
  //  } else if (32 - xr + yr * 2 > 16) {
  //    x++;
  //  } else if (32 - xr + yr * 2 < 48) {
  //    h = 1;
  //  } else {
  //    y++;
  //  }
  //}

  var scenes = GameData.scene;
  var numScene = Global.numScene;
  var sc = scenes[numScene - 1];

  var map = sc.getMap();
  if (map.isTileBlocked(x, y, h)) {
    return true;
  }

  var eventObjects = GameData.eventObject;
  if (checkEventObjects) {
    // Loop through all event objects in the current scene
    for (var i = scenes[numScene - 1].eventObjectIndex; i < scenes[numScene].eventObjectIndex; i++) {
      if (i == selfObject - 1) {
        // Skip myself
        continue;
      }
      var p = eventObjects[i];
      // Is this object a blocking one?
      if (p.state >= ObjectState.Blocker) {
        // Check for collision
        if (abs(p.x - PAL_X(pos)) + abs(p.y - PAL_Y(pos)) * 2 < 16) {
          return true;
        }
      }
    }
  }
  return false;
};

scene.applyWave = function(buffer) {
  var wave = new Array(32);
  Global.screenWave += Global.waveProgression;
  var buf = new Uint8Array(320);
  if (Global.screenWave === 0 || Global.screenWave >= 256) {
    // No need to wave the screen
    Global.screenWave = 0;
    Global.waveProgression = 0;
    return;
  }

  // Calculate the waving offsets.
  var a = 0;
  var b = 60 + 8;

  for (var i = 0; i < 16; i++) {
    b -= 8;
    a += b;

    // WARNING: assuming the screen width is 320
    wave[i] = ~~(a * Global.screenWave / 256);
    wave[i + 16] = 320 - wave[i];
  }

  // Apply the effect.
  // WARNING: only works with 320x200 8-bit surface.
  a = scene.applyWaveIndex;

  // Loop through all lines in the screen buffer.
  for (var i = 0; i < 200; i++) {
    b = wave[a];

    if (b > 0 && b < 320) {
       // Do a shift on the current line with the calculated offset.
       memcpy(buf, buffer, b);
       memmove(buffer, buffer.subarray(b), 320 - b);
       memcpy(buffer.subarray(320 - b), buf, b);
    }

    a = (a + 1) % 32;
    buffer = buffer.subarray(surface.pitch);
  }

  scene.applyWaveIndex = (scene.applyWaveIndex + 1) % 32;
};

utils.extend(Scene.prototype, {
  loadEventObjectSpites: function() {
    var scenes = GameData.scene;
    var numScene = Global.numScene;
    var eventObjects = GameData.eventObject;
    var index = scenes[numScene - 1].eventObjectIndex;
    var num = scenes[numScene].eventObjectIndex - index;
    var MGO = Files.MGO;
    var array = this.eventObjectSprite = new Array(num);

    for (var i=0; i<num; ++i,++index) {
      var n = eventObjects[index].spriteNum;
      if (n == 0){
        array[i] = null;
        continue;
      }

      var sprite = array[i] = new Sprite(MGO.decompressChunk(n));
      eventObjects[index].spriteFramesAuto = sprite.frameCount;
    }
    Global.partyOffset = PAL_XY(160, 112);
  },
  getEventObjectSprite: function(eventObjectID) {
    if (!this.eventObjectSprite) this.loadEventObjectSpites();

    var scenes = GameData.scene;
    var numScene = Global.numScene;
    var eventObjects = GameData.eventObject;
    eventObjectID -= scenes[numScene - 1].eventObjectIndex;
    eventObjectID--;

    if (eventObjectID >= eventObjects.length) {
      return null;
    }

    return this.eventObjectSprite[eventObjectID];
    //return gpResources->lppEventObjectSprites[wEventObjectID];
  },
  addToDrawList: function(frame, x, y, layer) {
    var obj = new SpriteToDraw(frame, x, y, layer);
    var drawList = this.drawList || (this.drawList = []);
    this.drawList.push(obj);
    //surface.__debugStr([y].join(','),
    //  x, y - frame.height - layer, '#f00', 'middle', 'center', 12)
    return obj;
  },
  calcCoverTiles: function(spriteToDraw){
    var sx = PAL_X(Global.viewport) + PAL_X(spriteToDraw.pos),
        sy = PAL_Y(Global.viewport) + PAL_Y(spriteToDraw.pos),
        sh = ((sx % 32) ? 1 : 0);

    var width = spriteToDraw.frame.width,
        height = spriteToDraw.frame.height;

    var dx = 0, dy = 0, dh = 0;
    var x, y, i;
    // Loop through all the tiles in the area of the sprite.
    for (y = ~~((sy - height - 15) / 16); y <= ~~(sy / 16); y++) {
      for (x = ~~((sx - ~~(width / 2)) / 32); x <= ~~((sx + ~~(width / 2)) / 32); x++) {
        for (i = (x == ~~((sx - ~~(width / 2)) / 32) ? 0 : 3); i < 5; i++) {
          // Scan tiles in the following form (* = to scan):
          // . . . * * * . . .
          //  . . . * * . . . .
          switch (i) {
            case 0:
              dx = x;
              dy = y;
              dh = sh;
              break;
            case 1:
              dx = x - 1;
              break;
            case 2:
              dx = (sh ? x : (x - 1));
              dy = (sh ? (y + 1) : y);
              dh = 1 - sh;
              break;
            case 3:
              dx = x + 1;
              dy = y;
              dh = sh;
              break;
            case 4:
              dx = (sh ? (x + 1) : x);
              dy = (sh ? (y + 1) : y);
              dh = 1 - sh;
              break;
          }

          for (var l = 0; l < 2; l++) {
            var map = this.getMap();
            var tile = map.getTileBitmap(dx, dy, dh, l);
            var tileHeight = map.getTileHeight(dx, dy, dh, l);

            // Check if this tile may cover the sprites
            if (tile && tileHeight > 0 && (dy + tileHeight) * 16 + dh * 8 >= sy) {
              // This tile may cover the sprite
              this.addToDrawList(
                tile,
                dx * 32 + dh * 16 - 16 - PAL_X(Global.viewport),
                dy * 16 + dh * 8 + 7 + l + tileHeight * 8 - PAL_Y(Global.viewport),
                tileHeight * 8 + l
              );
            }
          }
        }
      }
    }
  },
  getMap: function() {
    var mapNum = this.mapNum,
        mapCache = scene.mapCache;
    if (mapNum in mapCache) {
      return mapCache[mapNum];
    }
    //var mapBuf = Files.MAP.decompressChunk(mapNum);
    //var tileSprite = Files.GOP.readChunk(mapNum);

    //var map = new Map(mapBuf, tileSprite, mapNum);
    var map = Map.fromFile(mapNum, Files.MAP, Files.GOP);

    return (mapCache[mapNum] = map);
  },
  renderMap: function() {
    var rect = new RECT(
      PAL_X(Global.viewport), PAL_Y(Global.viewport),
      320, 200
    );
    var map = this.getMap();
    surface.blitMap(map, rect, 0);
    surface.blitMap(map, rect, 1);
  },
  renderSprites: function() {
    var party = Global.party;
    var playerRoles = GameData.playerRoles;
    var numScene = Global.numScene;
    var scenes = GameData.scene;
    var eventObjects = GameData.eventObject;
    var drawList = this.drawList || (this.drawList = []);
    var maxPartyMemberIndex = Global.maxPartyMemberIndex;

    // Players
    for (var i = 0; i <= Global.maxPartyMemberIndex + Global.numFollower; ++i) {
      var player = party[i];
      var sprite = scene.getPlayerSprite(i);
      var bitmap = sprite.getFrame(player.frame);

      if (!bitmap) continue;

      // Add it to our array
      var obj = this.addToDrawList(
        bitmap,
        player.x - ~~(bitmap.width / 2),
        player.y + Global.layer + 10,
        Global.layer + 6
      );
      // Calculate covering tiles on the map
      this.calcCoverTiles(obj);
    }
    // Event Objects (Monsters/NPCs/others)
    for (var i = scenes[numScene - 1].eventObjectIndex; i < scenes[numScene].eventObjectIndex; ++i) {
      var eventObj = eventObjects[i];

      surface.__debugStr('['+i+']', eventObj.x - PAL_X(Global.viewport), eventObj.y - PAL_Y(Global.viewport), '#f00', 'middle', 'center', 24);

      if (eventObj.state == ObjectState.Hidden || eventObj.vanishTime > 0 || eventObj.state < 0) {
        continue;
      }

      // Get the sprite
      var sprite = this.getEventObjectSprite(i + 1);
      if (!sprite) {
        continue;
      }

      var frameNum = eventObj.currentFrameNum;
      if (eventObj.spriteFrames == 3) {
        // walking character
        if (frameNum == 2) {
          frameNum = 0;
        }
        if (frameNum == 3) {
          frameNum = 2;
        }
      }

      var frame = sprite.getFrame(eventObj.direction * eventObj.spriteFrames + frameNum)
      if (!frame) {
        continue;
      }

      // Calculate the coordinate and check if outside the screen
      var x = SHORT(eventObj.x) - PAL_X(Global.viewport);
      x -= ~~(frame.width / 2);
      if (x >= 320 || x < -frame.width) {
        // outside the screen; skip it
        continue;
      }
      var y = SHORT(eventObj.y) - PAL_Y(Global.viewport);
      y += eventObj.layer * 8 + 9;
      var vy = y - frame.height - eventObj.layer * 8 + 2;
      if (vy >= 200 || vy < -frame.height) {
        // outside the screen; skip it
        continue;
      }

      // Add it into the array
      var obj = this.addToDrawList(frame, x, y, eventObj.layer * 8 + 2);
      // Calculate covering map tiles
      this.calcCoverTiles(obj);
    }

    // All sprites are now in our array; sort them by their vertical positions.
    drawList.sort(compareSprite); // 按Y升序
    // Draw all the sprites to the screen.
    for (var i = 0; i < drawList.length; ++i) {
      var obj = drawList[i];
      var frame = obj.frame,
          layer = obj.layer,
          x = PAL_X(obj.pos),
          y = PAL_Y(obj.pos) - frame.height - layer;
      surface.blitRLE(frame, PAL_XY(x, y));
    }
  },
  render: function*() {
    surface.clear(); // 因为后面会renderMap所以似乎不需要clear了
    // Step 1: Draw the complete map, for both of the layers.
    this.renderMap();
    // Step 2: Apply screen waving effects.
    scene.applyWave(surface.byteBuffer);
    // Step 3: Draw all the sprites.
    if (!this.drawList) this.drawList = [];
    this.drawList.length = 0;
    //surface.__debugClear(0, 0, 320, 200);
    this.renderSprites();
    // Check if we need to fade in.
    if (Global.needToFadeIn) {
      //surface.refresh();
      yield surface.fadeIn(Global.numPalette, Global.nightPalette, 1);
      Global.needToFadeIn = false;
    }
  }
});

export default scene;

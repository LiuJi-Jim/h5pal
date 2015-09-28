import scene from './scene';
import Palette from './palette';
import script_extras from './script-extras';
import res from './res';
import rng from './rng';
import music from './music';
import sound from './sound';

log.trace('script module load');

var script = {
  curEquipPart: -1,
  scriptSuccess: true
};

var surface = null
var abs = Math.abs;
var floor = Math.floor;

script.debug = function() {
  return;
  var args = toArray(arguments);
  if (log.level >= LogLevel.Debug) {
    log.debug.apply(log, args);
  }
}

// import script_helper from './script-helper';
var traceScript = function(){}; // script_helper.debug;

script.init = function*(surf) {
  log.debug('[SCRIPT] init');
  global.script = script;
  surface = surf;
  yield script_extras.init(surf, script);
};

/**
 * Move and animate the specified event object (NPC).
 * @param {Number} eventObjectID the event object to move.
 * @param {Number} speed         speed of the movement.
 */
script.NPCWalkOneStep = function(eventObjectID, speed) {
  var eventObjects = GameData.eventObject;
  // Check for invalid parameters
  if (eventObjectID == 0 || eventObjectID > eventObjects.length) {
    return;
  }

  var p = eventObjects[eventObjectID - 1];

  // Move the event object by the specified direction
  p.x += ((p.direction == Direction.West || p.direction == Direction.South) ? -2 : 2) * speed;
  p.y += ((p.direction == Direction.West || p.direction == Direction.North) ? -1 : 1) * speed;

  // Update the gesture
  if (p.spriteFrames > 0) {
    p.currentFrameNum++;
    p.currentFrameNum %= (p.spriteFrames == 3 ? 4 : p.spriteFrames);
  } else if (p.spriteFramesAuto > 0) {
    p.currentFrameNum++;
    p.currentFrameNum %= p.spriteFramesAuto;
  }
};

/**
 * Make the specified event object walk to the map position specified by (x, y, h)
   at the speed of iSpeed.
 *
 * @param {Number} eventObjectID the event object to move.
 * @param {Number} x             Column number of the tile.
 * @param {Number} y             Line number in the map.
 * @param {Number} h             Each line in the map has two lines of tiles, 0 and 1.
 * @param {Number} speed         the speed to move.
 * @return {Boolean} TRUE if the event object has successfully moved to the specified position,
                     FALSE if still need more moving.
 */
script.NPCWalkTo = function(eventObjectID, x, y, h, speed) {
  log.trace('[SCRIPT] NPCWalkTo(%d, %d, %d, %d)', eventObjectID, x, y, speed);
  var evtObj = GameData.eventObject[eventObjectID - 1],
      offsetX = (x * 32 + h * 16) - evtObj.x,
      offsetY = (y * 16 + h * 8) - evtObj.y;
  if (offsetY < 0) {
    evtObj.direction = (offsetX < 0 ? Direction.West : Direction.North);
  } else {
    evtObj.direction = (offsetX < 0 ? Direction.South : Direction.East);
  }

  if (abs(offsetX) < speed * 2 || abs(offsetY) < speed * 2) {
    evtObj.x = x * 32 + h * 16;
    evtObj.y = y * 16 + h * 8;
  } else {
    script.NPCWalkOneStep(eventObjectID, speed);
  }

  if (evtObj.x === x * 32 + h * 16 && evtObj.y === y * 16 + h * 8) {
    evtObj.currentFrameNum = 0;
    return true;
  }

  return false;
};

/**
 * Make the party walk to the map position specified by (x, y, h)
   at the speed of iSpeed.
 *
 * @param {Number} x             Column number of the tile.
 * @param {Number} y             Line number in the map.
 * @param {Number} h             Each line in the map has two lines of tiles, 0 and 1.
 * @param {Number} speed         the speed to move.
 */
script.partyWalkTo = function*(x, y, h, speed) {
  log.trace('[SCRIPT] partyWalkTo(%d, %d, %d)', x, y, speed);
  var trail = Global.trail;
  var offsetX = (x * 32 + h * 16) - PAL_X(Global.viewport) - PAL_X(Global.partyOffset),
      offsetY = (y * 16 + h * 8) - PAL_Y(Global.viewport) - PAL_Y(Global.partyOffset);
  while (offsetX !== 0 || offsetY !== 0) {
    // 走一帧
    // Store trail
    for (var i=3; i>=0; i--) {
      trail[i + 1] = trail[i];
    }
    trail[0].direction = Global.partyDirection;
    trail[0].x = PAL_X(Global.viewport) + PAL_X(Global.partyOffset);
    trail[0].y = PAL_Y(Global.viewport) + PAL_Y(Global.partyOffset);

    if (offsetY < 0) {
      Global.partyDirection = (offsetX < 0 ? Direction.West : Direction.North);
    } else {
      Global.partyDirection = (offsetX < 0 ? Direction.South : Direction.East);
    }

    var dx = PAL_X(Global.viewport),
        dy = PAL_Y(Global.viewport);
    if (abs(offsetX) <= speed * 2) {
      dx += offsetX;
    } else {
      dx += speed * (offsetX < 0 ? -2 : 2);
    }
    if (abs(offsetY) <= speed) {
      dy += offsetY;
    } else {
      dy += speed * (offsetY < 0 ? -1 : 1);
    }

    log.trace('[SCRIPT] Move the Global.viewport');
    Global.viewport = PAL_XY(dx, dy);

    scene.updatePartyGestures(true);
    yield play.update(false);
    yield scene.makeScene();
    surface.updateScreen(null);
    offsetX = x * 32 + h * 16 - PAL_X(Global.viewport) - PAL_X(Global.partyOffset);
    offsetY = y * 16 + h * 8 - PAL_Y(Global.viewport) - PAL_Y(Global.partyOffset);

    yield sleepByFrame(1);
  }

  scene.updatePartyGestures(false);
};

/**
 * Move the party to the specified position, riding the specified event object.
 *
 * @param {Number} eventObjectID the event object to be ridden.
 * @param {Number} x             Column number of the tile.
 * @param {Number} y             Line number in the map.
 * @param {Number} h             Each line in the map has two lines of tiles, 0 and 1.
 * @param {Number} speed         the speed to move.
 */
script.partyRideEventObject = function*(eventObjectID, x, y, h, speed) {
  log.trace('[SCRIPT] partyRideEventObject(%d, %d, %d, %d)', eventObjectID, x, y, speed);
  var trail = Global.trail;
  var evtObj = GameData.eventObject[eventObjectID - 1],
      offsetX = (x * 32 + h * 16) - evtObj.x,
      offsetY = (y * 16 + h * 8) - evtObj.y;
  while (offsetX !== 0 || offsetY !== 0) {
    if (offsetY < 0) {
       Global.partyDirection = (offsetX < 0 ? Direction.West : Direction.North);
    } else {
       Global.partyDirection = (offsetX < 0 ? Direction.South : Direction.East);
    }

    var dx;
    var dy;
    if (abs(offsetX) > speed * 2) {
      dx = speed * (offsetX < 0 ? -2 : 2)
    } else {
      dx = offsetX;
    }
    if (abs(offsetY) > speed){
       dy = speed * (offsetY < 0 ? -1 : 1)
    } else {
       dy = offsetY;
    }

    // Store trail
    for (var i=3; i>=0; i--) {
       trail[i + 1] = trail[i];
    }
    trail[0].direction = Global.partyDirection;
    trail[0].x = PAL_X(Global.viewport) + dx + PAL_X(Global.partyOffset);
    trail[0].y = PAL_Y(Global.viewport) + dy + PAL_Y(Global.partyOffset);

    // Move the Global.viewport
    Global.viewport = PAL_XY(
      PAL_X(Global.viewport) + dx,
      PAL_Y(Global.viewport) + dy
    );

    evtObj.x += dx;
    evtObj.y += dy;

    yield play.update(false);
    yield scene.makeScene();
    surface.updateScreen(null);
    offsetX = x * 32 + h * 16 - PAL_X(Global.viewport) - PAL_X(Global.partyOffset);
    offsetY = y * 16 + h * 8 - PAL_Y(Global.viewport) - PAL_Y(Global.partyOffset);

    yield sleepByFrame(1);
  }
};

/**
 * Make the specified event object chase the players.
 *
 * @param  {Number}  eventObjectID the event object ID of the monster.
 * @param  {Number}  speed         the speed of chasing.
 * @param  {Number}  chaseRange    sensitive range of the monster.
 * @param  {Boolean} floating      [TRUE if monster is floating (i.e., ignore the obstacles)
 */
script.monsterChasePlayer = function(eventObjectID, speed, chaseRange, floating) {
  log.trace('[SCRIPT] monsterChasePlayer(%d, %d, %d)', eventObjectID, speed, chaseRange);
  var evtObj = GameData.eventObject[eventObjectID - 1];
  var monsterSpeed = 0;
  var prevx, prevy;
  if (Global.chaseRange !== 0) {
    var x = PAL_X(Global.viewport) + PAL_X(Global.partyOffset) - evtObj.x,
        y = PAL_Y(Global.viewport) + PAL_Y(Global.partyOffset) - evtObj.y;

    if (x == 0) {
       x = randomLong(0, 1) ? -1 : 1;
    }
    if (y == 0) {
       y = randomLong(0, 1) ? -1 : 1;
    }
    var prevx = evtObj.x,
        prevy = evtObj.y;
    var i = prevx % 32,
        j = prevy % 16;
    prevx = ~~(prevx / 32);
    prevy = ~~(prevy / 16);
    var l = 0;
    if (i + j * 2 >= 16) {
       if (i + j * 2 >= 48) {
          prevx++;
          prevy++;
       } else if (32 - i + j * 2 < 16) {
          prevx++;
       } else if (32 - i + j * 2 < 48) {
          l = 1;
       } else{
          prevy++;
       }
    }
    prevx = prevx * 32 + l * 16;
    prevy = prevy * 16 + l * 8;

    // Is the party near to the event object?
    if (abs(x) + abs(y) * 2 < chaseRange * 32 * Global.chaseRange) {
      if (x < 0) {
         if (y < 0) {
            evtObj.direction = Direction.West;
         } else {
            evtObj.direction = Direction.South;
         }
      } else {
         if (y < 0) {
            evtObj.direction = Direction.North;
         } else {
            evtObj.direction = Direction.East;
         }
      }

      if (x !== 0) {
         x = evtObj.x + ~~(x / abs(x)) * 16;
      } else {
         x = evtObj.x;
      }
      if (y !== 0) {
         y = evtObj.y + ~~(y / abs(y)) * 8;
      } else {
         y = evtObj.y;
      }

      if (floating) {
         monsterSpeed = speed;
      } else {
        if (!scene.checkObstacle(PAL_XY(x, y), true, eventObjectID)) {
           monsterSpeed = speed;
        } else {
           evtObj.x = prevx;
           evtObj.y = prevy;
        }
        for (l = 0; l < 4; l++) {
          switch (l) {
            case 0:
               evtObj.x -= 4;
               evtObj.y += 2;
               break;
            case 1:
               evtObj.x -= 4;
               evtObj.y -= 2;
               break;
            case 2:
               evtObj.x += 4;
               evtObj.y -= 2;
               break;
            case 3:
               evtObj.x += 4;
               evtObj.y += 2;
               break;
          }
          if (scene.checkObstacle(PAL_XY(evtObj.x, evtObj.y), false, 0)) {
             evtObj.x = prevx;
             evtObj.y = prevy;
          }
        }
      }
    }
  }
  script.NPCWalkOneStep(eventObjectID, monsterSpeed);
};

/**
 * Interpret and execute one instruction in the script.
 *
 * @param {Number} scriptEntry   The script entry to execute.
 * @param {Number} eventObjectID The event object ID which invoked the script.
 * @yield {Number} The address of the next script instruction to execute.
 */
script.interpretInstruction = function*(scriptEntry, eventObjectID) {
  var sc = GameData.scriptEntry[scriptEntry];
  var evtObj;// = GameData.eventObject[eventObjectID - 1],
  var current;
  var curEventObjectID;
  var playerRole, i, j, x, y, w;
  if (eventObjectID !== 0) {
    evtObj = GameData.eventObject[eventObjectID - 1];
  } else {
    evtObj = null;
  }
  if (sc.operand[0] === 0 || sc.operand[0] === 0xFFFF) {
    current = evtObj;
    curEventObjectID = eventObjectID;
  } else {
    i = sc.operand[0] - 1;
    if (i > 0x9000) {
       // HACK for Dream 2.11 to avoid crash
       i -= 0x9000;
    }
    current = GameData.eventObject[i];
    curEventObjectID = sc.operand[0];
  }
  if (sc.operand[0] < Const.MAX_PLAYABLE_PLAYER_ROLES) {
    playerRole = Global.party[sc.operand[0]].playerRole;
  } else {
    playerRole = Global.party[0].playerRole;
  }
  log.trace('[SCRIPT] interpretInstruction %d: (%d(0x%.4x) - %d, %d, %d)',
    scriptEntry, sc.operation, sc.operation,
    sc.operand[0], sc.operand[1],
    sc.operand[2], sc.operand[3]
  );

  switch (sc.operation) {
    case 0x000B:
    case 0x000C:
    case 0x000D:
    case 0x000E:
      script.debug('[SCRIPT] walk one step');
      evtObj.direction = sc.operation - 0x000B;
      script.NPCWalkOneStep(eventObjectID, 2);
      break;
    case 0x000F:
      script.debug('[SCRIPT] Set the direction and/or gesture for event object');
      if (sc.operand[0] !== 0xFFFF) {
         evtObj.direction = sc.operand[0];
      }
      if (sc.operand[1] !== 0xFFFF) {
         evtObj.currentFrameNum = sc.operand[1];
      }
      break;
    case 0x0010:
      script.debug('[SCRIPT] Walk straight to the specified position');
      var ret = script.NPCWalkTo(eventObjectID, sc.operand[0], sc.operand[1], sc.operand[2], 3);
      if (!ret) scriptEntry--;
      break;
    case 0x0011:
      script.debug('[SCRIPT] Walk straight to the specified position, at a lower speed');
      if ((eventObjectID & 1) ^ (Global.frameNum & 1)) {
        var ret = script.NPCWalkTo(eventObjectID, sc.operand[0], sc.operand[1], sc.operand[2], 2);
        if (!ret) {
          scriptEntry--;
        }
      } else {
        scriptEntry--;
      }
      break;
    case 0x0012:
      script.debug('[SCRIPT] Set the position of the event object, relative to the party');
      current.x = sc.operand[1] + PAL_X(Global.viewport) + PAL_X(Global.partyOffset);
      current.y = sc.operand[2] + PAL_Y(Global.viewport) + PAL_Y(Global.partyOffset);
      break;
    case 0x0013:
      script.debug('[SCRIPT] Set the position of the event object');
      current.x = sc.operand[1];
      current.y = sc.operand[2];
      break;
    case 0x0014:
      script.debug('[SCRIPT] Set the gesture of the event object');
      evtObj.currentFrameNum = sc.operand[0];
      evtObj.direction = Direction.South;
      break;
    case 0x0015:
      script.debug('[SCRIPT] Set the direction and gesture for a party member');
      Global.partyDirection = sc.operand[0];
      Global.party[sc.operand[2]].frame = Global.partyDirection * 3 + sc.operand[1];
      break;
    case 0x0016:
      script.debug('[SCRIPT] Set the direction and gesture for an event object');
      if (sc.operand[0] !== 0) {
        current.direction = sc.operand[1];
        current.currentFrameNum = sc.operand[2];
      }
      break;
    case 0x0017:
      script.debug('[SCRIPT] set the player\'s extra attribute');
      /*{
         WORD *p;

         var i = sc.operand[0] - 0xB;

         p = (WORD *)(&Global.equipmentEffect[i]); // HACKHACK

         p[sc.operand[1] * MAX_PLAYER_ROLES + eventObjectID] =
            (SHORT)sc.operand[2];
      }*/
      // WARNING HACK
      i = sc.operand[0] - 0xB;
      var p = new BinaryReader(Global.equipmentEffect[i].uint8Array);
      var offset = (sc.operand[1] * Const.MAX_PLAYER_ROLES + eventObjectID) * 2;
      p.setUint16(offset, SHORT(sc.operand[2])); // WARNING setInt16??
      break;
    case 0x0018:
      script.debug('[SCRIPT] Equip the selected item');
      i = sc.operand[0] - 0x0B;
      script.curEquipPart = i;
      // The eventObjectID parameter here should indicate the player role
      script.removeEquipmentEffect(eventObjectID, i);
      if (GameData.playerRoles.equipment[i][eventObjectID] !== sc.operand[1]) {
        w = GameData.playerRoles.equipment[i][eventObjectID];
        GameData.playerRoles.equipment[i][eventObjectID] = sc.operand[1];
        script.addItemToInventory(sc.operand[1], -1);
        if (w !== 0) {
          script.addItemToInventory(w, 1);
        }
        Global.lastUnequippedItem = w;
      }
      break;
    case 0x0019:
      script.debug('[SCRIPT] Increase/decrease the player\'s attribute');
      /*{
         WORD *p = (WORD *)(&GameData.playerRoles); // HACKHACK

         if (sc.operand[2] == 0)
         {
            playerRole = eventObjectID;
         }
         else
         {
            playerRole = sc.operand[2] - 1;
         }

         p[sc.operand[0] * MAX_PLAYER_ROLES + playerRole] +=
            (SHORT)sc.operand[1];
      }*/
      // WARNING HACK
      var playerRole = (sc.operand[2] === 0 ? eventObjectID : (sc.operand[2] - 1));
      var reader = new BinaryReader(GameData.playerRoles.uint8Array);
      var offset = (sc.operand[0] * Const.MAX_PLAYER_ROLES + playerRole) * 2;
      var val = reader.getUint16(offset) + sc.operand[1];
      reader.setUint16(offset, SHORT(val)); // WARNING setInt16??
      break;
    case 0x001A:
      script.debug('[SCRIPT] Set player\'s stat');
      /*{
         WORD *p = (WORD *)(&GameData.playerRoles); // HACKHACK

         if (g_iCurEquipPart != -1)
         {
            // In the progress of equipping items
            p = (WORD *)&(Global.equipmentEffect[g_iCurEquipPart]);
         }

         if (sc.operand[2] == 0)
         {
            // Apply to the current player. The eventObjectID should
            // indicate the player role.
            playerRole = eventObjectID;
         }
         else
         {
            playerRole = sc.operand[2] - 1;
         }

         p[sc.operand[0] * MAX_PLAYER_ROLES + playerRole] =
            (SHORT)sc.operand[1];
      }*/
      // WARNING HACK
      var playerRole;
      if (sc.operand[2] === 0) {
        // Apply to the current player. The eventObjectID should
        // indicate the player role.
        playerRole = eventObjectID;
      } else {
        playerRole = sc.operand[2] - 1;
      }
      var reader;
      if (script.curEquipPart !== -1) {
        // In the progress of equipping items
        reader = new BinaryReader(Global.equipmentEffect[script.curEquipPart].uint8Array);
      } else {
        reader = new BinaryReader(GameData.playerRoles.uint8Array);
      }
      var offset = (sc.operand[0] * Const.MAX_PLAYER_ROLES + playerRole) * 2;
      reader.setUint16(offset, SHORT(sc.operand[1])); // WARNING setInt16??
      break;
    case 0x001B:
      script.debug('[SCRIPT] Increase/decrease player\'s HP');
      if (sc.operand[0]) {
        // Apply to everyone
        for (i = 0; i <= Global.maxPartyMemberIndex; i++) {
          w = Global.party[i].playerRole;
          script.increaseHPMP(w, SHORT(sc.operand[1]), 0);
        }
      } else {
        // Apply to one player. The eventObjectID parameter should indicate the player role.
        if (!script.increaseHPMP(eventObjectID, SHORT(sc.operand[1]), 0)) {
          script.scriptSuccess = false;
        }
      }
      break;
    case 0x001C:
      script.debug('[SCRIPT] Increase/decrease player\'s MP');
      if (sc.operand[0]) {
        // Apply to everyone
        for (i = 0; i <= Global.maxPartyMemberIndex; i++) {
          w = Global.party[i].playerRole;
          script.increaseHPMP(w, 0, SHORT(sc.operand[1]));
        }
      } else {
        // Apply to one player. The eventObjectID parameter should indicate the player role.
        if (!script.increaseHPMP(eventObjectID, 0, SHORT(sc.operand[1]))) {
          script.scriptSuccess = false;
        }
      }
      break;
    case 0x001D:
      script.debug('[SCRIPT] Increase/decrease player\'s HP and MP');
      if (sc.operand[0]) {
        // Apply to everyone
        for (i = 0; i <= Global.maxPartyMemberIndex; i++) {
          w = Global.party[i].playerRole;
          script.increaseHPMP(w, SHORT(sc.operand[1]), SHORT(sc.operand[1]));
        }
      } else {
        // Apply to one player. The eventObjectID parameter should indicate the player role.
        if (!script.increaseHPMP(eventObjectID, SHORT(sc.operand[1]), SHORT(sc.operand[1]))) {
          script.scriptSuccess = false;
        }
      }
      break;
    case 0x001E:
      script.debug('[SCRIPT] Increase or decrease cash by the specified amount');
      if (SHORT(sc.operand[0]) < 0 && Global.cash < -SHORT(sc.operand[0])) {
        // not enough cash
        scriptEntry = sc.operand[1] - 1;
      } else {
        Global.cash += SHORT(sc.operand[0]);
      }
      break;
    case 0x001F:
      script.debug('[SCRIPT] Add item to inventory');
      script.addItemToInventory(sc.operand[0], SHORT(sc.operand[1]));
      break;
    case 0x0020:
      script.debug('[SCRIPT] Remove item from inventory');
      if (!script.addItemToInventory(sc.operand[0], -(sc.operand[1] === 0 ? 1 : sc.operand[1]))) {
        // Try removing equipped item
        x = sc.operand[1];
        if (x === 0) {
          x = 1;
        }
        for (i = 0; i <= Global.maxPartyMemberIndex; i++) {
          w = Global.party[i].playerRole;
          for (j = 0; j < Const.MAX_PLAYER_EQUIPMENTS; j++) {
            if (GameData.playerRoles.equipment[j][w] === sc.operand[0]) {
              script.removeEquipmentEffect(w, j);
              GameData.playerRoles.equipment[j][w] = 0;
              x--;
              if (x === 0) {
                i = 9999;
                break; // - -''看起来是为了跳出for-i的循环
              }
            }
          }
        }
        if (x > 0 && sc.operand[2] !== 0) {
          scriptEntry = sc.operand[2] - 1;
        }
      }
      break;
    case 0x0021:
      script.debug('[SCRIPT] Inflict damage to the enemy');
      if (sc.operand[0]) {
        // Inflict damage to all enemies
        for (i = 0; i <= Global.battle.maxEnemyIndex; i++) {
          if (Global.battle.enemy[i].objectID != 0) {
            Global.battle.enemy[i].e.health -= sc.operand[1];
          }
        }
      } else {
        // Inflict damage to one enemy
        Global.battle.enemy[eventObjectID].e.health -= sc.operand[1];
      }
      break;
    case 0x0022:
      script.debug('[SCRIPT] Revive player');
      if (sc.operand[0]) {
        // Apply to everyone
        script.scriptSuccess = false;
        for (i = 0; i <= Global.maxPartyMemberIndex; i++) {
          w = Global.party[i].playerRole;
          if (GameData.playerRoles.HP[w] === 0) {
            GameData.playerRoles.HP[w] = ~~(GameData.playerRoles.maxHP[w] * sc.operand[1] / 10);
            script.curePoisonByLevel(w, 3);
            for (x = 0; x < PlayerStatus.All; x++) {
              script.removePlayerStatus(w, x);
            }
            script.scriptSuccess = true;
          }
        }
      } else {
        // Apply to one player
        if (GameData.playerRoles.HP[eventObjectID] === 0) {
          GameData.playerRoles.HP[eventObjectID] = ~~(GameData.playerRoles.maxHP[eventObjectID] * sc.operand[1] / 10);
          script.curePoisonByLevel(eventObjectID, 3);
          for (x = 0; x < PlayerStatus.All; x++) {
            script.removePlayerStatus(eventObjectID, x);
          }
        } else {
          script.scriptSuccess = false;
        }
      }
      break;
    case 0x0023:
      script.debug('[SCRIPT] Remove equipment from the specified player');
      if (sc.operand[1] === 0) {
        // Remove all equipments
        for (i = 0; i < Const.MAX_PLAYER_EQUIPMENTS; i++) {
          w = GameData.playerRoles.equipment[i][playerRole];
          if (w !== 0) {
            script.addItemToInventory(w, 1);
            GameData.playerRoles.equipment[i][playerRole] = 0;
          }
          script.removeEquipmentEffect(playerRole, i);
        }
      } else {
        w = GameData.playerRoles.equipment[sc.operand[1] - 1][playerRole];
        if (w !== 0) {
          script.removeEquipmentEffect(playerRole, sc.operand[1] - 1);
          script.addItemToInventory(w, 1);
          GameData.playerRoles.equipment[sc.operand[1] - 1][playerRole] = 0;
        }
      }
      break;
    case 0x0024:
      script.debug('[SCRIPT] Set the autoscript entry address for an event object');
      if (sc.operand[0] !== 0) {
        current.autoScript = sc.operand[1];
      }
      break;
    case 0x0025:
      script.debug('[SCRIPT] Set the trigger sc entry address for an event object');
      if (sc.operand[0] !== 0) {
         current.triggerScript = sc.operand[1];
      }
      break;
    case 0x0026:
      script.debug('[SCRIPT] Show the buy item menu');
      yield scene.makeScene();
      surface.updateScreen(null);
      yield uigame.buyMenu(sc.operand[0]);
      break;
    case 0x0027:
      script.debug('[SCRIPT] Show the sell item menu');
      yield scene.makeScene();
      surface.updateScreen(null);
      yield uigame.sellMenu();
      break;
    case 0x0028:
      script.debug('[SCRIPT] Apply poison to enemy');
      if (sc.operand[0]) {
        // Apply to everyone
        for (i = 0; i <= Global.battle.maxEnemyIndex; i++) {
          w = Global.battle.enemy[i].objectID;
          if (w === 0) {
            continue;
          }
          if (randomLong(0, 9) >= GameData.object[w].enemy.resistanceToSorcery) {
            for (j = 0; j < Const.MAX_POISONS; j++) {
              if (Global.battle.enemy[i].poisons[j].poisonID === sc.operand[1]){
                break;
              }
            }
            if (j >= Const.MAX_POISONS) {
              for (j = 0; j < Const.MAX_POISONS; j++) {
                if (Global.battle.enemy[i].poisons[j].poisonID === 0) {
                  Global.battle.enemy[i].poisons[j].poisonID = sc.operand[1];
                  var ret = yield script.runTriggerScript(GameData.object[sc.operand[1]].poison.enemyScript, eventObjectID);
                  Global.battle.enemy[i].poisons[j].poisonScript = ret;
                  break;
                }
              }
            }
          }
        }
      } else {
        // Apply to one enemy
        w = Global.battle.enemy[eventObjectID].objectID;
        if (randomLong(0, 9) >= GameData.object[w].enemy.resistanceToSorcery) {
          for (j = 0; j < Const.MAX_POISONS; j++) {
            if (Global.battle.enemy[eventObjectID].poisons[j].poisonID == sc.operand[1]) {
              break;
            }
          }
          if (j >= Const.MAX_POISONS) {
            for (j = 0; j < Const.MAX_POISONS; j++) {
              if (Global.battle.enemy[eventObjectID].poisons[j].poisonID == 0) {
                Global.battle.enemy[eventObjectID].poisons[j].poisonID = sc.operand[1];
                var ret = yield script.runTriggerScript(GameData.object[sc.operand[1]].poison.enemyScript, eventObjectID);
                Global.battle.enemy[eventObjectID].poisons[j].poisonScript = ret;
                break;
              }
            }
          }
        }
      }
      break;
    case 0x0029:
      script.debug('[SCRIPT] Apply poison to player');
      if (sc.operand[0]) {
        // Apply to everyone
        for (i = 0; i <= Global.maxPartyMemberIndex; i++) {
          w = Global.party[i].playerRole;
          if (randomLong(1, 100) > script.getPlayerPoisonResistance(w)) {
            script.addPoisonForPlayer(w, sc.operand[1]);
          }
        }
      } else {
        // Apply to one player
        if (randomLong(1, 100) > script.getPlayerPoisonResistance(eventObjectID)) {
          script.addPoisonForPlayer(eventObjectID, sc.operand[1]);
        }
      }
      break;
    case 0x002A:
      script.debug('[SCRIPT] Cure poison by object ID for enemy');
      if (sc.operand[0]) {
        // Apply to all enemies
        for (i = 0; i <= Global.battle.maxEnemyIndex; i++) {
          if (Global.battle.enemy[i].objectID === 0){
            continue;
          }
          for (j = 0; j < Const.MAX_POISONS; j++) {
            if (Global.battle.enemy[i].poisons[j].poisonID === sc.operand[1]) {
              Global.battle.enemy[i].poisons[j].poisonID = 0;
              Global.battle.enemy[i].poisons[j].poisonScript = 0;
              break;
            }
          }
        }
      } else {
        // Apply to one enemy
        for (j = 0; j < Const.MAX_POISONS; j++) {
          if (Global.battle.enemy[eventObjectID].poisons[j].poisonID == sc.operand[1]) {
            Global.battle.enemy[eventObjectID].poisons[j].poisonID = 0;
            Global.battle.enemy[eventObjectID].poisons[j].poisonScript = 0;
            break;
          }
        }
      }
      break;
    case 0x002B:
      script.debug('[SCRIPT] Cure poison by object ID for player');
      if (sc.operand[0]) {
        for (i = 0; i <= Global.maxPartyMemberIndex; i++) {
          w = Global.party[i].playerRole;
          script.curePoisonByKind(w, sc.operand[1]);
        }
      } else {
        script.curePoisonByKind(eventObjectID, sc.operand[1]);
      }
      break;
    case 0x002C:
      script.debug('[SCRIPT] Cure poisons by level');
      if (sc.operand[0]) {
        for (i = 0; i <= Global.maxPartyMemberIndex; i++) {
          w = Global.party[i].playerRole;
          script.curePoisonByLevel(w, sc.operand[1]);
        }
      } else {
        script.curePoisonByLevel(eventObjectID, sc.operand[1]);
      }
      break;
    case 0x002D:
      script.debug('[SCRIPT] Set the status for player');
      script.setPlayerStatus(eventObjectID, sc.operand[0], sc.operand[1]);
      break;
    case 0x002E:
      script.debug('[SCRIPT] Set the status for enemy');
      w = Global.battle.enemy[eventObjectID].objectID;
      if (PAL_CLASSIC) {
        i = 9;
      } else {
        i = ((sc.operand[0] === PlayerStatus.Slow) ? 14 : 9);
      }
      if (randomLong(0, i) >= GameData.object[w].enemy.resistanceToSorcery &&
          Global.battle.enemy[eventObjectID].status[sc.operand[0]] === 0) {
        Global.battle.enemy[eventObjectID].status[sc.operand[0]] = sc.operand[1];
      } else {
        scriptEntry = sc.operand[2] - 1;
      }
      break;
    case 0x002F:
      script.debug('[SCRIPT] Remove player\'s status')
      script.removePlayerStatus(eventObjectID, sc.operand[0]);
      break;
    case 0x0030:
      script.debug('[SCRIPT] Increase player\'s stat temporarily by percent');
      /*{
         WORD *p = (WORD *)(&gpGlobals->rgEquipmentEffect[kBodyPartExtra]); // HACKHACK
         WORD *p1 = (WORD *)(&gpGlobals->g.PlayerRoles);

         if (pScript->rgwOperand[2] == 0)
         {
            iPlayerRole = wEventObjectID;
         }
         else
         {
            iPlayerRole = pScript->rgwOperand[2] - 1;
         }

         p[pScript->rgwOperand[0] * MAX_PLAYER_ROLES + iPlayerRole] =
            p1[pScript->rgwOperand[0] * MAX_PLAYER_ROLES + iPlayerRole] *
               (SHORT)pScript->rgwOperand[1] / 100;
      }*/
      // WARNING HACK
      var reader = new BinaryReader(script.equipmentEffect[BodyPart.Extra].uint8Array),
          reader1 = new BinaryReader(GameData.playerRoles.uint8Array);
      if (sc.operand[2] === 0) {
        playerRole = eventObjectID;
      } else {
        playerRole = sc.operand[2] - 1;
      }
      var offset = (sc.operand[0] * Const.MAX_PLAYER_ROLES + playerRole) * 2;
      var val = reader1.getUint16(offset) * floor(SHORT(sc.operand[1]) / 100);
      reader.setUint16(offset, val); // WARNING setInt16??
      break;
    case 0x0031:
      script.debug('[SCRIPT] Change battle sprite temporarily for player');
      Global.equipmentEffect[BodyPart.Extra].spriteNumInBattle[eventObjectID] = sc.operand[0];
      break;
    case 0x0033:
      script.debug('[SCRIPT] collect the enemy for items');
      if (Global.battle.enemy[eventObjectID].e.collectValue !== 0) {
        Global.collectValue += Global.battle.enemy[eventObjectID].e.collectValue;
      } else {
        scriptEntry = sc.operand[0] - 1;
      }
      break;
    case 0x0034:
      script.debug('[SCRIPT] Transform collected enemies into items');
      if (Global.collectValue > 0) {
        if (PAL_CLASSIC) {
          i = randomLong(1, Global.collectValue);
          if (i > 9) {
            i = 9;
          }
        } else {
          i = randomLong(1, 9);
          if (i > Global.collectValue) {
            i = Global.collectValue;
          }
        }
        Global.collectValue -= i;
        i--;
        script.addItemToInventory(GameData.store[0].items[i], 1);
        ui.startDialog(DialogPosition.CenterWindow, 0, 0, false);
        var s = ui.getWord(42);
        s = s.concat(ui.getWord(GameData.store[0].items[i]));
        ui.showDialogText(s);
      } else {
        scriptEntry = sc.operand[0] - 1;
      }
      break;
    case 0x0035:
      script.debug('[SCRIPT] Shake the screen');
      i = sc.operand[1];
      if (i === 0) {
         i = 4;
      }
      yield surface.shakeScreen(sc.operand[0], i);
      if (!sc.operand[0]) {
         surface.updateScreen(null);
      }
      break;
    case 0x0036:
      script.debug('[SCRIPT] Set the current playing RNG animation');
      Global.curPlayingRNG = sc.operand[0];
      break;
    case 0x0037:
      script.debug('[SCRIPT] Play RNG animation');
      yield rng.play(
        Global.curPlayingRNG,
        sc.operand[0],
        sc.operand[1] > 0 ? sc.operand[1] : 999,
        sc.operand[2] > 0 ? sc.operand[2] : 16
      );
      break;
    case 0x0038:
      script.debug('[SCRIPT] Teleport the party out of the scene');
      if (!Global.inBattle && GameData.scene[Global.numScene - 1].scriptOnTeleport != 0) {
        var ret = yield script.runTriggerScript(GameData.scene[Global.numScene - 1].scriptOnTeleport, 0xFFFF);
        GameData.scene[Global.numScene - 1].scriptOnTeleport = ret;
      } else {
        // failed
        script.scriptSuccess = false;
        scriptEntry = sc.operand[0] - 1;
      }
      break;
    case 0x0039:
      script.debug('[SCRIPT] Drain HP from enemy');
      w = Global.party[Global.battle.movingPlayerIndex].playerRole;
      Global.battle.enemy[eventObjectID].e.health -= sc.operand[0];
      GameData.playerRoles.HP[w] += sc.operand[0];
      if (GameData.playerRoles.HP[w] > GameData.playerRoles.maxHP[w]) {
         GameData.playerRoles.HP[w] = GameData.playerRoles.maxHP[w];
      }
      break;
    case 0x003A:
      script.debug('[SCRIPT] Player flee from the battle');
      if (Global.battle.isBoss) {
        // Cannot flee from bosses
        scriptEntry = sc.operand[0] - 1;
      } else {
        yield battle.playerEscape();
      }
      break;
    case 0x003F:
      script.debug('[SCRIPT] Ride the event object to the specified position, at a low speed');
      yield script.partyRideEventObject(eventObjectID, sc.operand[0], sc.operand[1], sc.operand[2], 2)
      break;
    case 0x0040:
      script.debug('[SCRIPT] set the trigger method for a event object');
      if (sc.operand[0] != 0) {
        current.triggerMode = sc.operand[1];
      }
      break;
    case 0x0041:
      script.debug('[SCRIPT] Mark the sc as failed');
      script.scriptSuccess = false;
      break;
    case 0x0042:
      script.debug('[SCRIPT] Simulate a magic for player');
      i = SHORT(sc.operand[2]) - 1;
      if (i < 0) {
        i = eventObjectID;
      }
      yield battle.simulateMagic(i, sc.operand[0], sc.operand[1]);
      break;
    case 0x0043:
      script.debug('[SCRIPT] Set background music');
      Global.musicNum = sc.operand[0];
      music.play(sc.operand[0], (sc.operand[0] != 0x3D), sc.operand[1]);
      break;
    case 0x0044:
      script.debug('[SCRIPT] Ride the event object to the specified position, at the normal speed');
      yield script.partyRideEventObject(eventObjectID, sc.operand[0], sc.operand[1], sc.operand[2], 4);
      break;
    case 0x0045:
      script.debug('[SCRIPT] Set battle music');
      Global.numBattleMusic = sc.operand[0];
      break;
    case 0x0046:
      script.debug('[SCRIPT] Set the party position on the map');
      var offsetX, offsetY, x, y;

      offsetX = ((Global.partyDirection === Direction.West || Global.partyDirection === Direction.South) ? 16 : -16);
      offsetY = ((Global.partyDirection === Direction.West || Global.partyDirection === Direction.North) ? 8 : -8);
      x = sc.operand[0] * 32 + sc.operand[2] * 16;
      y = sc.operand[1] * 16 + sc.operand[2] * 8;
      x -= PAL_X(Global.partyOffset);
      y -= PAL_Y(Global.partyOffset);
      Global.viewport = PAL_XY(x, y);
      x = PAL_X(Global.partyOffset);
      y = PAL_Y(Global.partyOffset);
      for (i = 0; i < Const.MAX_PLAYABLE_PLAYER_ROLES; i++) {
        Global.party[i].x = x;
        Global.party[i].y = y;
        Global.trail[i].x = x + PAL_X(Global.viewport);
        Global.trail[i].y = y + PAL_Y(Global.viewport);
        Global.trail[i].direction = Global.partyDirection;
        x += offsetX;
        y += offsetY;
      }
      break;
    case 0x0047:
      script.debug('[SCRIPT] Play sound effect');
      sound.play(sc.operand[0]);
      break;
    case 0x0049:
      script.debug('[SCRIPT] Set the state of event object');
      if (current) {
        // WARNING 这里有一个BUG，在京城云姨家茅山道士施法之后，从刘晋元房间出来，current为空
        current.state = sc.operand[1];
      }
      break;
    case 0x004A:
      script.debug('[SCRIPT] Set the current battlefield');
      Global.numBattleField = sc.operand[0];
      break;
    case 0x004B:
      script.debug('[SCRIPT] Nullify the event object for a short while');
      evtObj.vanishTime = -15;
      break;
    case 0x004C:
      script.debug('[SCRIPT] chase the player');
      i = sc.operand[0]; // max. distance
      j = sc.operand[1]; // speed
      if (i === 0) {
        i = 8;
      }
      if (j === 0) {
        j = 4;
      }
      script.monsterChasePlayer(eventObjectID, j, i, sc.operand[2]);
      break;
    case 0x004D:
      script.debug('[SCRIPT] wait for any key');
      yield input.waitForKey(0);
      break;
    case 0x004E:
      script.debug('[SCRIPT] Load the last saved game');
      yield surface.fadeOut(1);
      yield game.initGameData(Global.currentSaveSlot);
      return 0; // don't go further
    case 0x004F:
      script.debug('[SCRIPT] Fade the screen to red color (game over)');
      yield surface.fadeToRed();
      break;
    case 0x0050:
      script.debug('[SCRIPT] screen fade out');
      surface.updateScreen(null);
      yield surface.fadeOut((sc.operand[0] ? sc.operand[0] : 1));
      Global.needToFadeIn = true;
      break;
    case 0x0051:
      script.debug('[SCRIPT] screen fade in')
      surface.updateScreen(null);
      var time = SHORT(sc.operand[0]);
      yield surface.fadeIn(Global.numPalette, Global.nightPalette, (time > 0 ? time : 1));
      Global.needToFadeIn = false;
      break;
    case 0x0052:
      script.debug('[SCRIPT] hide the event object for a while, default 800 frames');
      evtObj.state *= -1;
      evtObj.vanishTime = (sc.operand[0] ? sc.operand[0] : 800);
      break;
    case 0x0053:
      script.debug('[SCRIPT] use the day palette');
      Global.nightPalette = false;
      break;
    case 0x0054:
      script.debug('[SCRIPT] use the night palette');
      Global.nightPalette = true;
      break;
    case 0x0055:
      script.debug('[SCRIPT] Add magic to a player');
      i = sc.operand[1];
      if (i === 0) {
        i = eventObjectID;
      } else {
        i--;
      }
      script.addMagic(i, sc.operand[0]);
      break;
    case 0x0056:
      script.debug('[SCRIPT] Remove magic from a player');
      i = sc.operand[1];
      if (i === 0) {
        i = eventObjectID;
      } else {
        i--;
      }
      script.removeMagic(i, sc.operand[0]);
      break;
    case 0x0057:
      script.debug('[SCRIPT] Set the base damage of magic according to MP value'); // 酒神吧大概是
      i = ((sc.operand[1] === 0) ? 8 : sc.operand[1]);
      j = GameData.object[sc.operand[0]].magic.magicNumber;
      GameData.magic[j].baseDamage = GameData.playerRoles.MP[eventObjectID] * i;
      GameData.playerRoles.MP[eventObjectID] = 0;
      break;
    case 0x0058:
      script.debug('[SCRIPT] Jump if there is less than the specified number of the specified items in the inventory');
      if (script.getItemAmount(sc.operand[0]) < SHORT(sc.operand[1])) {
         scriptEntry = sc.operand[2] - 1;
      }
      break;
    case 0x0059:
      script.debug('[SCRIPT] Change to the specified scene');
      if (sc.operand[0] > 0 && sc.operand[0] <= Const.MAX_SCENES && Global.numScene !== sc.operand[0]) {
        // Set data to load the scene in the next frame
        Global.numScene = sc.operand[0];
        res.setLoadFlags(LoadFlag.Scene);
        Global.enteringScene = true;
        Global.layer = 0;
      }
      break;
    case 0x005A:
      script.debug('[SCRIPT] Halve the player\'s HP');
      // The eventObjectID parameter here should indicate the player role
      GameData.playerRoles.HP[eventObjectID] = ~~(GameData.playerRoles.HP[eventObjectID] / 2);
      break;
    case 0x005B:
      script.debug('[SCRIPT] Halve the enemy\'s HP');
      w = ~~(Global.battle.enemy[eventObjectID].e.health / 2) + 1;
      if (w > sc.operand[0]) {
        w = sc.operand[0];
      }
      Global.battle.enemy[eventObjectID].e.health -= w;
      break;
    case 0x005C:
      script.debug('[SCRIPT] Hide for a while'); // 隐蛊吧大概是
        // WARNING 转换位INT类型
      Global.battle.hidingTime = -sc.operand[0];
      break;
    case 0x005D:
      script.debug('[SCRIPT] Jump if player doesn\'t have the specified poison');
      if (!script.isPlayerPoisonedByKind(eventObjectID, sc.operand[0])) {
        scriptEntry = sc.operand[1] - 1;
      }
      break;
    case 0x005E:
      script.debug('[SCRIPT] Jump if enemy doesn\'t have the specified poison');
      for (i = 0; i < Const.MAX_POISONS; i++) {
        if (Global.battle.enemy[eventObjectID].poisons[i].poisonID == sc.operand[0]) {
          break;
        }
      }
      if (i >= Const.MAX_POISONS) {
        scriptEntry = sc.operand[1] - 1;
      }
      break;
    case 0x005F:
      script.debug('[SCRIPT] Kill the player immediately');
      // The eventObjectID parameter here should indicate the player role
      GameData.playerRoles.HP[eventObjectID] = 0;
      break;
    case 0x0060:
      script.debug('[SCRIPT] Immediate KO of the enemy');
      Global.battle.enemy[eventObjectID].e.health = 0;
      break;
    case 0x0061:
      script.debug('[SCRIPT] Jump if player is not poisoned');
      if (!script.isPlayerPoisonedByLevel(eventObjectID, 1)) {
        scriptEntry = sc.operand[0] - 1;
      }
      break;
    case 0x0062:
      script.debug('[SCRIPT] Pause enemy chasing for a while');
      Global.chaseSpeedChangeCycles = sc.operand[0];
      Global.chaseRange = 0;
      break;
    case 0x0063:
      script.debug('[SCRIPT] Speed up enemy chasing for a while');
      Global.chaseSpeedChangeCycles = sc.operand[0];
      Global.chaseRange = 3;
      break;
    case 0x0064:
      script.debug('[SCRIPT] Jump if enemy\'s HP is more than the specified percentage');
      i = GameData.object[Global.battle.enemy[eventObjectID].objectID].enemy.enemyID;
      if (Global.battle.enemy[eventObjectID].e.health * 100 > GameData.enemy[i].health * sc.operand[0]) {
        scriptEntry = sc.operand[1] - 1;
      }
      break;
    case 0x0065:
      script.debug('[SCRIPT] Set the player\'s sprite');
      GameData.playerRoles.spriteNum[sc.operand[0]] = sc.operand[1];
      if (!Global.inBattle && sc.operand[2]) {
        res.setLoadFlags(LoadFlag.PlayerSprite);
        yield res.loadResources();
      }
      break;
    case 0x0066:
      script.debug('[SCRIPT] Throw weapon to enemy');
      w = sc.operand[1] * 5;
      w += GameData.playerRoles.attackStrength[Global.party[Global.battle.movingPlayerIndex].playerRole];
      w += randomLong(0, 4);
      yield battle.simulateMagic(SHORT(eventObjectID), sc.operand[0], w);
      break;
    case 0x0067:
      script.debug('[SCRIPT] Enemy use magic');
      //debugger;
      Global.battle.enemy[eventObjectID].e.magic = sc.operand[0];
      Global.battle.enemy[eventObjectID].e.magicRate = ((sc.operand[1] == 0) ? 10 : sc.operand[1]);
      break;
    case 0x0068:
      script.debug('[SCRIPT] Jump if it\'s enemy\'s turn');
      if (Global.battle.enemyMoving) {
        scriptEntry = sc.operand[0] - 1;
      }
      break;
    case 0x0069:
      script.debug('[SCRIPT] Enemy escape in battle');
      yield battle.enemyEscape();
      break;
    case 0x006A:
      script.debug('[SCRIPT] Steal from the enemy');
      yield battle.stealFromEnemy(eventObjectID, sc.operand[0]);
      break;
    case 0x006B:
      script.debug('[SCRIPT] Blow away enemies');
      Global.battle.blow = SHORT(sc.operand[0]);
      break;
    case 0x006C:
      script.debug('[SCRIPT] Walk the NPC in one step');
      current.x += SHORT(sc.operand[1]);
      current.y += SHORT(sc.operand[2]);
      script.NPCWalkOneStep(curEventObjectID, 0);
      break;
    case 0x006D:
      script.debug('[SCRIPT] Set the enter sc and teleport sc for a scene');
      if (sc.operand[0]) {
        if (sc.operand[1]) {
          GameData.scene[sc.operand[0] - 1].scriptOnEnter = sc.operand[1];
        }
        if (sc.operand[2]) {
          GameData.scene[sc.operand[0] - 1].scriptOnTeleport = sc.operand[2];
        }
        if (sc.operand[1] == 0 && sc.operand[2] == 0) {
          GameData.scene[sc.operand[0] - 1].scriptOnEnter = 0;
          GameData.scene[sc.operand[0] - 1].scriptOnTeleport = 0;
        }
      }
      break;
    case 0x006E:
      script.debug('[SCRIPT] Move the player to the specified position in one step');
      for (i = 3; i >= 0; i--) {
        Global.trail[i + 1] = Global.trail[i];
      }
      Global.trail[0].direction = Global.partyDirection;
      Global.trail[0].x = PAL_X(Global.viewport) + PAL_X(Global.partyOffset);
      Global.trail[0].y = PAL_Y(Global.viewport) + PAL_Y(Global.partyOffset);
      Global.viewport = PAL_XY(
        PAL_X(Global.viewport) + SHORT(sc.operand[0]),
        PAL_Y(Global.viewport) + SHORT(sc.operand[1])
      );
      Global.layer = sc.operand[2] * 8;
      if (sc.operand[0] !== 0 || sc.operand[1] !== 0){
        scene.updatePartyGestures(true);
      }
      break;
    case 0x006F:
      script.debug('[SCRIPT] Sync the state of current event object with another event object');
      if (current.state === SHORT(sc.operand[1])) {
        evtObj.state = SHORT(sc.operand[1]);
      }
      break;
    case 0x0070:
      script.debug('[SCRIPT] Walk the party to the specified position');
      yield script.partyWalkTo(sc.operand[0], sc.operand[1], sc.operand[2], 2);
      break;
    case 0x0071:
      script.debug('[SCRIPT] Wave the screen');
      Global.screenWave = sc.operand[0];
      Global.waveProgression = SHORT(sc.operand[1]);
      break;
    case 0x0072:
      script.debug('[SCRIPT] unknown 0x0072');
      // WARNING Unknown
      //throw 'unknown';
      break;
    case 0x0073:
      script.debug('[SCRIPT] Fade the screen to scene');
      surface.backupScreen();
      yield scene.makeScene();
      yield surface.fadeScreen(sc.operand[0]);
      break;
    case 0x0074:
      script.debug('[SCRIPT] Jump if not all players are full HP');
      for (i = 0; i <= Global.maxPartyMemberIndex; i++) {
        w = Global.party[i].playerRole;
        if (GameData.playerRoles.HP[w] < GameData.playerRoles.maxHP[w]) {
          scriptEntry = sc.operand[0] - 1;
          break;
        }
      }
      break;
    case 0x0075:
      script.debug('[SCRIPT] Set the player party');
      Global.maxPartyMemberIndex = 0;
      for (i = 0; i < 3; i++) {
        if (sc.operand[i] != 0) {
          Global.party[Global.maxPartyMemberIndex].playerRole = sc.operand[i] - 1;
          // WARNING TODO
          Global.battle.player[Global.maxPartyMemberIndex].action.actionType = BattleActionType.Attack;
          Global.maxPartyMemberIndex++;
        }
      }
      if (Global.maxPartyMemberIndex === 0) {
        // HACK for Dream 2.11
        Global.party[0].playerRole = 0;
        Global.maxPartyMemberIndex = 1;
      }
      Global.maxPartyMemberIndex--;
      // Reload the player sprites
      res.setLoadFlags(LoadFlag.PlayerSprite);
      yield res.loadResources();
      //for (var i=0; i<Const.MAX_POISONS; ++i) {
      //  Global.poisonStatus[i] = initTypedArray(PoisonStatus, Const.MAX_PLAYABLE_PLAYER_ROLES);
      //}
      memset(Global.poisonStatus.uint8Array, 0, Global.poisonStatus.uint8Array.length);
      yield script.updateEquipments();
      break;
    case 0x0076:
      script.debug('[SCRIPT] Show FBP picture');
      ending.setEffectSprite(0);
      yield ending.showFBP(sc.operand[0], sc.operand[1]);
      break;
    case 0x0077:
      script.debug('[SCRIPT] Stop current playing music');
      // WARNING TODO
      // yield music.play(0, false, (sc.operand[0] == 0) ? 2.0 : sc.operand[0] * 2);
      Global.musicNum = 0;
      break;
    case 0x0078:
      script.debug('[SCRIPT] unknown 0x0078')
      // FIXME: ???
      // throw 'unknown';
      break;
    case 0x0079:
      script.debug('[SCRIPT] Jump if the specified player is in the party');
      for (i = 0; i <= Global.maxPartyMemberIndex; i++) {
        if (GameData.playerRoles.name[Global.party[i].playerRole] === sc.operand[0]){
          scriptEntry = sc.operand[1] - 1;
          break;
        }
      }
      break;
    case 0x007A:
      script.debug('[SCRIPT] Walk the party to the specified position, at a higher speed');
      yield script.partyWalkTo(sc.operand[0], sc.operand[1], sc.operand[2], 4);
      break;
    case 0x007B:
      script.debug('[SCRIPT] Walk the party to the specified position, at the highest speed');
      yield script.partyWalkTo(sc.operand[0], sc.operand[1], sc.operand[2], 8);
      break;
    case 0x007C:
      script.debug('[SCRIPT] Walk straight to the specified position');
      if ((eventObjectID & 1) ^ (Global.frameNum & 1)) {
        var ret = script.NPCWalkTo(eventObjectID, sc.operand[0], sc.operand[1], sc.operand[2], 4);
        if (!ret){
          scriptEntry--;
        }
      } else {
        scriptEntry--;
      }
      break;
    case 0x007D:
      script.debug('[SCRIPT] Move the event object');
      current.x += SHORT(sc.operand[1]);
      current.y += SHORT(sc.operand[2]);
      break;
    case 0x007E:
      script.debug('[SCRIPT] Set the layer of event object');
      current.layer = SHORT(sc.operand[1]);
      break;
    case 0x007F:
      script.debug('[SCRIPT] Move the viewport');
      if (sc.operand[0] === 0 && sc.operand[1] === 0) {
        // Move the viewport back to normal state
        x = Global.party[0].x - 160;
        y = Global.party[0].y - 112;
        Global.viewport = PAL_XY(PAL_X(Global.viewport) + x, PAL_Y(Global.viewport) + y);
        Global.partyOffset = PAL_XY(160, 112);
        for (i = 0; i <= Global.maxPartyMemberIndex; i++) {
          Global.party[i].x -= x;
          Global.party[i].y -= y;
        }
        if (sc.operand[2] !== 0xFFFF) {
          yield scene.makeScene();
          surface.updateScreen(null);
        }
      } else {
        i = 0;
        x = SHORT(sc.operand[0]);
        y = SHORT(sc.operand[1]);
        do {
          if (sc.operand[2] === 0xFFFF) {
            x = PAL_X(Global.viewport);
            y = PAL_Y(Global.viewport);
            Global.viewport = PAL_XY(sc.operand[0] * 32 - 160, sc.operand[1] * 16 - 112);
            x -= PAL_X(Global.viewport);
            y -= PAL_Y(Global.viewport);
            for (j = 0; j <= Global.maxPartyMemberIndex; j++) {
              Global.party[j].x += x;
              Global.party[j].y += y;
            }
            // WARNING 这里sdlpal里没有跳出，那岂不是死循环了？
            //break;
          } else {
            Global.viewport = PAL_XY(PAL_X(Global.viewport) + x, PAL_Y(Global.viewport) + y);
            Global.partyOffset = PAL_XY(PAL_X(Global.partyOffset) - x, PAL_Y(Global.partyOffset) - y);
            for (j = 0; j <= Global.maxPartyMemberIndex; j++) {
               Global.party[j].x -= x;
               Global.party[j].y -= y;
            }
          }
          if (sc.operand[2] !== 0xFFFF){
            yield play.update(false);
          }

          yield scene.makeScene();
          surface.updateScreen(null);

          // Delay for one frame
          yield sleepByFrame(1);
        } while (++i < SHORT(sc.operand[2]));
      }
      break;
    case 0x0080:
      script.debug('[SCRIPT] Toggle day/night palette');
      Global.nightPalette = !Global.nightPalette;
      yield surface.paletteFade(Global.numPalette, Global.nightPalette, !sc.operand[0]);
      break;
    case 0x0081:
      script.debug('[SCRIPT] Jump if the player is not facing the specified event object');
      if (sc.operand[0] <= GameData.scene[Global.numScene - 1].eventObjectIndex
          || sc.operand[0] > GameData.scene[Global.numScene].eventObjectIndex) {
         // The event object is not in the current scene
         scriptEntry = sc.operand[2] - 1;
         script.scriptSuccess = false;
         break;
      }
      x = current.x;
      y = current.y;
      x += ((Global.partyDirection == Direction.West || Global.partyDirection == Direction.South) ? 16 : -16);
      y += ((Global.partyDirection == Direction.West || Global.partyDirection == Direction.North) ? 8 : -8);
      x -= PAL_X(Global.viewport) + PAL_X(Global.partyOffset);
      y -= PAL_Y(Global.viewport) + PAL_Y(Global.partyOffset);
      if (abs(x) + abs(y * 2) < sc.operand[1] * 32 + 16) {
        if (sc.operand[1] > 0) {
          // Change the trigger mode so that the object can be triggered in next frame
          current.triggerMode = TriggerMode.TouchNormal + sc.operand[1];
        }
      } else {
        scriptEntry = sc.operand[2] - 1;
        script.scriptSuccess = false;
      }
      break;
    case 0x0082:
      script.debug('[SCRIPT] Walk straight to the specified position, at a high speed');
      var ret = script.NPCWalkTo(eventObjectID, sc.operand[0], sc.operand[1], sc.operand[2], 8);
      if (!ret) scriptEntry--;
      break;
    case 0x0083:
      script.debug('[SCRIPT] Jump if event object is not in the specified zone of the current event object');
      if (sc.operand[0] <= GameData.scene[Global.numScene - 1].eventObjectIndex
          || sc.operand[0] > GameData.scene[Global.numScene].eventObjectIndex) {
        // The event object is not in the current scene
        scriptEntry = sc.operand[2] - 1;
        script.scriptSuccess = false;
        break;
      }
      x = evtObj.x - current.x;
      y = evtObj.y - current.y;
      if (abs(x) + abs(y * 2) >= sc.operand[1] * 32 + 16) {
         scriptEntry = sc.operand[2] - 1;
         script.scriptSuccess = false;
      }
      break;
    case 0x0084:
      script.debug('[SCRIPT] Place the item which player used as an event object to the scene');
      if (sc.operand[0] <= GameData.scene[Global.numScene - 1].eventObjectIndex
          || sc.operand[0] > GameData.scene[Global.numScene].eventObjectIndex) {
        // The event object is not in the current scene
        scriptEntry = sc.operand[2] - 1;
        script.scriptSuccess = false;
        break;
      }
      x = PAL_X(Global.viewport) + PAL_X(Global.partyOffset);
      y = PAL_Y(Global.viewport) + PAL_Y(Global.partyOffset);
      x += ((Global.partyDirection == Direction.West || Global.partyDirection == Direction.South) ? -16 : 16);
      y += ((Global.partyDirection == Direction.West || Global.partyDirection == Direction.North) ? -8 : 8);
      if (scene.checkObstacle(PAL_XY(x, y), false, 0)) {
        scriptEntry = sc.operand[2] - 1;
        script.scriptSuccess = false;
      } else {
        current.x = x;
        current.y = y;
        current.state = SHORT(sc.operand[1]);
      }
      break;
    case 0x0085:
      script.debug('[SCRIPT] Delay for a period');
      yield sleep(sc.operand[0] * 80); // WARNING param normalize
      break;
    case 0x0086:
      script.debug('[SCRIPT] Jump if the specified item is not equipped');
      y = false;
      for (i = 0; i <= Global.maxPartyMemberIndex; i++) {
        w = Global.party[i].playerRole;
        for (x = 0; x < Const.MAX_PLAYER_EQUIPMENTS; x++) {
          if (GameData.playerRoles.equipment[x][w] == sc.operand[0]) {
            y = true;
            i = 999;
            break;
          }
        }
      }
      if (!y) {
        scriptEntry = sc.operand[2] - 1;
      }
      break;
    case 0x0087:
      script.debug('[SCRIPT] Animate the event object');
      script.NPCWalkOneStep(curEventObjectID, 0);
      break;
    case 0x0088:
      script.debug('[SCRIPT] Set the base damage of magic according to amount of money'); // 扔钱。。
      i = ((Global.cash > 5000) ? 5000 : Global.cash);
      Global.cash -= i;
      j = GameData.object[sc.operand[0]].magic.magicNumber;
      GameData.magic[j].baseDamage = ~~(i * 2 / 5);
      break;
    case 0x0089:
      script.debug('[SCRIPT] Set the battle result');
      Global.battle.battleResult = sc.operand[0];
      break;
    case 0x008A:
      script.debug('[SCRIPT] Enable Auto-Battle for next battle');
      Global.autoBattle = true;
      break;
    case 0x008B:
      script.debug('[SCRIPT] change the current palette');
      Global.numPalette = sc.operand[0];
      if (!Global.needToFadeIn) {
        var palette = Palette.get(Global.numPalette, false);
        surface.setPalette(palette);
      }
      break;
    case 0x008C:
      script.debug('[SCRIPT] Fade from/to color');
      yield surface.colorFade(sc.operand[1], sc.operand[0], sc.operand[2]); // WARNING param normalize
      Global.needToFadeIn = false;
      break;
    case 0x008D:
      script.debug('[SCRIPT] Increase player\'s level');
      script.playerLevelUp(eventObjectID, sc.operand[0]);
      break;
    case 0x008F:
      script.debug('[SCRIPT] Halve the cash amount');
      Global.cash = ~~(Global.cash / 2);
      break;
    case 0x0090:
      script.debug('[SCRIPT] Set the object script');
      // WARNING 偏移量不一定对
      GameData.object[sc.operand[0]].data[2 + sc.operand[2]] = sc.operand[1];
      break;
    case 0x0091:
      script.debug('[SCRIPT] Jump if the enemy is not alone');
      if (Global.inBattle) {
        for (i = 0; i <= battle.maxEnemyIndex; i++) {
          if (i != eventObjectID && Global.battle.enemy[i].objectID === Global.battle.enemy[eventObjectID].objectID) {
            scriptEntry = sc.operand[0] - 1;
            break;
          }
        }
      }
      break;
    case 0x0092:
      script.debug('[SCRIPT] Show a magic-casting animation for a player in battle');
      if (Global.inBattle) {
        if (sc.operand[0] !== 0) {
          yield battle.battleShowPlayerPreMagicAnim(sc.operand[0] - 1, false);
          Global.battle.player[sc.operand[0] - 1].currentFrameNum = 6;
        }

        for (i = 0; i < 5; i++) {
          for (j = 0; j <= Global.maxPartyMemberIndex; j++) {
            Global.battle.player[j].colorShift = i * 2;
          }
          yield battle.delay(1, 0, true); // WARNING param normalize
        }
        battle.backupScreen();
        battle.updateFighters();
        battle.makeScene();
        yield battle.fadeScene();
      }
      break;
    case 0x0093:
      script.debug('[SCRIPT] Fade the screen. Update scene in the process.');
      var time = SHORT(sc.operand[0]);
      yield surface.fadeIn(Global.numPalette, Global.nightPalette, (time > 0 ? time : 1));
      Global.needToFadeIn = (SHORT(sc.operand[0]) < 0);
      break;
    case 0x0094:
      script.debug('[SCRIPT] Jump if the state of event object is the specified one');
      if (current.state === sc.operand[1]) {
         scriptEntry = sc.operand[2] - 1;
      }
      break;
    case 0x0095:
      script.debug('[SCRIPT] Jump if the current scene is the specified one');
      if (Global.numScene === SHORT(sc.operand[0])) {
        scriptEntry = sc.operand[1] - 1;
      }
      break;
    case 0x0096:
      script.debug('[SCRIPT] Show the ending animation');
      yield ending.endingAnimation();
      break;
    case 0x0097:
      script.debug('[SCRIPT] Ride the event object to the specified position, at a higher speed');
      yield script.partyRideEventObject(eventObjectID, sc.operand[0], sc.operand[1], sc.operand[2], 8)
      break;
    case 0x0098:
      script.debug('[SCRIPT] Set follower of the party');
      if (sc.operand[0] > 0) {
        Global.numFollower = 1;
        Global.party[Global.maxPartyMemberIndex + 1].playerRole = sc.operand[0];
        res.setLoadFlags(LoadFlag.PlayerSprite);
        yield res.loadResources();
        // Update the position and gesture for the follower
        Global.party[Global.maxPartyMemberIndex + 1].x = Global.trail[3].x - PAL_X(Global.viewport);
        Global.party[Global.maxPartyMemberIndex + 1].y = Global.trail[3].y - PAL_Y(Global.viewport);
        Global.party[Global.maxPartyMemberIndex + 1].frame = Global.trail[3].direction * 3;
      } else {
        Global.numFollower = 0;
      }
      break;
    case 0x0099:
      script.debug('[SCRIPT] Change the map for the specified scene');
      if (sc.operand[0] == 0xFFFF) {
        GameData.scene[Global.numScene - 1].mapNum = sc.operand[1];
        res.setLoadFlags(LoadFlag.Scene);
        yield res.loadResources();
      } else {
        GameData.scene[sc.operand[0] - 1].mapNum = sc.operand[1];
      }
      break;
    case 0x009A:
      script.debug('[SCRIPT] Set the state for multiple event objects');
      for (i = sc.operand[0]; i <= sc.operand[1]; i++) {
        GameData.eventObject[i - 1].state = sc.operand[2];
      }
      break;
    case 0x009B:
      script.debug('[SCRIPT] Fade to the current scene');
      // FIXME: This is obviously wrong
      surface.backupScreen();
      yield scene.makeScene();
      yield surface.fadeScreen(2);
      break;
    case 0x009C:
      script.debug('[SCRIPT] Enemy duplicate itself');
      w = 0;
      for (i = 0; i <= Global.battle.maxEnemyIndex; i++) {
        if (Global.battle.enemy[i].objectID != 0) {
          w++;
        }
      }
      if (w !== 1) {
        // Duplication is only possible when only 1 enemy left
        if (sc.operand[1] !== 0) {
          scriptEntry = sc.operand[1] - 1;
        }
        break;
      }
      w = sc.operand[0];
      if (w === 0) {
        w = 1;
      }
      for (i = 0; i <= Global.battle.maxEnemyIndex; i++) {
        if (w > 0 && Global.battle.enemy[i].objectID == 0) {
          w--;
          //memset(&(battle.enemy[i]), 0, sizeof(BATTLEENEMY));
          //battle.resetEnemy(i);

          Global.battle.enemy[i].reset();
          Global.battle.enemy[i].objectID = Global.battle.enemy[eventObjectID].objectID;
          Global.battle.enemy[i].e = Global.battle.enemy[eventObjectID].e.copy();
          Global.battle.enemy[i].scriptOnTurnStart = Global.battle.enemy[eventObjectID].scriptOnTurnStart;
          Global.battle.enemy[i].scriptOnBattleEnd = Global.battle.enemy[eventObjectID].scriptOnBattleEnd;
          Global.battle.enemy[i].scriptOnReady = Global.battle.enemy[eventObjectID].scriptOnReady;
          Global.battle.enemy[i].state = FighterState.Wait;
          Global.battle.enemy[i].timerMeter = 50;
          Global.battle.enemy[i].colorShift = 0;
        }
      }
      battle.loadBattleSprites();
      for (i = 0; i <= Global.battle.maxEnemyIndex; i++) {
        if (Global.battle.enemy[i].objectID === 0) {
          continue;
        }
        Global.battle.enemy[i].pos = Global.battle.enemy[eventObjectID].pos;
      }
      for (i = 0; i < 10; i++) {
        for (j = 0; j <= Global.battle.maxEnemyIndex; j++) {
          x = floor((PAL_X(Global.battle.enemy[j].pos) + PAL_X(Global.battle.enemy[j].originalPos)) / 2);
          y = floor((PAL_Y(Global.battle.enemy[j].pos) + PAL_Y(Global.battle.enemy[j].originalPos)) / 2);
          Global.battle.enemy[j].pos = PAL_XY(x, y);
        }
        yield battle.delay(1, 0, true);
      }
      battle.updateFighters();
      yield battle.delay(1, 0, true);
      break;
    case 0x009E:
      script.debug('[SCRIPT] Enemy summons another monster');
      x = 0;
      w = sc.operand[0];
      y = (SHORT(sc.operand[1]) <= 0 ? 1 : SHORT(sc.operand[1]));
      if (w === 0 || w === 0xFFFF) {
        w = Global.battle.enemy[eventObjectID].objectID;
      }
      for (i = 0; i <= Global.battle.maxEnemyIndex; i++) {
        if (Global.battle.enemy[i].objectID == 0){
          x++;
        }
      }
      if (x < y || Global.battle.hidingTime > 0 ||
          Global.battle.enemy[eventObjectID].status[PlayerStatus.Sleep] !== 0 ||
          Global.battle.enemy[eventObjectID].status[PlayerStatus.Paralyzed] !== 0 ||
          Global.battle.enemy[eventObjectID].status[PlayerStatus.Confused] !== 0) {
        if (sc.operand[2] != 0) {
          scriptEntry = sc.operand[2] - 1;
        }
      } else {
        for (i = 0; i <= Global.battle.maxEnemyIndex; i++) {
          if (Global.battle.enemy[i].objectID === 0){
            //battle.resetEnemy(i);
            //memset(battle.enemy[i].uint8Array, 0, battle.enemy[i].uint8Array.length);

            Global.battle.enemy[i].reset();
            Global.battle.enemy[i].objectID = w;
            Global.battle.enemy[i].e = GameData.enemy[GameData.object[w].enemy.enemyID].copy();

            Global.battle.enemy[i].state = FighterState.Wait;
            Global.battle.enemy[i].scriptOnTurnStart = GameData.object[w].enemy.scriptOnTurnStart;
            Global.battle.enemy[i].scriptOnBattleEnd = GameData.object[w].enemy.scriptOnBattleEnd;
            Global.battle.enemy[i].scriptOnReady = GameData.object[w].enemy.scriptOnReady;
            Global.battle.enemy[i].timerMeter = 50;
            Global.battle.enemy[i].colorShift = 8;
            y--;
            if (y <= 0) {
              break;
            }
          }
        }
        yield battle.delay(2, 0, true);
        battle.backupScene();
        battle.loadBattleSprites();
        battle.makeScene();
        sound.play(212);
        yield battle.fadeScene();

        for (i = 0; i <= Global.battle.maxEnemyIndex; i++) {
          Global.battle.enemy[i].colorShift = 0;
        }

        battle.backupScene();
        battle.makeScene();
        yield battle.fadeScene();
      }
      break;
    case 0x009F:
      script.debug('[SCRIPT] Enemy transforms into something else');
      if (Global.battle.hidingTime <= 0 &&
          Global.battle.enemy[eventObjectID].status[PlayerStatus.Sleep] === 0 &&
          Global.battle.enemy[eventObjectID].status[PlayerStatus.Paralyzed] === 0 &&
          Global.battle.enemy[eventObjectID].status[PlayerStatus.Confused] === 0){
        w = Global.battle.enemy[eventObjectID].e.health;
        Global.battle.enemy[eventObjectID].objectID = sc.operand[0];
        Global.battle.enemy[eventObjectID].e = GameData.enemy[GameData.object[sc.operand[0]].enemy.enemyID];
        Global.battle.enemy[eventObjectID].e.health = w;
        Global.battle.enemy[eventObjectID].wCurrentFrame = 0;
        for (i = 0; i < 6; i++) {
          Global.battle.enemy[eventObjectID].colorShift = i;
          yield battle.delay(1, 0, false); // WARNING param normalize
        }
        Global.battle.enemy[eventObjectID].colorShift = 0;

        battle.backupScene();
        battle.loadBattleSprites();
        battle.makeScene();
        yield battle.fadeScene();
      }
      break;
    case 0x00A0:
      script.debug('[SCRIPT] Quit game');
      //yield script.additionalCredits();
      return game.shutdown();
      break;
    case 0x00A1:
      script.debug('[SCRIPT] Set the positions of all party members to the same as the first one');
      for (i = 0; i < Const.MAX_PLAYABLE_PLAYER_ROLES; i++) {
        Global.trail[i].direction = Global.partyDirection;
        Global.trail[i].x = Global.party[0].x + PAL_X(Global.viewport);
        Global.trail[i].y = Global.party[0].y + PAL_Y(Global.viewport);
      }
      for (i = 1; i <= Global.maxPartyMemberIndex; i++) {
        Global.party[i].x = Global.party[0].x;
        Global.party[i].y = Global.party[0].y - 1;
      }
      scene.updatePartyGestures(false);
      break;
    case 0x00A2:
      script.debug('[SCRIPT] Jump to one of the following instructions randomly');
      scriptEntry += randomLong(0, sc.operand[0] - 1);
      break;
    case 0x00A3:
      script.debug('[SCRIPT] Play CD music. Use the RIX music for fallback.');
      //var ret = yield sound.playCDA(sc.operand[0]);
      //yield music.play(sc.operand[1], true, 0);
      break;
    case 0x00A4:
      script.debug('[SCRIPT] Scroll FBP to the screen');
      if (sc.operand[0] == 0x44) {
        // 68号位图 拜月魔兽
        // 69号位图 洪水
        // HACKHACK: to make the ending picture show correctly
        yield ending.showFBP(0x45, 0);
        yield ending.scrollFBP(sc.operand[0], sc.operand[2], true);
      } else {
        yield ending.scrollFBP(sc.operand[0], sc.operand[2], sc.operand[1]);
      }
      break;
    case 0x00A5:
      script.debug('[SCRIPT] Show FBP picture with sprite effects');
      if (sc.operand[1] != 0xFFFF) {
        ending.setEffectSprite(sc.operand[1]);
      }
      yield ending.showFBP(sc.operand[0], sc.operand[2]);
      break;
    case 0x00A6:
      script.debug('[SCRIPT] backup screen');
      surface.backupScreen();
      break;
    default:
      game.error('[SCRIPT] Invalid Instruction at %d: (%d(%.4x) - %.4x, %.4x, %.4x)',
        scriptEntry, sc.operation, sc.operation,
        sc.operand[0], sc.operand[1], sc.operand[2]
      );
      break;
  }

  return scriptEntry + 1;
};

/**
 * Runs a trigger script.
 *
 * @param {Number} scriptEntry   The script entry to execute.
 * @param {Number} eventObjectID The event object ID which invoked the script.
 * @yield {Number} The entry point of the script.
 */
script.runTriggerScript = function*(scriptEntry, eventObjectID) {
  var lastEventObjectID = 0,
      nextScriptEntry = scriptEntry,
      ended = false,
      sc,
      //evtObj = Global.EventObjecs[eventObjectID - 1],
      evtObj = null;
  var i;

  var updatedInBattle = false; // HACKHACK

  if (eventObjectID == 0xFFFF) {
    eventObjectID = lastEventObjectID;
  }

  lastEventObjectID = eventObjectID;

  if (eventObjectID != 0) {
    // WARNING TODO 这里有个为空的问题，在求雨情节完成时
    evtObj = GameData.eventObject[eventObjectID - 1];
  }
  script.scriptSuccess = true;

  // Set the default dialog speed.
  ui.setDialogDelayTime(3);

  while (scriptEntry !== 0 && !ended) {
    sc = GameData.scriptEntry[scriptEntry];

    log.trace('[SCRIPT] runTriggerScript %d: (%d(0x%.4x) - %d, %d, %d)',
      scriptEntry, sc.operation, sc.operation,
      sc.operand[0], sc.operand[1],
      sc.operand[2], sc.operand[3]
    );

    switch (sc.operation) {
      case 0x0000:
        //script.debug('[SCRIPT] Stop running');
        ended = true;
        break;
      case 0x0001:
        //script.debug('[SCRIPT] Stop running and replace the entry with the next line');
        ended = true;
        nextScriptEntry = scriptEntry + 1;
        break;
      case 0x0002:
        //script.debug('[SCRIPT] Stop running and replace the entry with the specified one');
        if (!evtObj) {
          //debugger;
        }
        evtObj.scriptIdleFrame++;
        if (sc.operand[1] === 0 || evtObj.scriptIdleFrame < sc.operand[1]) {
          ended = true;
          nextScriptEntry = sc.operand[0];
        } else {
          // failed
          evtObj.scriptIdleFrame = 0;
          scriptEntry++;
        }
        break;
      case 0x0003:
        script.debug('[SCRIPT] unconditional jump');
        try {
          if (sc.operand[1] === 0 || ++(evtObj.scriptIdleFrame) < sc.operand[1]) {
            scriptEntry = sc.operand[0];
          } else {
            // failed
            evtObj.scriptIdleFrame = 0;
            scriptEntry++;
          }
        } catch (ex) {
          // WARNING TODO 求雨情节剧情完了以后，这里会有一个evtObj为null的问题，不知道是从哪引进来的
          //debugger;
          scriptEntry++;
        }
        break;
      case 0x0004:
        script.debug('[SCRIPT] Call script');
        yield script.runTriggerScript(sc.operand[0], ((sc.operand[1] == 0) ? eventObjectID : sc.operand[1]));
        scriptEntry++;
        break;
      case 0x0005:
        script.debug('[SCRIPT] Redraw screen');
        yield ui.clearDialog(true);

        if (false && ui.dialogIsPlayingRNG()) {
          // WARNING TODO
          surface.restoreScreen();
        } else if (Global.inBattle) {
          // WARNING TODO
          battle.makeScene();
          surface.blit(Global.battle.sceneBuf);
          surface.updateScreen(null);
        } else {
          if (sc.operand[2]){
             scene.updatePartyGestures(false);
          }

          yield scene.makeScene();
          surface.updateScreen(null);

          yield sleep((sc.operand[1] === 0) ? 60 : (sc.operand[1] * 60))
        }
        scriptEntry++;
        break;
      case 0x0006:
        script.debug('[SCRIPT] Jump to the specified address by the specified rate', sc.operand.join(','));
        if (randomLong(1, 100) >= sc.operand[0]) {
          scriptEntry = sc.operand[1];
          continue;
        } else {
          scriptEntry++;
        }
        break;
      case 0x0007:
        script.debug('[SCRIPT] Start battle');
        var ret = yield battle.start(sc.operand[0], !sc.operand[2]);

        if (ret == BattleResult.Lost && sc.operand[1] != 0) {
          scriptEntry = sc.operand[1];
        } else if (ret == BattleResult.Fleed && sc.operand[2] != 0) {
          scriptEntry = sc.operand[2];
        } else {
          scriptEntry++;
        }
        Global.autoBattle = false;
        break;
      case 0x0008:
        script.debug('[SCRIPT] Replace the entry with the next instruction');
        scriptEntry++;
        nextScriptEntry = scriptEntry;
        break;
      case 0x0009:
        script.debug('[SCRIPT] wait for the specified number of frames');
        yield ui.clearDialog(true);
        var len = sc.operand[0] ? sc.operand[0] : 1;
        for (i = 0; i < len; i++){
          if (sc.operand[2]) {
            scene.updatePartyGestures(false);
          }

          yield play.update(sc.operand[1] ? true : false);
          yield scene.makeScene();
          surface.updateScreen(null);

          yield sleepByFrame(1);
        }
        scriptEntry++;
        break;
      case 0x000A:
        script.debug('[SCRIPT] Goto the specified address if player selected no');
        yield ui.clearDialog(false);
        var ret = yield uigame.confirmMenu();
        if (!ret) {
          scriptEntry = sc.operand[0];
        } else {
          scriptEntry++;
        }
        break;
      case 0x003B:
        script.debug('[SCRIPT] Show dialog in the middle part of the screen');
        yield ui.clearDialog(true);
        ui.startDialog(DialogPosition.Center, sc.operand[0], 0, sc.operand[2] ? true : false);
        scriptEntry++;
        break;
      case 0x003C:
        script.debug('[SCRIPT] Show dialog in the upper part of the screen');
        yield ui.clearDialog(true);
        ui.startDialog(DialogPosition.Upper, sc.operand[1], sc.operand[0], sc.operand[2] ? true : false);
        scriptEntry++;
        break;
      case 0x003D:
        script.debug('[SCRIPT] Show dialog in the lower part of the screen');
        yield ui.clearDialog(true);
        ui.startDialog(DialogPosition.Lower, sc.operand[1], sc.operand[0], sc.operand[2] ? true : false);
        scriptEntry++;
        break;
      case 0x003E:
        script.debug('[SCRIPT] Show text in a window at the center of the screen');
        yield ui.clearDialog(true);
        ui.startDialog(DialogPosition.CenterWindow, sc.operand[0], 0, false);
        scriptEntry++;
        break;
      case 0x008E:
        script.debug('[SCRIPT] Restore the screen');
        yield ui.clearDialog(true);
        surface.restoreScreen();
        surface.updateScreen(null);
        scriptEntry++;
        break;
      case 0xFFFF:
        script.debug('[SCRIPT] Print dialog text');
        var msg = ui.getMsg(sc.operand[0]);
        yield ui.showDialogText(msg);
        scriptEntry++;
        break;
      default:
        yield ui.clearDialog(true);
        scriptEntry = yield script.interpretInstruction(scriptEntry, eventObjectID);
        break;
    }

    //yield sleep(FrameTime);
  };

  yield ui.endDialog();
  script.curEquipPart = -1;

  return nextScriptEntry;
};

script.runAutoScript = function*(scriptEntry, eventObjectID) {
  var sc = GameData.scriptEntry[scriptEntry];
  var evtObj = GameData.eventObject[eventObjectID - 1];

  traceScript(scriptEntry, sc, eventObjectID);

  log.trace('[SCRIPT] runAutoScript %d: (%d(0x%.4x) - %d, %d, %d)',
    scriptEntry, sc.operation, sc.operation,
    sc.operand[0], sc.operand[1],
    sc.operand[2], sc.operand[3]
  );

  // For autoscript, we should interpret one instruction per frame (except
  // jumping) and save the address of next instruction.
  switch (sc.operation) {
    case 0x0000:
      script.debug('[SCRIPT] Stop running');
      break;
    case 0x0001:
      script.debug('[SCRIPT] Stop running and replace the entry with the next line');
      scriptEntry++;
      break;
    case 0x0002:
      script.debug('[SCRIPT] Stop running and replace the entry with the specified one');
      if (sc.operand[1] === 0 || (++evtObj.scriptIdleFrameCountAuto) < sc.operand[1]) {
        scriptEntry = sc.operand[0];
      } else {
        evtObj.scriptIdleFrameCountAuto = 0;
        scriptEntry++;
      }
      break;
    case 0x0003:
      script.debug('[SCRIPT] unconditional jump');
      if (sc.operand[1] === 0 || (++evtObj.scriptIdleFrameCountAuto) < sc.operand[1]) {
        scriptEntry = sc.operand[0];
        //goto begin
        return yield script.runAutoScript(scriptEntry, eventObjectID);
      } else {
        evtObj.scriptIdleFrameCountAuto = 0;
        scriptEntry++;
      }
      break;
    case 0x0004:
      script.debug('[SCRIPT] Call subroutine');
      yield script.runTriggerScript(sc.operand[0], sc.operand[1] ? sc.operand[1] : eventObjectID);
      scriptEntry++;
      break;
    case 0x0006:
      script.debug('[SCRIPT] jump to the specified address by the specified rate');
      if (randomLong(1, 100) >= sc.operand[0] && sc.operand[1] != 0) {
        scriptEntry = sc.operand[1];
        //goto begin;
        return yield script.runAutoScript(scriptEntry, eventObjectID);
      } else {
        scriptEntry++;
      }
      break;
    case 0x0009:
      script.debug('[SCRIPT] Wait for a certain number of frames');
      if ((++evtObj.scriptIdleFrameCountAuto) >= sc.operand[0]) {
         // waiting ended; go further
         evtObj.scriptIdleFrameCountAuto = 0;
         scriptEntry++;
      }
      break;
    case 0xFFFF:
      scriptEntry++;
      break;
    default:
      //// Other operations
      scriptEntry = yield script.interpretInstruction(scriptEntry, eventObjectID);
      break;
  }

  return scriptEntry;
};

export default script;

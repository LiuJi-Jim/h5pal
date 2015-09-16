import scene from './scene';
import input from './input';
import script from './script';
import battle from './battle';
import ending from './ending';

log.trace('play module load');

var play = {};

var surface = null;
var abs = Math.abs;

play.init = function*(surf) {
  log.debug('[PLAY] init');
  global.play = play;
  surface = surf;
  yield script.init(surf);
  yield battle.init(surf);
  yield ending.init(surf);
};

/**
 * The main game logic routine. Update the status of everything.
 *
 * @param {Boolean} trigger       whether to process trigger events or not.
 */
play.update = function*(trigger) {
  // Check for trigger events
  if (trigger){
    // Check if we are entering a new scene
    if (Global.enteringScene) {
      // Run the script for entering the scene
      Global.enteringScene = false;

      var i = Global.numScene - 1;
      var sc = GameData.scene[i];
      sc.scriptOnEnter = yield script.runTriggerScript(sc.scriptOnEnter, 0xFFFF);

      if (Global.enteringScene || Global.gameStart) {
        // Don't go further as we're switching to another scene
        return;
      }
      input.clear();
      yield scene.makeScene();
    }

    // Update the vanish time for all event objects
    var eventObjects = GameData.eventObject;
    for (var i = 0; i < eventObjects.length; ++i) {
      var p = eventObjects[i];
      if (p.vanishTime !== 0) {
        p.vanishTime += ((p.vanishTime < 0) ? 1 : -1);
      }
    }

    // Loop through all event objects in the current scene
    for (var eventObjectID = GameData.scene[Global.numScene - 1].eventObjectIndex + 1;
         eventObjectID <= GameData.scene[Global.numScene].eventObjectIndex;
         ++eventObjectID) {
      var p = GameData.eventObject[eventObjectID - 1];

      if (p.vanishTime !== 0){
        continue;
      }

      if (p.state < 0) {
        if (p.x < PAL_X(Global.viewport) ||
            p.x > PAL_X(Global.viewport) + 320 ||
            p.y < PAL_Y(Global.viewport) ||
            p.y > PAL_Y(Global.viewport) + 320){
          p.state = abs(p.state);
          p.currentFrameNum = 0;
        }
      } else if (p.state > 0 && p.triggerMode >= TriggerMode.TouchNear) {
        // This event object can be triggered without manually exploring
        if (abs(PAL_X(Global.viewport) + PAL_X(Global.partyOffset) - p.x) +
            abs(PAL_Y(Global.viewport) + PAL_Y(Global.partyOffset) - p.y) * 2
            < (p.triggerMode - TriggerMode.TouchNear) * 32 + 16) {
          // Player is in the trigger zone.
          if (p.spriteFrames) {
            // The sprite has multiple frames. Try to adjust the direction.
            p.currentFrameNum = 0;

            var xOffset = PAL_X(Global.viewport) + PAL_X(Global.partyOffset) - p.x;
            var yOffset = PAL_Y(Global.viewport) + PAL_Y(Global.partyOffset) - p.y;

            if (xOffset > 0) {
              p.direction = (yOffset > 0 ? Direction.East : Direction.North);
            } else {
              p.direction = (yOffset > 0 ? Direction.South : Direction.West);
            }

            // Redraw the scene
            scene.updatePartyGestures(false);

            yield scene.makeScene();
            surface.updateScreen(null);
          }

          // Execute the script.
          p.triggerScript = yield script.runTriggerScript(p.triggerScript, eventObjectID);

          input.clear();

          if (Global.enteringScene || Global.gameStart) {
            // Don't go further on scene switching
            return;
          }
        }
      }
    }
  }

  // Run autoScript for each event objects
  for (var eventObjectID = GameData.scene[Global.numScene - 1].eventObjectIndex + 1;
       eventObjectID <= GameData.scene[Global.numScene].eventObjectIndex;
       ++eventObjectID) {
    var p = GameData.eventObject[eventObjectID - 1];

    if (p.state > 0 && p.vanishTime === 0) {
      var scriptEntry = p.autoScript;
      if (scriptEntry !== 0) {
        p.autoScript = yield script.runAutoScript(scriptEntry, eventObjectID);
        if (Global.enteringScene || Global.gameStart) {
          // Don't go further on scene switching
          return;
        }
      }
    }

    // Check if the player is in the way
    if (trigger && p.state >= ObjectState.Blocker && p.spriteNum !== 0 &&
        abs(p.x - PAL_X(Global.viewport) - PAL_X(Global.partyOffset)) +
        abs(p.y - PAL_Y(Global.viewport) - PAL_Y(Global.partyOffset)) * 2 <= 12) {
      // Player is in the way, try to move a step
      var dir = (p.direction + 1 % 4);
      for (var i = 0; i < 4; i++) {
        var x = PAL_X(Global.viewport) + PAL_X(Global.partyOffset);
        var y = PAL_Y(Global.viewport) + PAL_Y(Global.partyOffset);

        x += ((dir == Direction.West || dir == Direction.South) ? -16 : 16);
        y += ((dir == Direction.West || dir == Direction.North) ? -8 : 8);

        var pos = PAL_XY(x, y);

        if (!scene.checkObstacle(pos, true, 0)) {
          // move here
          Global.viewport = PAL_XY(
            PAL_X(pos) - PAL_X(Global.partyOffset),
            PAL_Y(pos) - PAL_Y(Global.partyOffset)
          );

          break;
        }

        dir = (dir + 1) % 4;
      }
    }
  }

  Global.frameNum++;
};

/**
 * Allow player use an item in the game.
 */
play.useItem = function*() {
  while (true){
    var object = yield itemmenu.itemSelectMenu(null, ItemFlag.Usable);

    if (object === 0) {
      return;
    }

    if (!(GameData.object[object].item.flags & ItemFlag.ApplyToAll)) {
      // Select the player to use the item on
      while (true) {
        var player = yield uigame.itemUseMenu(object);

        if (player == ui.MENUITEM_VALUE_CANCELLED) {
          break;
        }
        // Run the script
        GameData.object[object].item.scriptOnUse = yield script.runTriggerScript(GameData.object[object].item.scriptOnUse, player);
        // Remove the item if the item is consuming and the script succeeded
        if ((GameData.object[object].item.flags & ItemFlag.Consuming) && script.scriptSuccess) {
          script.addItemToInventory(object, -1);
        }
      }
    } else {
      // Run the script
      GameData.object[object].item.scriptOnUse = yield script.runTriggerScript(GameData.object[object].item.scriptOnUse, 0xFFFF);

      // Remove the item if the item is consuming and the script succeeded
      if ((GameData.object[object].item.flags & ItemFlag.Consuming) && script.scriptSuccess) {
        script.addItemToInventory(object, -1);
      }

      return;
    }
  }
};

/**
 * Allow player equip an item in the game.
 */
play.equipItem = function*() {
  while (true) {
    var object = yield itemmenu.itemSelectMenu(null, ItemFlag.Equipable);

    if (object === 0) {
       return;
    }

    yield uigame.equipItemMenu(object);
  }
};

/**
 * Process searching trigger events.
 */
play.search = function*() {
  var x, y, xOffset, yOffset, dx, dy, dh, ex, ey, eh, i, k, l;
  var poses = [];

  // Get the party location
  x = PAL_X(Global.viewport) + PAL_X(Global.partyOffset);
  y = PAL_Y(Global.viewport) + PAL_Y(Global.partyOffset);
  if (Global.partyDirection == Direction.North || Global.partyDirection == Direction.East) {
    xOffset = 16;
  } else {
    xOffset = -16;
  }

  if (Global.partyDirection == Direction.East || Global.partyDirection == Direction.South) {
    yOffset = 8;
  } else {
    yOffset = -8;
  }

  poses[0] = PAL_XY(x, y);

  for (i = 0; i < 4; i++) {
    poses[i * 3 + 1] = PAL_XY(x + xOffset, y + yOffset);
    poses[i * 3 + 2] = PAL_XY(x, y + yOffset * 2);
    poses[i * 3 + 3] = PAL_XY(x + xOffset, y);
    x += xOffset;
    y += yOffset;
  }

  var sc = GameData.scene[Global.numScene - 1];
  var party = Global.party;
  var scenes = GameData.scene;
  for (i = 0; i < 13; i++) {
    // Convert to map location
    dh = ((PAL_X(poses[i]) % 32) ? 1 : 0);
    dx = ~~(PAL_X(poses[i]) / 32);
    dy = ~~(PAL_Y(poses[i]) / 16);

    // Loop through all event objects
    for (k = scenes[Global.numScene - 1].eventObjectIndex;
         k < scenes[Global.numScene].eventObjectIndex; k++){
      p = GameData.eventObject[k];
      ex = ~~(p.x / 32);
      ey = ~~(p.y / 16);
      eh = ((p.x % 32) ? 1 : 0);

      if (p.state <= 0 || p.triggerMode >= TriggerMode.TouchNear ||
          p.triggerMode * 6 - 4 < i || dx != ex || dy != ey || dh != eh) {
        continue;
      }

      // Adjust direction/gesture for party members and the event object
      if (p.spriteFrames * 4 > p.currentFrameNum) {
        p.currentFrameNum = 0; // use standing gesture
        p.direction = (Global.partyDirection + 2) % 4; // face the party

        for (l = 0; l <= Global.maxPartyMemberIndex; l++) {
          // All party members should face the event object
          party[l].frame = Global.partyDirection * 3;
        }

        // Redraw everything
        yield scene.makeScene();
        surface.updateScreen(null);
      }

      // Execute the script
      p.triggerScript = yield script.runTriggerScript(p.triggerScript, k + 1);

      // Clear inputs and delay for a short time
      yield sleep(50); // WARNING param normalize
      input.clear();

      return; // don't go further
    }
  }
  input.clear();
};

/**
 * Starts a video frame. Called once per video frame.
 */
play.startFrame = function*() {
  // Run the game logic of one frame
  yield play.update(true);

  if (Global.enteringScene){
    return;
  }

  // Update the positions and gestures of party members
  scene.updateParty();

  // Update the scene
  yield scene.makeScene();
  surface.updateScreen(null);

  if (input.isKeyPressed(Key.Menu)) {
    // Show the in-game menu
    yield uigame.inGameMenu();
  } else if (input.isKeyPressed(Key.UseItem)) {
    // Show the use item menu
    yield play.useItem();
  } else if (input.isKeyPressed(Key.ThrowItem)) {
    // Show the equipment menu
    yield play.equipItem();
  } else if (input.isKeyPressed(Key.Force)) {
    // Show the magic menu
    yield uigame.inGameMagicMenu();
  } else if (input.isKeyPressed(Key.Status)) {
    // Show the player status
    yield uigame.playerStatus();
  } else if (input.isKeyPressed(Key.Search)) {
    // Process search events
    yield play.search();
  } else if (input.isKeyPressed(Key.Flee)) {
    // Quit Game
    if (yield uigame.confirmMenu()) {
      //music.play(0, false, 2);
      yield surface.fadeOut(2);
      //shutdown();

      //PAL_PlayMUS(0, FALSE, 2);
      //PAL_FadeOut(2);
      //PAL_Shutdown();
      //exit(0);
    }
  }

  Global.chaseSpeedChangeCycles--;
  if (Global.chaseSpeedChangeCycles === 0) {
    Global.chaseRange = 1;
  }
};

export default play;

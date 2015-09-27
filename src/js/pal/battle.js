import utils from './utils';
import scene from './scene';
import ajax from './ajax';
import Sprite from './sprite';
import input from './input';
import script from './script';
import music from './music';
import sound from './sound';
import fight from './fight';
import ui from './ui';
import uibattle from './uibattle';

log.trace('battle module load');

var battle = {
  playerPos: [
    [[240, 170]],                         // one player
    [[200, 176], [256, 152]],             // two players
    [[180, 180], [234, 170], [270, 146]]  // three players
  ]
};

global.BattleResult = {
  Won:        3,      // player won the battle
  Lost:       1,      // player lost the battle
  Fleed:      0xFFFF, // player fleed from the battle
  Terminated: 0,      // battle terminated with scripts
  OnGoing:    1000,   // the battle is ongoing
  PreBattle:  1001,   // running pre-battle scripts
  Pause:      1002    // battle pause
};

global.FighterState = {
 Wait:        0,  // waiting time
 Com:         1,  // accepting command
 Act:         2   // doing the actual move
};

global.BattleActionType = {
  Pass:       0,   // do nothing
  Defend:     1,   // defend
  Attack:     2,   // physical attack
  Magic:      3,   // use magic
  CoopMagic:  4,   // use cooperative magic
  Flee:       5,   // flee from the battle
  ThrowItem:  6,   // throw item onto enemy
  UseItem:    7,   // use item
  AttackMate: 8    // attack teammate (confused only)
};

var BattleAction = battle.BattleAction = function() {
  this.reset();
};
BattleAction.prototype.reset = function(actionType, actionID, target, remainingTime) {
  this.actionType = actionType || BattleActionType.Pass;
  this.actionID = actionID || 0;
  this.target = target || 0;
  this.remainingTime = remainingTime || 0.0;

  return this;
};

var BattleEnemy = battle.BattleEnemy = function() {
  this.reset();
};
BattleEnemy.prototype.reset = function(
  objectID,
  e,
  status,
  timeMeter,
  poisons,
  sprite,
  pos,
  originalPos,
  currentFrame,
  state,
  turnStart,
  firstMoveDone,
  dualMove,
  scriptOnTurnStart,
  scriptOnBattleEnd,
  scriptOnReady,
  prevHP,
  colorShift
  ) {
  this.objectID = objectID || 0;
  this.e = e || null;
  if (this.status) {
    for (var i = 0; i < this.status.length; ++i) {
      this.status[i] = 0;
    }
  } else {
    this.status = status || new Array(PlayerStatus.All);
  }
  this.timeMeter = timeMeter || 0.0;
  if (this.poisons) {
    for (var i = 0; i < this.poisons.length; ++i) {
      memset(this.poisons[i].uint8Array, 0, PoisonStatus.size);
    }
  } else {
    this.poisons = poisons || utils.initArray(PoisonStatus, Const.MAX_POISONS);
  }
  this.sprite = sprite || null;
  this.pos = pos || 0;
  this.originalPos = originalPos || 0;
  this.currentFrame = currentFrame || 0;
  this.state = state || FighterState.Wait;
  this.turnStart = turnStart || false;
  this.firstMoveDone = firstMoveDone || false;
  this.dualMove = dualMove || false;
  this.scriptOnTurnStart = scriptOnTurnStart || 0;
  this.scriptOnBattleEnd = scriptOnBattleEnd || 0;
  this.scriptOnReady = scriptOnReady || 0;
  this.prevHP = prevHP || 0;
  this.colorShift = colorShift || 0;

  return this;
};

var BattlePlayer = battle.BattlePlayer = function() {
  this.reset();
};
BattlePlayer.prototype.reset = function(
  colorShift,
  timeMeter,
  timeSpeedModifier,
  hidingTime,
  sprite,
  pos,
  originalPos,
  currentFrame,
  state,
  action,
  defending,
  prevHP,
  prevMP) {
  this.colorShift = colorShift || 0;
  this.timeMeter = timeMeter || 0.0;
  this.timeSpeedModifier = timeSpeedModifier || 0.0;
  this.hidingTime = hidingTime || 0;
  this.sprite = sprite || 0;
  this.pos = pos || 0;
  this.originalPos = originalPos || 0;
  this.state = state || FighterState.Wait;
  this.action = (this.action ?
                 this.action.reset() :
                 (action || (new BattleAction())));
  this.defending = defending || false;
  this.prevHP = prevHP || 0;
  this.prevMP = prevMP || 0;

  return this;
};

var Summon = battle.Summon = function() {
  this.reset();
};
Summon.prototype.reset = function(currentFrame) {
  this.currentFrame = currentFrame || 0;

  return this;
};

var MAX_BATTLE_ACTIONS = 256;
var MAX_BATTLE_ENEMIES = 256;

global.BattlePhase = {
  SelectAction:  0,
  PerformAction: 1
};

var ActionQueue = battle.ActionQueue = function() {
  this.reset();
};
ActionQueue.prototype.reset = function(isEnemy, dexterity, index) {
  this.isEnemy = isEnemy || false;
  this.dexterity = dexterity || 0;
  this.index = index || 0;

  return this;
};

Const.MAX_ACTIONQUEUE_ITEMS = (Const.MAX_PLAYERS_IN_PARTY + Const.MAX_ENEMIES_IN_TEAM * 2);

var Battle = battle.Battle = function() {
  this.player = utils.initArray(BattlePlayer, Const.MAX_PLAYERS_IN_PARTY);
  this.enemy = utils.initArray(BattleEnemy, Const.MAX_ENEMIES_IN_TEAM);
  this.maxEnemyIndex = 0;
  this.sceneBuf = null;
  this.background = null;
  this.backgroundColorShift = 0;
  this.summonSprite = null;
  this.summonPos = 0;
  this.summonFrame = 0;
  this.expGained = 0;
  this.cashGained = 0;
  this.isBoss = false;
  this.enemyCleared = false;
  this.battleResult = BattleResult.Terminated;
  this.UI = new uibattle.BattleUI();
  this.effectSprite = new Sprite(Files.DATA.readChunk(10));
  this.enemyMoving = false;
  this.hidingTime = 0;
  this.movingPlayerIndex = 0;
  this.blow = 0;
  this.phase = BattlePhase.SelectAction;
  this.actionQueue = utils.initArray(ActionQueue, Const.MAX_ACTIONQUEUE_ITEMS);
  this.curAction = 0;
  this.repeat = false;
  this.force = false;
  this.flee = false;
};

var surface = null

battle.init = function*(surf) {
  log.debug('[BATTLE] init');
  global.battle = battle;
  surface = surf;

  yield ajax.loadMKF('DATA', 'FBP', 'ABC', 'F');
  Files.DATA = ajax.MKF.DATA;
  Files.FBP = ajax.MKF.FBP;
  Files.ABC = ajax.MKF.ABC;
  Files.F = ajax.MKF.F;

  yield fight.init(surf, battle);
  yield uibattle.init(surf, battle, ui);

  Global.battle = new Battle();
};

/**
 * Generate the battle scene into the scene buffer.
 */
battle.makeScene = function() {
  // Draw the background
  var srcOffset = 0;
  var dstOffset = 0;
  var background = Global.battle.background;
  var sceneBuf = Global.battle.sceneBuf;

  for (var i = 0; i < surface.pitch * surface.height; i++) {
    var b = background[srcOffset] & 0x0F;
    b += Global.battle.backgroundColorShift;

    if (b & 0x80) {
      b = 0;
    } else if (b & 0x70) {
      b = 0x0F;
    }

    sceneBuf[dstOffset] = (b | (background[srcOffset] & 0xF0));

    ++srcOffset;
    ++dstOffset;
  }

  scene.applyWave(sceneBuf);

  // Draw the enemies
  for (var i = Global.battle.maxEnemyIndex; i >= 0; i--) {
    var enemy = Global.battle.enemy[i];
    if (enemy.objectID == 0) {
      continue;
    }
    if (!enemy.sprite) {
      // 当敌人是召唤或者复制出的时候似乎有这个问题
      continue;
    }
    var pos = enemy.pos;

    if (enemy.status[PlayerStatus.Confused] > 0 &&
        enemy.status[PlayerStatus.Sleep] == 0 &&
        enemy.status[PlayerStatus.Paralyzed] == 0) {
      // Enemy is confused
      pos = PAL_XY(PAL_X(pos) + randomLong(-1, 1), PAL_Y(pos));
    }

    var frame = enemy.sprite.getFrame(enemy.currentFrame);
    pos = PAL_XY(PAL_X(pos) - ~~(frame.width / 2), PAL_Y(pos) - frame.height);

    if (enemy.objectID != 0) {
      if (enemy.colorShift != 0) {
        surface.blitRLEWithColorShift(frame, pos, enemy.colorShift, sceneBuf);
      } else {
        surface.blitRLE(frame, pos, sceneBuf);
      }
    }
  }

  if (Global.battle.summonSprite) {
    // Draw the summoned god
    var frame = Global.battle.summonSprite.getFrame(Global.battle.summonFrame);
    var pos = PAL_XY(
      PAL_X(Global.battle.summonPos) - ~~(frame.width / 2),
      PAL_Y(Global.battle.summonPos) - frame.height
    );

    surface.blitRLE(frame, pos, sceneBuf);
  } else {
    // Draw the players
    for (i = Global.maxPartyMemberIndex; i >= 0; i--) {
      var pos = Global.battle.player[i].pos;
      var status = Global.playerStatus[Global.party[i].playerRole];

      if (status[PlayerStatus.Confused] != 0 &&
          status[PlayerStatus.Sleep] == 0 &&
          status[PlayerStatus.Paralyzed] == 0 &&
          GameData.playerRoles.HP[Global.party[i].playerRole] > 0) {
        // Player is confused
        continue;
      }

      var player = Global.battle.player[i];
      var frame = player.sprite.getFrame(player.currentFrame);
      pos = PAL_XY(
        PAL_X(pos) - ~~(frame.width / 2),
        PAL_Y(pos) - frame.height
      );

      if (player.colorShift != 0) {
        surface.blitRLEWithColorShift(frame, pos, player.colorShift, sceneBuf);
      } else if (Global.battle.hidingTime == 0) {
        surface.blitRLE(frame, pos, sceneBuf);
      }
    }

    // Confused players should be drawn on top of normal players
    for (var i = Global.maxPartyMemberIndex; i >= 0; i--) {
      var status = Global.playerStatus[Global.party[i].playerRole];
      if (status[PlayerStatus.Confused] != 0 &&
          status[PlayerStatus.Sleep] == 0 &&
          status[PlayerStatus.Paralyzed] == 0 &&
          GameData.playerRoles.HP[Global.party[i].playerRole] > 0) {
        // Player is confused
        var player = Global.battle.player[i];
        var frame = player.sprite.getFrame(player.currentFrame);
        var pos = PAL_XY(PAL_X(player.pos), PAL_Y(player.pos) + randomLong(-1, 1));
        pos = PAL_XY(
          PAL_X(pos) - ~~(frame.width / 2),
          PAL_Y(pos) - frame.height
        );

        if (player.colorShift != 0) {
          surface.blitRLEWithColorShift(frame, pos, player.colorShift, sceneBuf);
        } else if (Global.battle.hidingTime == 0) {
          surface.blitRLE(frame, pos, sceneBuf);
        }
      }
    }
  }
};

/**
 * Backup the scene buffer.
 */
battle.backupScene = function() {
  Global.battle.sceneBuf = surface.getRect(0, 0, 320, 200);
};

/**
 * Fade in the scene of battle.
 */
battle.fadeScene = function*() {
  var indices = [0, 3, 1, 5, 2, 4];

  var backup = surface.backup;
  var screen = surface.byteBuffer;

  for (var i = 0; i < 12; i++) {
    for (var j = 0; j < 6; j++) {
      // Blend the pixels in the 2 buffers, and put the result into the
      // backup buffer
      for (var k = indices[j]; k < surface.pitch * surface.height; k += 6) {
        var a = Global.battle.sceneBuf[k];
        var b = backup[k];

        if (i > 0) {
          if ((a & 0x0F) > (b & 0x0F))
          {
            b++;
          }
          else if ((a & 0x0F) < (b & 0x0F)) {
            b--;
          }
        }

        backup[k] = ((a & 0xF0) | (b & 0x0F));
      }

      // Draw the backup buffer to the screen
      surface.blitSurface(backup, null, screen, null);

      yield uibattle.update();
      surface.updateScreen(null);

      yield sleep(8); // 16
    }
  }

  // Draw the result buffer to the screen as the final step
  surface.blitSurface(Global.battle.sceneBuf, null, screen, null);
  yield uibattle.update();
  surface.updateScreen(null);
};

/**
 * The main battle routine.
 * @yield {BattleResult} The result of the battle.
 */
battle.main = function*() {
  surface.backupScreen();
  var screen = surface.byteBuffer;
  var sceneBuf = Global.battle.sceneBuf;

  // Generate the scene and draw the scene to the screen buffer
  battle.makeScene();
  surface.blitSurface(sceneBuf, null, screen, null);

  // Fade out the music and delay for a while
  music.play(0, false, 1);
  yield sleep(100); // 200

  // Switch the screen
  yield surface.switchScreen(5);

  // Play the battle music
  music.play(Global.numBattleMusic, true, 0);

  // Fade in the screen when needed
  if (Global.needToFadeIn) {
    yield surface.fadeIn(Global.numPalette, Global.nightPalette, 1);
    Global.needToFadeIn = false;
  }

  // Run the pre-battle scripts for each enemies
  for (var i = 0; i <= Global.battle.maxEnemyIndex; i++) {
    Global.battle.enemy[i].scriptOnTurnStart =
      yield script.runTriggerScript(Global.battle.enemy[i].scriptOnTurnStart, i);

    if (Global.battle.battleResult != BattleResult.PreBattle) {
      break;
    }
  }

  if (Global.battle.battleResult == BattleResult.PreBattle) {
    Global.battle.battleResult = BattleResult.OnGoing;
  }

  input.clear();

  // Run the main battle loop.
  while (true) {
    // Break out if the battle ended.
    if (Global.battle.battleResult != BattleResult.OnGoing) {
      break;
    }

    // Run the main frame routine.
    yield battle.startFrame();

    // Update the screen.
    surface.updateScreen(null);

    yield sleepByFrame(1);
  }

  // Return the battle result
  return Global.battle.battleResult;
};

/**
 * Free all the loaded sprites.
 */
battle.freeBattleSprites = function() {
  log.debug('[BATTLE] freeBattleSprites');
  // Free all the loaded sprites
  for (var i = 0; i <= Global.maxPartyMemberIndex; i++)
  {
    Global.battle.player[i].sprite = null;
  }

  for (var i = 0; i <= Global.battle.maxEnemyIndex; i++) {
    Global.battle.enemy[i].sprite = null;
  }

  Global.battle.summonSprite = null;
};

/**
 * Get player's battle sprite.
 * @param  {Number} playerRole the player role ID.
 * @return {Number}            Number of the player's battle sprite.
 */
battle.getPlayerBattleSprite = function(playerRole) {
  log.trace(['[BATTLE] getPlayerBattleSprite', playerRole].join(' '));
  var w = GameData.playerRoles.spriteNumInBattle[playerRole];

  for (var i = 0; i <= Const.MAX_PLAYER_EQUIPMENTS; i++) {
    if (Global.equipmentEffect[i].spriteNumInBattle[playerRole] != 0) {
       w = Global.equipmentEffect[i].spriteNumInBattle[playerRole];
    }
  }

  return w;
};

/**
 * Load all the loaded sprites.
 */
battle.loadBattleSprites = function() {
  log.debug('[BATTLE] loadBattleSprites');
  battle.freeBattleSprites();

  // Load battle sprites for players
  for (var i = 0; i <= Global.maxPartyMemberIndex; i++) {
    var s = battle.getPlayerBattleSprite(Global.party[i].playerRole);

    Global.battle.player[i].sprite = new Sprite(Files.F.decompressChunk(s));

    // Set the default position for this player
    //
    var x = battle.playerPos[Global.maxPartyMemberIndex][i][0];
    var y = battle.playerPos[Global.maxPartyMemberIndex][i][1];

    Global.battle.player[i].originalPos = PAL_XY(x, y);
    Global.battle.player[i].pos = PAL_XY(x, y);
  }

  // Load battle sprites for enemies
  for (var i = 0; i < Const.MAX_ENEMIES_IN_TEAM; i++) {
    var enemy = Global.battle.enemy[i];
    if (enemy.objectID == 0) {
       continue;
    }

    var enemyID = GameData.object[enemy.objectID].enemy.enemyID
    enemy.sprite = new Sprite(Files.ABC.decompressChunk(enemyID));

    // Set the default position for this enemy
    var x = GameData.enemyPos.pos[i][Global.battle.maxEnemyIndex].x;
    var y = GameData.enemyPos.pos[i][Global.battle.maxEnemyIndex].y;

    y += enemy.e.yPosOffset;

    enemy.originalPos = PAL_XY(x, y);
    enemy.pos = PAL_XY(x, y);
  }
};

/**
 * Load the screen background picture of the battle.
 */
battle.loadBattleBackground = function() {
  log.debug('[BATTLE] loadBattleBackground');
  // Create the surface
  var background = surface.getRect(0, 0, 320, 200);
  Global.battle.background = background;

  // Load the picture
  var buf = Files.FBP.decompressChunk(Global.numBattleField);

  // Draw the picture to the surface.
  surface.blit(buf, background);
};

/**
 * Show the "you win" message and add the experience points for players.
 */
battle.won = function*() {
  var rect = new RECT(65, 60, 200, 100);
  var rect1 = new RECT(80, 0, 180, 200);

  // Backup the initial player stats
  var origplayerRoles = GameData.playerRoles.copy();

  if (Global.battle.expGained > 0) {
    // Play the "battle win" music
    music.play(Global.battle.isBoss ? 2 : 3, false, 0);

    // Show the message about the total number of exp. and cash gained
    ui.createSingleLineBox(PAL_XY(83, 60), 8, false);
    ui.createSingleLineBox(PAL_XY(65, 105), 10, false);

    ui.drawText(ui.getWord(ui.BATTLEWIN_GETEXP_LABEL), PAL_XY(95, 70), 0, false, false);
    ui.drawText(ui.getWord(ui.BATTLEWIN_BEATENEMY_LABEL), PAL_XY(77, 115), 0, false, false);
    ui.drawText(ui.getWord(ui.BATTLEWIN_DOLLAR_LABEL), PAL_XY(197, 115), 0, false, false);

    ui.drawNumber(Global.battle.expGained, 5, PAL_XY(182, 74), NumColor.Yellow, NumAlign.Right);
    ui.drawNumber(Global.battle.cashGained, 5, PAL_XY(162, 119), NumColor.Yellow, NumAlign.Mid);

    surface.updateScreen(rect);
    yield input.waitForKey(Global.battle.isBoss ? 5500 : 3000);
  }

  // Add the cash value
  Global.cash += Global.battle.cashGained;

  // Add the experience points for each players
  for (var i = 0; i <= Global.maxPartyMemberIndex; i++) {
    var levelUp = false;

    var w = Global.party[i].playerRole;
    if (GameData.playerRoles.HP[w] == 0) {
      continue; // don't care about dead players
    }

    var exp = Global.exp.primaryExp[w].exp;
    exp += Global.battle.expGained;

    if (GameData.playerRoles.level[w] > Const.MAX_LEVELS) {
      GameData.playerRoles.level[w] = Const.MAX_LEVELS;
    }

    while (exp >= GameData.levelUpExp[GameData.playerRoles.level[w]]) {
      exp -= GameData.levelUpExp[GameData.playerRoles.level[w]];

      if (GameData.playerRoles.level[w] < Const.MAX_LEVELS) {
        levelUp = true;
        script.playerLevelUp(w, 1);

        GameData.playerRoles.HP[w] = GameData.playerRoles.maxHP[w];
        GameData.playerRoles.MP[w] = GameData.playerRoles.maxMP[w];
      }
    }

    Global.exp.primaryExp[w].exp = WORD(exp);

    if (levelUp) {
      // Player has gained a level. Show the message
      ui.createSingleLineBox(PAL_XY(80, 0), 10, false);
      ui.createBox(PAL_XY(82, 32), 7, 8, 1, false);

      ui.drawText(ui.getWord(GameData.playerRoles.name[w]), PAL_XY(110, 10), 0, false, false);
      ui.drawText(ui.getWord(ui.STATUS_LABEL_LEVEL), PAL_XY(110 + 16 * 3, 10), 0, false, false);
      ui.drawText(ui.getWord(ui.BATTLEWIN_LEVELUP_LABEL), PAL_XY(110 + 16 * 5, 10), 0, false, false);

      for (var j = 0; j < 8; j++) {
        var frame = ui.sprite.getFrame(ui.SPRITENUM_ARROW);
        surface.blitRLE(frame, PAL_XY(183, 48 + 18 * j))
      }

      ui.drawText(ui.getWord(ui.STATUS_LABEL_LEVEL), PAL_XY(100, 44), ui.BATTLEWIN_LEVELUP_LABEL_COLOR, true, false);
      ui.drawText(ui.getWord(ui.STATUS_LABEL_HP), PAL_XY(100, 62), ui.BATTLEWIN_LEVELUP_LABEL_COLOR, true, false);
      ui.drawText(ui.getWord(ui.STATUS_LABEL_MP), PAL_XY(100, 80), ui.BATTLEWIN_LEVELUP_LABEL_COLOR, true, false);
      ui.drawText(ui.getWord(ui.STATUS_LABEL_ATTACKPOWER), PAL_XY(100, 98), ui.BATTLEWIN_LEVELUP_LABEL_COLOR, true, false);
      ui.drawText(ui.getWord(ui.STATUS_LABEL_MAGICPOWER), PAL_XY(100, 116), ui.BATTLEWIN_LEVELUP_LABEL_COLOR, true, false);
      ui.drawText(ui.getWord(ui.STATUS_LABEL_RESISTANCE), PAL_XY(100, 134), ui.BATTLEWIN_LEVELUP_LABEL_COLOR, true, false);
      ui.drawText(ui.getWord(ui.STATUS_LABEL_DEXTERITY), PAL_XY(100, 152), ui.BATTLEWIN_LEVELUP_LABEL_COLOR, true, false);
      ui.drawText(ui.getWord(ui.STATUS_LABEL_FLEERATE), PAL_XY(100, 170), ui.BATTLEWIN_LEVELUP_LABEL_COLOR, true, false);

      // Draw the original stats and stats after level up
      ui.drawNumber(origplayerRoles.level[w], 4, PAL_XY(133, 47), NumColor.Yellow, NumAlign.Right);
      ui.drawNumber(GameData.playerRoles.level[w], 4, PAL_XY(195, 47), NumColor.Yellow, NumAlign.Right);

      ui.drawNumber(origplayerRoles.HP[w], 4, PAL_XY(133, 64), NumColor.Yellow, NumAlign.Right);
      ui.drawNumber(origplayerRoles.maxHP[w], 4, PAL_XY(154, 68), NumColor.Blue, NumAlign.Right);
      surface.blitRLE(ui.sprite.getFrame(ui.SPRITENUM_SLASH), PAL_XY(156, 66));
      ui.drawNumber(GameData.playerRoles.HP[w], 4, PAL_XY(195, 64), NumColor.Yellow, NumAlign.Right);
      ui.drawNumber(GameData.playerRoles.maxHP[w], 4, PAL_XY(216, 68), NumColor.Blue, NumAlign.Right);
      surface.blitRLE(ui.sprite.getFrame(ui.SPRITENUM_SLASH), PAL_XY(218, 66));

      ui.drawNumber(origplayerRoles.MP[w], 4, PAL_XY(133, 82), NumColor.Yellow, NumAlign.Right);
      ui.drawNumber(origplayerRoles.maxMP[w], 4, PAL_XY(154, 86), NumColor.Blue, NumAlign.Right);
      surface.blitRLE(ui.sprite.getFrame(ui.SPRITENUM_SLASH), PAL_XY(156, 84));
      ui.drawNumber(GameData.playerRoles.MP[w], 4, PAL_XY(195, 82), NumColor.Yellow, NumAlign.Right);
      ui.drawNumber(GameData.playerRoles.maxMP[w], 4, PAL_XY(216, 86), NumColor.Blue, NumAlign.Right);
      surface.blitRLE(ui.sprite.getFrame(ui.SPRITENUM_SLASH), PAL_XY(218, 84));

      ui.drawNumber(origplayerRoles.attackStrength[w] + script.getPlayerAttackStrength(w) - GameData.playerRoles.attackStrength[w],
        4, PAL_XY(133, 101), NumColor.Yellow, NumAlign.Right);
      ui.drawNumber(script.getPlayerAttackStrength(w), 4, PAL_XY(195, 101), NumColor.Yellow, NumAlign.Right);

      ui.drawNumber(origplayerRoles.magicStrength[w] + script.getPlayerMagicStrength(w) - GameData.playerRoles.magicStrength[w],
        4, PAL_XY(133, 119), NumColor.Yellow, NumAlign.Right);
      ui.drawNumber(script.getPlayerMagicStrength(w), 4, PAL_XY(195, 119), NumColor.Yellow, NumAlign.Right);

      ui.drawNumber(origplayerRoles.defense[w] + script.getPlayerDefense(w) - GameData.playerRoles.defense[w],
        4, PAL_XY(133, 137), NumColor.Yellow, NumAlign.Right);
      ui.drawNumber(script.getPlayerDefense(w), 4, PAL_XY(195, 137), NumColor.Yellow, NumAlign.Right);

      ui.drawNumber(origplayerRoles.dexterity[w] + script.getPlayerDexterity(w) - GameData.playerRoles.dexterity[w],
        4, PAL_XY(133, 155), NumColor.Yellow, NumAlign.Right);
      ui.drawNumber(script.getPlayerDexterity(w), 4, PAL_XY(195, 155), NumColor.Yellow, NumAlign.Right);

      ui.drawNumber(origplayerRoles.fleeRate[w] + script.getPlayerFleeRate(w) - GameData.playerRoles.fleeRate[w],
        4, PAL_XY(133, 173), NumColor.Yellow, NumAlign.Right);
      ui.drawNumber(script.getPlayerFleeRate(w), 4, PAL_XY(195, 173), NumColor.Yellow, NumAlign.Right);

      // Update the screen and wait for key
      surface.updateScreen(rect1);
      yield input.waitForKey(3000);

      origplayerRoles = GameData.playerRoles.copy();
    }

    // Increasing of other hidden levels
    var totalCount = 0;

    totalCount += Global.exp.attackExp[w].count;
    totalCount += Global.exp.defenseExp[w].count;
    totalCount += Global.exp.dexterityExp[w].count;
    totalCount += Global.exp.fleeExp[w].count;
    totalCount += Global.exp.healthExp[w].count;
    totalCount += Global.exp.magicExp[w].count;
    totalCount += Global.exp.magicPowerExp[w].count;

    if (totalCount > 0) {
      function* checkHiddenExp(expname, statname, label) {
        var exp = Global.battle.expGained;
        exp *= Global.exp[expname][w].count;
        exp /= totalCount;
        exp *= 2;

        exp += Global.exp[expname][w].exp;

        if (Global.exp[expname][w].level > Const.MAX_LEVELS) {
          Global.exp[expname][w].level = Const.MAX_LEVELS;
        }

        while (exp >= GameData.levelUpExp[Global.exp[expname][w].level]) {
          exp -= GameData.levelUpExp[Global.exp[expname][w].level];
          GameData.playerRoles[statname][w] += randomLong(1, 2);
          if (Global.exp[expname][w].level < Const.MAX_LEVELS) {
            Global.exp[expname][w].level++;
          }
        }

        Global.exp[expname][w].exp = WORD(exp);

        if (GameData.playerRoles[statname][w] != origplayerRoles[statname][w]) {
          ui.createSingleLineBox(PAL_XY(83, 60), 8, false);
          ui.drawText(ui.getWord(GameData.playerRoles.name[w]), PAL_XY(95, 70), 0, false, false);
          ui.drawText(ui.getWord(label), PAL_XY(143, 70), 0, false, false);
          ui.drawText(ui.getWord(ui.BATTLEWIN_LEVELUP_LABEL), PAL_XY(175, 70), 0, false, false);
          ui.drawNumber(GameData.playerRoles[statname][w] - origplayerRoles[statname][w], 5, PAL_XY(188, 74), NumColor.Yellow, NumAlign.Right);

          surface.updateScreen(rect);
          yield input.waitForKey(3000);
        }
      }

      yield checkHiddenExp('healthExp', 'maxHP', ui.STATUS_LABEL_HP);
      yield checkHiddenExp('magicExp', 'maxMP', ui.STATUS_LABEL_MP);
      yield checkHiddenExp('attackExp', 'attackStrength', ui.STATUS_LABEL_ATTACKPOWER);
      yield checkHiddenExp('magicPowerExp', 'magicStrength', ui.STATUS_LABEL_MAGICPOWER);
      yield checkHiddenExp('defenseExp', 'defense', ui.STATUS_LABEL_RESISTANCE);
      yield checkHiddenExp('dexterityExp', 'dexterity', ui.STATUS_LABEL_DEXTERITY);
      yield checkHiddenExp('fleeExp', 'fleeRate', ui.STATUS_LABEL_FLEERATE);
    }

    // Learn all magics at the current level
    for (var j = 0; j < GameData.levelUpMagic.length; ++j) {
      var level = GameData.levelUpMagic[j].m[w].level;
      var magic = GameData.levelUpMagic[j].m[w].magic
      if (magic == 0 || level > GameData.playerRoles.level[w]) {
        continue;
      }

      if (script.addMagic(w, magic)) {
        ui.createSingleLineBox(PAL_XY(65, 105), 10, false);

        ui.drawText(ui.getWord(GameData.playerRoles.name[w]), PAL_XY(75, 115), 0, false, false);
        ui.drawText(ui.getWord(ui.BATTLEWIN_ADDMAGIC_LABEL), PAL_XY(75 + 16 * 3, 115), 0, false, false);
        ui.drawText(ui.getWord(magic), PAL_XY(75 + 16 * 5, 115), 0x1B, false, false);

        surface.updateScreen(rect);
        yield input.waitForKey(3000)
      }
    }
  }

  for (var i = 0; i <= Global.battle.maxEnemyIndex; i++) {
    yield script.runTriggerScript(Global.battle.enemy[i].scriptOnBattleEnd, i);
  }

  // Recover automatically after each battle
  for (var i = 0; i <= Global.maxPartyMemberIndex; i++) {
    w = Global.party[i].playerRole;

    GameData.playerRoles.HP[w] += ~~((GameData.playerRoles.maxHP[w] - GameData.playerRoles.HP[w]) / 2);
    GameData.playerRoles.MP[w] += ~~((GameData.playerRoles.maxMP[w] - GameData.playerRoles.MP[w]) / 2);
  }
};

/**
 * Enemy flee the battle.
 */
battle.enemyEscape = function*() {
  sound.play(45);

  var f = true;
  // Show the animation
  while (f) {
    f = false;

    for (j = 0; j <= Global.battle.maxEnemyIndex; j++) {
      var enemy = Global.battle.enemy[j];
      if (enemy.objectID == 0) {
        continue;
      }

      var x = PAL_X(enemy.pos) - 5;
      var y = PAL_Y(enemy.pos);

      enemy.pos = PAL_XY(x, y);

      var frame = enemy.sprite.getFrame(0);
      var w = frame.width;

      if (x + w > 0) {
        f = true;
      }
    }

    battle.makeScene();
    surface.blitSurface(Global.battle.sceneBuf, null, surface.byteBuffer, null);
    surface.updateScreen(null);

    yield sleep(10);
  }

  yield sleep(500)
  Global.battle.battleResult = BattleResult.Terminated;
};

/**
 * Player flee the battle.
 */
battle.playerEscape = function*() {
  sound.play(45);

  battle.updateFighters();
  var playerRole;

  for (var i = 0; i <= Global.maxPartyMemberIndex; i++) {
    playerRole = Global.party[i].playerRole;

    if (GameData.playerRoles.HP[playerRole] > 0) {
      Global.battle.player[i].currentFrame = 0;
    }
  }

  for (var i = 0; i < 16; i++) {
    for (var j = 0; j <= Global.maxPartyMemberIndex; j++) {
      playerRole = Global.party[j].playerRole;
      var player = Global.battle.player[j];

      if (GameData.playerRoles.HP[playerRole] > 0) {
        // TODO: This is still not the same as the original game
        switch (j) {
          case 0:
            if (Global.maxPartyMemberIndex > 0) {
              player.pos = PAL_XY(PAL_X(player.pos) + 4, PAL_Y(player.pos) + 6);
              break;
            }

          case 1:
            player.pos = PAL_XY(PAL_X(player.pos) + 4, PAL_Y(player.pos) + 4);
            break;

          case 2:
            player.pos = PAL_XY(PAL_X(player.pos) + 6, PAL_Y(player.pos) + 3);
            break;

          default:
            throw 'should not be here';
        }
      }
    }

    yield battle.delay(1, 0, false);
  }

  // Remove all players from the screen
  for (var i = 0; i <= Global.maxPartyMemberIndex; i++) {
    Global.battle.player[i].pos = PAL_XY(9999, 9999);
  }

  yield battle.delay(1, 0, false);

  Global.battle.battleResult = BattleResult.Fleed;
};

/**
 * Start a battle.
 * @param {Number}  enemyTeam     the number of the enemy team.
 * @param {Boolean} isBoss        true for boss fight (not allowed to flee).
 * @yield {BattleResult}  The result of the battle.
 */
battle.start = function*(enemyTeam, isBoss) {
  log.debug(['[BATTLE] start', enemyTeam, isBoss].join(' '));
  // Set the screen waving effects
  prevWaveLevel = Global.screenWave;
  prevWaveProgression = Global.waveProgression;

  Global.waveProgression = 0;
  Global.screenWave = GameData.battleField[Global.numBattleField].screenWave;

  var party = Global.party;

  // Make sure everyone in the party is alive, also clear all hidden
  // EXP count records
  for (var i = 0; i <= Global.maxPartyMemberIndex; i++) {
    var w = party[i].playerRole;

    if (GameData.playerRoles.HP[w] == 0) {
      GameData.playerRoles.HP[w] = 1;
      Global.playerStatus[w][PlayerStatus.Puppet] = 0;
    }

    Global.exp.healthExp[w].count = 0;
    Global.exp.magicExp[w].count = 0;
    Global.exp.attackExp[w].count = 0;
    Global.exp.magicPowerExp[w].count = 0;
    Global.exp.defenseExp[w].count = 0;
    Global.exp.dexterityExp[w].count = 0;
    Global.exp.fleeExp[w].count = 0;
  }

  // Clear all item-using records
  for (var i = 0; i < Const.MAX_INVENTORY; i++) {
    Global.inventory[i].amountInUse = 0;
  }

  // Store all enemies
  for (var i = 0; i < Const.MAX_ENEMIES_IN_TEAM; i++) {
    //memset(&(Global.battle.enemy[i]), 0, sizeof(BATTLEENEMY));
    var enemy = Global.battle.enemy[i];
    enemy.reset();
    var w = GameData.enemyTeam[enemyTeam].enemy[i];

    if (w == 0xFFFF) {
      break;
    }

    //if (w != 0) {
    // WTF？怎么会这样，这里把条件去掉以后会莫名其妙的少了好多BUG
      enemy.e = GameData.enemy[GameData.object[w].enemy.enemyID].copy();
      enemy.objectID = w;
      enemy.state = FighterState.Wait;
      enemy.scriptOnTurnStart = GameData.object[w].enemy.scriptOnTurnStart;
      enemy.scriptOnBattleEnd = GameData.object[w].enemy.scriptOnBattleEnd;
      enemy.scriptOnReady = GameData.object[w].enemy.scriptOnReady;
      enemy.colorShift = 0;
    //}
  }

  Global.battle.maxEnemyIndex = i - 1;

  // Store all players
  for (var i = 0; i <= Global.maxPartyMemberIndex; i++) {
    Global.battle.player[i].timeMeter = 15.0;
    Global.battle.player[i].hidingTime = 0;
    Global.battle.player[i].state = FighterState.Wait;
    Global.battle.player[i].action.target = -1;
    Global.battle.player[i].defending = false;
    Global.battle.player[i].currentFrame = 0;
    Global.battle.player[i].colorShift = false;
  }

  // Load sprites and background
  battle.loadBattleSprites();
  battle.loadBattleBackground();

  // Create the surface for scene buffer
  Global.battle.sceneBuf = surface.getRect(0, 0, 320, 200);

  yield script.updateEquipments();

  Global.battle.expGained = 0;
  Global.battle.cashGained = 0;

  Global.battle.isBoss = isBoss;
  Global.battle.enemyCleared = false;
  Global.battle.enemyMoving = false;
  Global.battle.hidingTime = 0;
  Global.battle.movingPlayerIndex = 0;

  Global.battle.UI.msg = [];
  Global.battle.UI.nextMsg = [];
  Global.battle.UI.msgShowTime = 0;
  Global.battle.UI.state = BattleUIState.Wait;
  Global.battle.UI.autoAttack = false;
  Global.battle.UI.selectedIndex = 0;
  Global.battle.UI.prevEnemyTarget = 0;

  //utils.fillArray(Global.battle.UI.showNum, uibattle.ShowNum);
  //memset(Global.battle.UI.rgShowNum, 0, sizeof(Global.battle.UI.rgShowNum));
  Global.battle.UI.showNum.forEach(function(sn, i) {
    sn.reset();
  });

  Global.battle.summonSprite = null;
  Global.battle.backgroundColorShift = 0;

  Global.inBattle = true;
  Global.battle.battleResult = BattleResult.PreBattle;

  battle.updateFighters();

  // Load the battle effect sprite.
  //Global.battle.effectSprite = Files.DATA.readChunk(10);

  Global.battle.phase = BattlePhase.SelectAction;
  Global.battle.repeat = false;
  Global.battle.force = false;
  Global.battle.flee = false;

  //#ifdef PAL_ALLOW_KEYREPEAT
  //SDL_EnableKeyRepeat(120, 75);
  //#endif

  // Run the main battle routine.
  try {
  var result = yield battle.main();
} catch(ex) {
  log.fatal(['BATTLE exception during battle', ex, 'skip this battle'].join(' '));
  var result = BattleResult.Won;
}

  //#ifdef PAL_ALLOW_KEYREPEAT
  //SDL_EnableKeyRepeat(0, 0);
  //PAL_ClearKeyState();
  //g_InputState.prevdir = kDirUnknown;
  //#endif

  if (result == BattleResult.Won) {
    // Player won the battle. Add the Experience points.
    yield battle.won();
  }

  // Clear all item-using records
  for (var w = 0; w < Const.MAX_INVENTORY; w++) {
    Global.inventory[w].amountInUse = 0;
  }

  // Clear all player status, poisons and temporary effects
  script.clearAllPlayerStatus();
  //PAL_ClearAllPlayerStatus();
  for (var w = 0; w < Const.MAX_PLAYER_ROLES; w++) {
    script.curePoisonByLevel(w, 3);
    script.removeEquipmentEffect(w, BodyPart.Extra);
  }

  // Free all the battle sprites
  //PAL_FreeBattleSprites();
  //free(Global.battle.lpEffectSprite);

  // Free the surfaces for the background picture and scene buffer
  Global.battle.background = null;
  Global.battle.sceneBuf = null;
  //SDL_FreeSurface(Global.battle.lpBackground);
  //SDL_FreeSurface(Global.battle.lpSceneBuf);

  Global.battle.background = null;
  Global.battle.sceneBuf = null;

  Global.inBattle = false;

  music.play(Global.numMusic, true, 1);

  // Restore the screen waving effects
  Global.waveProgression = prevWaveProgression;
  Global.screenWave = prevWaveLevel;

  return result;
}

export default battle;

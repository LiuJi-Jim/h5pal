/**
 * Battle UI
 * @module
 * @memberOf  ui
 */

import utils from './utils';
import MKF from './MKF';
import RLE from './RLE';
import Palette from './palette';
import Sprite from './sprite';
import ajax from './ajax';
import music from './music';
import text from './text';
import input from './input';
import ui from './ui';
import itemmenu from './itemmenu';

log.trace('uibattle module load');

global.BattleUIState = {
  Wait:                  0,
  SelectMove:            1,
  SelectTargetEnemy:     2,
  SelectTargetPlayer:    3,
  SelectTargetEnemyAll:  4,
  SelectTargetPlayerAll: 5
};

global.BattleMenuState = {
  Main:                  0,
  MagicSelect:           1,
  UseItemSelect:         2,
  ThrowItemSelect:       3,
  Misc:                  4,
  MiscItemSubMenu:       5,
};

global.BattleUIAction = {
  Attack:                0,
  Magic:                 1,
  CoopMagic:             2,
  Misc:                  3,
};

var SPRITENUM_BATTLEICON_ATTACK               = 40;
var SPRITENUM_BATTLEICON_MAGIC                = 41;
var SPRITENUM_BATTLEICON_COOPMAGIC            = 42;
var SPRITENUM_BATTLEICON_MISCMENU             = 43;

var SPRITENUM_BATTLE_ARROW_CURRENTPLAYER      = 69;
var SPRITENUM_BATTLE_ARROW_CURRENTPLAYER_RED  = 68;

var SPRITENUM_BATTLE_ARROW_SELECTEDPLAYER     = 67;
var SPRITENUM_BATTLE_ARROW_SELECTEDPLAYER_RED = 66;

var BATTLEUI_LABEL_ITEM                       = 5;
var BATTLEUI_LABEL_DEFEND                     = 58;
var BATTLEUI_LABEL_AUTO                       = 56;
var BATTLEUI_LABEL_INVENTORY                  = 57;
var BATTLEUI_LABEL_FLEE                       = 59;
var BATTLEUI_LABEL_STATUS                     = 60;

var BATTLEUI_LABEL_USEITEM                    = 23;
var BATTLEUI_LABEL_THROWITEM                  = 24;

var TIMEMETER_COLOR_DEFAULT                   = 0x1B;
var TIMEMETER_COLOR_SLOW                      = 0x5B;
var TIMEMETER_COLOR_HASTE                     = 0x2A;

var BATTLEUI_MAX_SHOWNUM                      = 16;

var uibattle = {};

var surface = null;
var battle = null;
var curMiscMenuItem = 0;
var curSubMenuItem = 0;

uibattle.init = function*(surf, _battle) {
  log.debug('[BATTLE] init uibattle');
  battle = _battle;
  global.uibattle = ui.uibattle = uibattle;
  surface = surf;
};

var ShowNum = uibattle.ShowNum = function(num, pos, time, color) {
  this.num = num || 0;
  this.pos = pos || 0;
  this.time = time || 0;
  this.color = color || NumColor.Yellow;
};

var BattleUI = uibattle.BattleUI = function() {
  this.state = BattleUIState.Wait;
  this.menuState = BattleMenuState.Main;
  this.msg = null;
  this.nextMsg = null;
  this.msgShowTime = 0;
  this.nextMsgDuration = 0;
  this.curPlayerIndex = 0;
  this.selectedAction = 0;
  this.prevEnemyTarget = 0;
  this.actionType = 0;
  this.objectID = 0;
  this.autoAttack = false;
  this.showNum = utils.initArray(ShowNum, BATTLEUI_MAX_SHOWNUM);
};

/**
 * Show the player info box.
 * @param  {POS} pos            the top-left corner position of the box.
 * @param  {Number}  playerRole     the player role ID to be shown.
 * @param  {Number}  timeMeter      the value of time meter. 0 = empty, 100 = full.
 * @param  {Number}  timeMeterColor the color of time meter.
 * @param  {Boolean} update         whether to update the screen area or not.
 */
uibattle.playerInfoBox = function(pos, playerRole, timeMeter, timeMeterColor, update) {

};

/**
 * Check if the specified action is valid.
 * @param  {BattleUIAction}  actionType the type of the action.
 * @return {Boolean}         true if the action is valid, false if not.
 */
uibattle.isActionValid = function(actionType) {
  var playerRole = Global.party[Global.battle.UI.curPlayerIndex].playerRole;

  switch (actionType) {
    case BattleUIAction.Attack:
    case BattleUIAction.Misc:
      break;

    case BattleUIAction.Magic:
      if (Global.playerStatus[playerRole][PlayerStatus.Silence] != 0) {
        return false;
      }
      break;

    case BattleUIAction.CoopMagic:
      if (Global.maxPartyMemberIndex == 0) {
        return false;
      }
      for (var i = 0; i <= Global.maxPartyMemberIndex; i++) {
        var w = Global.party[i].playerRole;

        if (GameData.playerRoles.HP[w] < GameData.playerRoles.maxHP[w] / 5 ||
            Global.playerStatus[w][PlayerStatus.Sleep] != 0 ||
            Global.playerStatus[w][PlayerStatus.Confused] != 0 ||
            Global.playerStatus[w][PlayerStatus.Silence] != 0) {
          return false;
        }
      }
      break;
  }

  return true;
};

/**
 * Draw the misc menu.
 * @param  {Number}  currentItem the current selected menu item.
 * @param  {Boolean} confirmed   true if confirmed, false if not.
 */
uibattle.drawMiscMenu = function(currentItem, confirmed) {

};

/**
 * Update the misc menu.
 * @return {Number} The selected item number. 0 if cancelled, 0xFFFF if not confirmed.
 */
uibattle.miscMenuUpdate = function() {

};

/**
 * Update the item sub menu of the misc menu.
 * @return {Number} The selected item number. 0 if cancelled, 0xFFFF if not confirmed.
 */
uibattle.miscItemSubMenuUpdate = function() {

};

/**
 * Show a text message in the battle.
 * @param  {Number} text     the text message to be shown.
 * @param  {Number} duration the duration of the message, in milliseconds.
 */
uibattle.showText = function(text, duration) {
  var now = hrtime();
  if (now < Global.battle.UI.msgShowTime) {
    // Global.battle.UI.nextMsg = utils.arrClone(text);
    Global.battle.UI.nextMsg = text;
    Global.battle.UI.nextMsgDuration = duration;
  } else {
    // Global.battle.UI.msg = utils.arrClone(text);
    Global.battle.UI.msg = text;
    Global.battle.UI.msgShowTime = now + duration;
  }
};

/**
 * Start the action selection menu of the specified player.
 * @param  {Number} playerIndex the player index.
 */
uibattle.playerReady = function(playerIndex) {
  Global.battle.UI.curPlayerIndex = playerIndex;
  Global.battle.UI.state = BattleUIState.SelectMove;
  Global.battle.UI.selectedAction = 0;
  Global.battle.UI.menuState = BattleMenuState.Main;
};

/**
 * Use an item in the battle UI.
 */
uibattle.useItem = function() {
  var selectedItem = itemmenu.itemSelectMenuUpdate();

  if (selectedItem != 0xFFFF) {
    if (selectedItem != 0) {
      Global.battle.UI.actionType = BattleAction.UseItem;
      Global.battle.UI.objectID = selectedItem;

      if (GameData.object[selectedItem].item.flags & ItemFlag.ApplyToAll) {
        Global.battle.UI.state = BattleUIState.SelectTargetPlayerAll;
      } else {
        Global.battle.UI.selectedIndex = 0;
        Global.battle.UI.state = BattleUIState.SelectTargetPlayer;
      }
    } else {
      Global.battle.UI.menuState = BattleMenuState.Main;
    }
  }
};

/**
 * Throw an item in the battle UI.
 */
uibattle.throwItem = function() {
  var selectedItem = itemmenu.itemSelectMenuUpdate();

  if (selectedItem != 0xFFFF) {
    if (selectedItem != 0) {
      Global.battle.UI.actionType = BattleAction.ThrowItem;
      Global.battle.UI.objectID = selectedItem;

      if (GameData.object[selectedItem].item.flags & ItemFlag.ApplyToAll) {
        Global.battle.UI.state = BattleUIState.SelectTargetEnemyAll;
      } else {
        Global.battle.UI.selectedIndex = Global.battle.UI.prevEnemyTarget;
        Global.battle.UI.state = BattleUIState.SelectTargetEnemy;
      }
    } else {
      Global.battle.UI.menuState = BattleMenuState.Main;
    }
  }
};

/**
 * Pick a magic for the specified player for automatic usage.
 * @param  {Number} playerRole  the player role ID.
 * @param  {Number} randomRange the range of the magic power.
 * @return {Number}             The object ID of the selected magic. 0 for physical attack.
 */
uibattle.pickAutoMagic = function(playerRole, randomRange) {
  var maxPower = 0;
  if (Global.playerStatus[playerRole][PlayerStatus.Silence] != 0) {
    return 0;
  }

  var magic = 0;
  for (var i = 0; i < Const.MAX_PLAYER_MAGICS; i++) {
    var w = GameData.playerRoles.magic[i][playerRole];
    if (w == 0) {
      continue;
    }

    var magicNum = GameData.object[w].magic.magicNumber;

    // skip if the magic is an ultimate move or not enough MP
    if (GameData.magic[magicNum].costMP == 1 ||
        GameData.magic[magicNum].costMP > GameData.playerRoles.MP[playerRole] ||
        SHORT(GameData.magic[magicNum].baseDamage) <= 0) {
      continue;
    }

    var power = SHORT(GameData.magic[magicNum].baseDamage) + randomLong(0, randomRange);

    if (power > maxPower) {
      maxPower = power
      magic = w;
    }
  }

  return magic;
};

/**
 * Update the status of battle UI.
 */
uibattle.update = function() {

};

/**
 * Show a number on battle screen (indicates HP/MP change).
 * @param  {Number} num     number to be shown.
 * @param  {POS} pos        position of the number on the screen.
 * @param  {NumColor} color color of the number.
 */
uibattle.showNum = function(num, pos, color) {
  var ss = Global.battle.UI.showNum;
  for (var i = 0; i < ss.length; ++i) {
    var sn = ss[i];
    if (sn.num == 0) {
      sn.num = num;
      sn.pos = PAL_XY(PAL_X(pos) - 15, PAL_Y(pos));
      sn.color = color;
      sn.time = hrtime();
      break;
    }
  }
};

export default uibattle;

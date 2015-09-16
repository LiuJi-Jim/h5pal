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

var ShowNum = function(num, pos, time, color) {
  /*
    WORD             wNum;
    PAL_POS          pos;
    DWORD            dwTime;
    NUMCOLOR         color;
  */
  this.num = num || 0;
  this.pos = pos || 0;
  this.time = time || 0;
  this.color = color || NumColor.Yellow;
};

var BattleUI = uibattle.BattleUI = function() {
  /*
    BATTLEUISTATE    state;
    BATTLEMENUSTATE  MenuState;

    CHAR             szMsg[256];           // message to be shown on the screen
    CHAR             szNextMsg[256];       // next message to be shown on the screen
    DWORD            dwMsgShowTime;        // the end time of showing the message
    WORD             wNextMsgDuration;     // duration of the next message

    WORD             wCurPlayerIndex;      // index of the current player
    WORD             wSelectedAction;      // current selected action
    WORD             wSelectedIndex;       // current selected index of player or enemy
    WORD             wPrevEnemyTarget;     // previous enemy target

    WORD             wActionType;          // type of action to be performed
    WORD             wObjectID;            // object ID of the item or magic to use

    BOOL             fAutoAttack;          // TRUE if auto attack

    SHOWNUM          rgShowNum[BATTLEUI_MAX_SHOWNUM];
  */
  this.state = BattleUIState.Wait;
  this.MenuState = BattleMenuState.Main;
  this.msg = utils.initArray(0, 256);
  this.nextMsg = utils.initArray(0, 256);
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

};

/**
 * Start the action selection menu of the specified player.
 * @param  {Number} playerIndex the player index.
 */
uibattle.playerReady = function(playerIndex) {

};

/**
 * Use an item in the battle UI.
 */
uibattle.useItem = function() {

};

/**
 * Throw an item in the battle UI.
 */
uibattle.throwItem = function() {

};

/**
 * Pick a magic for the specified player for automatic usage.
 * @param  {Number} playerRole  the player role ID.
 * @param  {Number} randomRange the range of the magic power.
 * @return {Number}             The object ID of the selected magic. 0 for physical attack.
 */
uibattle.pickAutoMagic = function(playerRole, randomRange) {

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

};

export default uibattle;

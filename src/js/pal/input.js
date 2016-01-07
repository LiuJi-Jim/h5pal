/**
 * 处理浏览器键盘输入的模块
 * @mixes utils.Events
 * @module input
 */

import utils from './utils';

log.trace('input module load');

var MIN_DEADZONE = -16384;
var MAX_DEADZONE = 16384;

var KeyCodes = {
  A: 65,
  B: 66,
  C: 67,
  D: 68,
  E: 69,
  F: 70,
  G: 71,
  H: 72,
  I: 73,
  J: 74,
  K: 75,
  L: 76,
  M: 77,
  N: 78,
  O: 79,
  P: 80,
  Q: 81,
  R: 82,
  S: 83,
  T: 84,
  U: 85,
  V: 86,
  W: 87,
  X: 88,
  Y: 89,
  Z: 90,

  KP0: 96,
  KP1: 97,
  KP2: 98,
  KP3: 99,
  KP4: 100,
  KP5: 101,
  KP6: 102,
  KP7: 103,
  KP8: 104,
  KP9: 105,

  ENTER: 13,
  RETURN: 13,
  CTRL: 17,
  ALT: 18,
  ESC: 27,
  ESCAPE: 27,
  SPACE: 32,

  PAGEUP: 33,
  PAGEDOWN: 34,

  LEFT: 37,
  UP: 38,
  RIGHT: 39,
  DOWN: 40,

  INSERT: 45
};

var KeyCodesToPalKeys = {
};

KeyCodesToPalKeys[KeyCodes.UP]       = KeyCodesToPalKeys[KeyCodes.KP8]    = Key.Up;
KeyCodesToPalKeys[KeyCodes.DOWN]     = KeyCodesToPalKeys[KeyCodes.KP2]    = Key.Down;
KeyCodesToPalKeys[KeyCodes.LEFT]     = KeyCodesToPalKeys[KeyCodes.KP4]    = Key.Left;
KeyCodesToPalKeys[KeyCodes.RIGHT]    = KeyCodesToPalKeys[KeyCodes.KP6]    = Key.Right;
KeyCodesToPalKeys[KeyCodes.ESCAPE]   = KeyCodesToPalKeys[KeyCodes.INSERT] = KeyCodesToPalKeys[KeyCodes.KP0]  = Key.Menu;
KeyCodesToPalKeys[KeyCodes.RETURN]   = KeyCodesToPalKeys[KeyCodes.SPACE]  = KeyCodesToPalKeys[KeyCodes.CTRL] = Key.Search;
KeyCodesToPalKeys[KeyCodes.PAGEUP]   = KeyCodesToPalKeys[KeyCodes.KP9]    = Key.PageUp;
KeyCodesToPalKeys[KeyCodes.PAGEDOWN] = KeyCodesToPalKeys[KeyCodes.KP3]    = Key.PageDown;
KeyCodesToPalKeys[KeyCodes.R] = Key.Repeat;
KeyCodesToPalKeys[KeyCodes.A] = Key.Auto;
KeyCodesToPalKeys[KeyCodes.D] = Key.Defend;
KeyCodesToPalKeys[KeyCodes.E] = Key.UseItem;
KeyCodesToPalKeys[KeyCodes.W] = Key.ThrowItem;
KeyCodesToPalKeys[KeyCodes.Q] = Key.Flee;
KeyCodesToPalKeys[KeyCodes.S] = Key.Status;
KeyCodesToPalKeys[KeyCodes.F] = Key.Force;
var PalKeysToPalDirs = {};
PalKeysToPalDirs[Key.Up]    = Direction.North;
PalKeysToPalDirs[Key.Down]  = Direction.South;
PalKeysToPalDirs[Key.Left]  = Direction.West;
PalKeysToPalDirs[Key.Right] = Direction.East;

var input = {
  /**
   * 当前按下的键
   * @type {Key}
   */
  keyPress: 0
};

utils.extend(input, utils.Events);

function keyboardEventFilter(evt) {
  var processed = false;
  var keyCode = evt.keyCode;
  if (keyCode in KeyCodesToPalKeys) {
    processed = true;
    var palKey = KeyCodesToPalKeys[keyCode];
    log.trace('[INPUT] %s %d %d', evt.type, keyCode, palKey);
    switch (evt.type) {
      case 'keydown':
        // Pressed a key
        input.keyPress |= palKey;
        if (palKey in PalKeysToPalDirs){
          if (input.dir !== PalKeysToPalDirs[palKey]) {
            input.prevDir = (Global.inBattle ? Direction.Unknown : input.dir);
            input.dir = PalKeysToPalDirs[palKey];
            log.trace('[INPUT] turn from %d to %d', input.prevDir, input.dir);
          }
        }
        /*
        switch (keyCode){
          case KeyCodes.UP:
          case KeyCodes.KP8:
             break;
          case KeyCodes.DOWN:
          case KeyCodes.KP2:
             break;
          case KeyCodes.LEFT:
          case KeyCodes.KP4:
             break;
          case KeyCodes.RIGHT:
          case KeyCodes.KP6:
             break;
          case KeyCodes.ESCAPE:
          case KeyCodes.INSERT:
          //case KeyCodes.ALT:
          case KeyCodes.KP0:
             break;
          case KeyCodes.RETURN:
          case KeyCodes.SPACE:
          case KeyCodes.CTRL:
             break;
          case KeyCodes.PAGEUP:
          case KeyCodes.KP9:
             break;
          case KeyCodes.PAGEDOWN:
          case KeyCodes.KP3:
             break;
          //case KeyCodes.7: //7 for mobile device
          case KeyCodes.R:
             break;
          //case KeyCodes.2: //2 for mobile device
          case KeyCodes.A:
             break;
          case KeyCodes.D:
             break;
          case KeyCodes.E:
             break;
          case KeyCodes.W:
             break;
          case KeyCodes.Q:
             break;
          case KeyCodes.S:
             break;
          case KeyCodes.F:
          //case KeyCodes.5: // 5 for mobile device
             break;
          //case KeyCodes.HASH: //# for mobile device
          case KeyCodes.P:
             //VIDEO_SaveScreenshot();
             break;
          default:
             break;
        }
        */
        break;
      case 'keyup':
        // Released a key
        input.keyPress &= ~palKey;
        if (palKey in PalKeysToPalDirs) {
          if (input.dir === PalKeysToPalDirs[palKey]) {
            log.trace('[INPUT] walking %d back to %d', input.dir, input.prevDir);
            input.dir = input.prevDir;
            input.prevDir = Direction.Unknown;
          } else if (input.prevDir === PalKeysToPalDirs[palKey]) {
            log.trace('[INPUT] cancel prev walking %d', input.prevDir);
            input.prevDir = Direction.Unknown;
          }
        }
        /*
        switch (evt.keyCode){
          case KeyCodes.UP:
          case KeyCodes.KP8:
            break;
          case KeyCodes.DOWN:
          case KeyCodes.KP2:
            break;
          case KeyCodes.LEFT:
          case KeyCodes.KP4:
            break;
          case KeyCodes.RIGHT:
          case KeyCodes.KP6:
            break;
          default:
            break;
        }
        */
        break;
    }
    if (processed) {
      evt.preventDefault();
      evt.stopPropagation();
      input.fire(evt.type, palKey);
    }
  }
}

/**
 * 初始化，并开启事件监听
 */
input.init = function() {
  log.debug('[INPUT] init')
  global.input = input;
  if (input.listening) return;
  input.dir = input.prevDir = Direction.Unknown;
  $(window).on('keydown keyup', keyboardEventFilter);
  input.listening = true;
};

/**
 * 判断某个键是否是按下状态
 * @param  {Key}  key
 * @return {Boolean}
 */
input.isKeyPressed = function(key) {
  return !!(input.keyPress & key);
};

/**
 * 重置
 */
input.clear = function() {
  input.keyPress = 0;
};

/**
 * 取消监听事件
 */
input.shutdown = function() {
  if (!input.listening) return;
  $(window).off('keydown keyup', keyboardEventFilter);
  input.listening = false;
};

/**
 * 等待一个按键
 * @return {Promise}
 */
input.waitForKey = function*(timeout) {
  input.clear();
  var endtime = hrtime() + timeout;
  while (timeout === 0 || hrtime() < endtime) {
    if (input.isKeyPressed(Key.Search | Key.Menu)) {
      break;
    }
    yield sleepByFrame(1);
  }
};

export default input;

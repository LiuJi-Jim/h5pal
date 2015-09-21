import utils from './utils';
import MKF from './MKF';
import RLE from './RLE';
import ajax from './ajax';
import font from './font';
import Sprite from './sprite';
import Palette from './palette';
import input from './input';

log.trace('text module load');

var AdditionalWords = [
  0xBE, 0xD4, 0xB0, 0xAB, 0xB3, 0x74, 0xAB, 0xD7, 0x00, 0x00, 0x00, // Battle Speed
  0xA4, 0x40, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, // 1
  0xA4, 0x47, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, // 2
  0xA4, 0x54, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, // 3
  0xA5, 0x7C, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, // 4
  0xA4, 0xAD, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00  // 5
];
/*
typedef struct tagTEXTLIB
{
 LPBYTE          lpWordBuf;
 LPBYTE          lpMsgBuf;
 LPDWORD         lpMsgOffset;

 int             nWords;
 int             nMsgs;

 int             nCurrentDialogLine;
 BYTE            bCurrentFontColor;
 PAL_POS         posIcon;
 PAL_POS         dialogTitlePos;
 PAL_POS         dialogTextPos;
 BYTE            bDialogPosition;
 BYTE            bIcon;
 int             iDelayTime;
 BOOL            fUserSkip;
 BOOL            fPlayingRNG;

 BYTE            bufDialogIcons[282];
} TEXTLIB, *LPTEXTLIB;
*/

/**
 * text
 * @module
 */
var text = {
  updatedInBattle: false
};

var surface = null;
var WORD_LENGTH = 10;
var FontColor = {
  DEFAULT:  0x4F,
  YELLOW:   0x2D,
  RED:      0x1A,
  CYAN:     0x8D,
  CYAN_ALT: 0x8C
};
var ui = null;

function trim(buf) {
  var head = 0, tail = 0, space = ' '.charCodeAt(0);
  while (head < buf.length && buf[head] == 0 || buf[head] == space) {
    head++;
  }
  tail = head;
  while (tail < buf.length && buf[tail] != 0 && buf[tail] != space) {
    tail++;
  }
  return buf.slice(head, tail);
}
var textLib = {};

text.init = function*(surf, _ui) {
  log.debug('[UI] init text');
  ui = _ui;
  global.text = text;
  surface = surf;
  yield font.init(surf);
  var list = yield ajax.load('m.msg', 'word.dat');
  var msgBuf = new Uint8Array(list[0]), wordBuf = new Uint8Array(list[1]);
  // Each word has 10 bytes
  var wordCount = ~~((wordBuf.length + (WORD_LENGTH - 1)) / WORD_LENGTH);
  textLib = {
    msgBuf: msgBuf,
    wordBuf: wordBuf,
    wordCount: wordCount,
    wordCache: {},
    msgCache: {}/*,
    words: new Array(wordCount)*/
  };
  yield ajax.loadMKF('SSS', 'DATA', 'RGM');
  // Read the message offsets. The message offsets are in SSS.MKF #3
  var SSS = text.SSS = ajax.MKF.SSS;
  var DATA = text.DATA = ajax.MKF.DATA;
  var RGM = text.RGM = ajax.MKF.RGM;
  var chunkSSS = SSS.readChunk(3);
  var msgOffset = textLib.msgOffset = new Uint32Array(chunkSSS.buffer, chunkSSS.byteOffset, chunkSSS.byteLength / 4);
  var msgCount = textLib.msgCount = msgOffset.length - 1;
  // Read the messages.
  textLib.currentFontColor = FontColor.DEFAULT;
  textLib.icon = 0;
  textLib.posIcon = 0;
  textLib.currentDialogLine = 0;
  textLib.delayTime = 1800; // 原3
  textLib.dialogTitlePos = PAL_XY(12, 8);
  textLib.dialogTextPos = PAL_XY(44, 26);
  textLib.dialogPosition = DialogPosition.Upper;
  textLib.userSkip = false;

  textLib.dialogIconsBuf = DATA.readChunk(12);
  textLib.dialogIcons = new Sprite(textLib.dialogIconsBuf);

  ui.getWord = function(wordNum) {
    var buf = [],
        cache = textLib.wordCache;
    if (wordNum in cache) {
      return cache[wordNum];
    }
    if (wordNum >= Const.PAL_ADDITIONAL_WORD_FIRST) {
      return AdditionalWords[wordNum - Const.PAL_ADDITIONAL_WORD_FIRST];
    }
    if (wordNum >= textLib.wordCount) {
      return [];
    }

    for (var i=0,offset=wordNum*WORD_LENGTH; i<WORD_LENGTH; ++i) {
      var b = textLib.wordBuf[i+offset];
      buf.push(b);
    }
    buf = trim(buf);

    return (cache[wordNum] = buf);
  };

  ui.getMsg = function(msgNum) {
    var cache = textLib.msgCache;
    if (msgNum in cache) {
      return cache[msgNum];
    }
    if (msgNum > textLib.msgCount) {
      return [];
    }
    var offset = textLib.msgOffset[msgNum],
        size = textLib.msgOffset[msgNum + 1] - offset;
    var buf = new Uint8Array(size);
    for (var i=0; i<size; ++i) {
      var b = textLib.msgBuf[offset + i];
      buf[i] = b;
    }

    return (cache[msgNum] = buf);
  };

  /**
   * Draw text on the screen.
   * @param  {Uint8Array} buf
   * @param  {POS} pos
   * @param  {Color} color
   * @param  {Boolean} shadow
   * @param  {Boolean} update
   */
  ui.drawText = function(buf, pos, color, shadow, update) {
    var rect = {
      x: PAL_X(pos), y: PAL_Y(pos)
    };
    log.trace('[TEXT] drawText(%d, %d, %d)', buf.length, rect.x, rect.y);
    var urect = {
      x: rect.x, y: rect.y,
      h: 16, w: 0
    };
    var reader = new BinaryReader(buf);
    for (var i=0,len=buf.length; i<len; ) {
      // Draw the character
      var val = buf[i];
      if (val & 0x80) {
        // BIG-5 Chinese Character
        var ch = reader.getWORD(i); //(buf[i] | (buf[i+1]<<8));
        if (shadow) {
          font.drawChar(ch, PAL_XY(rect.x + 1, rect.y + 1), 0);
          font.drawChar(ch, PAL_XY(rect.x + 1, rect.y), 0);
        }
        font.drawChar(ch, PAL_XY(rect.x, rect.y), color);
        i += 2;
        rect.x += 16;
        urect.w += 16;
      } else {
        // ASCII character
        var ch = buf[i];
        if (shadow) {
          font.drawASCIIChar(ch, PAL_XY(rect.x + 1, rect.y + 1), 0);
          font.drawASCIIChar(ch, PAL_XY(rect.x + 1, rect.y), 0);
        }
        font.drawASCIIChar(ch, PAL_XY(rect.x, rect.y), color);
        i++;
        rect.x += 8;
        urect.w += 8;
      }
    }

    // Update the screen area
    if (update && urect.w > 0) {
      //VIDEO_UpdateScreen(&urect);
      surface.updateScreen(urect);
    }
  },
  /**
   * Set the delay time for dialog.
   * @param {int} delay
   */
  ui.setDialogDelayTime = function(delay) {
    textLib.delayTime = delay;
  };

  /**
   * Start a new dialog.
   * @param  {DialogPosition} location
   * @param  {FontColor} color
   * @param  {int} charFaceNum
   * @param  {Boolean} playingRNG
   * @return {Promise}
   */
  ui.startDialog = function(location, color, charFaceNum, playingRNG) {
    log.trace('[TEXT] startDialog(%d, %d, %d, %d)', location, color, charFaceNum, playingRNG);
    var rect = RECT(0, 0, 0, 0);

    if (Global.inBattle && !text.updatedInBattle) {
      // Update the screen in battle, or the graphics may seem messed up
      surface.updateScreen(null);
      text.updatedInBattle = true;
    }

    textLib.icon = 0;
    textLib.posIcon = 0;
    textLib.currentDialogLine = 0;
    textLib.dialogTitlePos = PAL_XY(12, 8);
    textLib.userSkip = false;

    if (color != 0) {
      textLib.currentFontColor = color;
    }

    if (playingRNG && charFaceNum) {
      surface.backupScreen();
      textLib.playingRNG = true;
    }

    switch (location) {
      case DialogPosition.Upper:
        if (charFaceNum > 0) {
          // Display the character face at the upper part of the screen
          var buf = RLE(text.RGM.readChunk(charFaceNum));
          if (buf) {
            rect.w = buf.width;
            rect.h = buf.height;
            rect.x = 48 - ~~(rect.w / 2);
            rect.y = 55 - ~~(rect.h / 2);

            if (rect.x < 0) {
               rect.x = 0;
            }
            if (rect.y < 0) {
               rect.y = 0;
            }

            surface.blitRLE(buf, PAL_XY(rect.x, rect.y));
            surface.updateScreen(rect);
          }
        }
        textLib.dialogTitlePos = PAL_XY(charFaceNum > 0 ? 80 : 12, 8);
        textLib.dialogTextPos = PAL_XY(charFaceNum > 0 ? 96 : 44, 26);
        break;
      case DialogPosition.Center:
        textLib.dialogTextPos = PAL_XY(80, 40);
        break;
      case DialogPosition.Lower:
        if (charFaceNum > 0) {
          // Display the character face at the lower part of the screen
          var buf = RLE(text.RGM.readChunk(charFaceNum));
          if (buf) {
            rect.x = 270 - ~~(buf.width / 2);
            rect.y = 144 - ~~(buf.height / 2);
            rect.w = buf.width;
            rect.h = buf.height;

            surface.blitRLE(buf, PAL_XY(rect.x, rect.y));
            surface.updateScreen(rect);
          }
        }
        textLib.dialogTitlePos = PAL_XY(charFaceNum > 0 ? 4 : 12, 108);
        textLib.dialogTextPos = PAL_XY(charFaceNum > 0 ? 20 : 44, 126);
        break;
      case DialogPosition.CenterWindow:
        textLib.dialogTextPos = PAL_XY(160, 40);
        break;
    }

    textLib.dialogPosition = location;
  };

  /**
   * 对话框等待按键（快速跳过）
   * @return {Promise}
   */
  ui.dialogWaitForKey = function*() {
    log.trace('[TEXT] dialogWaitForKey');
    // get the current palette
    //var palette = utils.arrClone(Global.palette);
    var palette = utils.arrClone(Palette.get(Global.numPalette, Global.nightPalette));
    var isCenter = (textLib.dialogPosition !== DialogPosition.CenterWindow &&
                    textLib.dialogPosition !== DialogPosition.Center);

    //surface.setPalette(palette);

    if (textLib.dialogPosition !== DialogPosition.CenterWindow &&
        textLib.dialogPosition !== DialogPosition.Center) {
      // show the icon
      var p = textLib.dialogIcons.frames[textLib.icon];
      var rect = RECT(
        PAL_X(textLib.posIcon),
        PAL_Y(textLib.posIcon),
        p.width,
        p.height
      );
      if (p) {
        surface.blitRLE(p, textLib.posIcon);
        surface.updateScreen(null);
      }
    }

    input.clear();

    while (true) {
      yield sleep(100);
      if (textLib.dialogPosition !== DialogPosition.CenterWindow &&
          textLib.dialogPosition !== DialogPosition.Center) {
        // palette shift
        var t = palette[0xF9];
        for (i = 0xF9; i < 0xFE; i++) {
           palette[i] = palette[i + 1];
        }
        palette[0xFE] = t;
        surface.setPalette(palette);
      }
      if (input.keyPress !== 0) {
        break;
      }
    }

    if (textLib.dialogPosition !== DialogPosition.CenterWindow &&
        textLib.dialogPosition !== DialogPosition.Center) {
      surface.setPalette(Palette.get(Global.numPalette, Global.nightPalette));
    }
    input.clear();
    textLib.userSkip = false;
  };

  /**
   * Show one line of the dialog text.
   * @param  {Uint8Array} buf
   * @return {Promise}
   */
  ui.showDialogText = function*(buf) {
    var len = buf.length;
    log.trace('[TEXT] showDialogText (%d)', len);

    input.clear();
    textLib.icon = 0;

    if (Global.inBattle && !text.updatedInBattle) {
      // Update the screen in battle, or the graphics may seem messed up
      //VIDEO_UpdateScreen(NULL);
      surface.updateScreen(null);
      text.updatedInBattle = true;
    }

    if (textLib.currentDialogLine > 3) {
      // The rest dialogs should be shown in the next page.
      yield ui.dialogWaitForKey();
      textLib.currentDialogLine = 0;
      //VIDEO_RestoreScreen();
      //VIDEO_UpdateScreen(NULL);
      surface.restoreScreen();
      surface.updateScreen(null);
    }
    var x = PAL_X(textLib.dialogTextPos);
    var y = PAL_Y(textLib.dialogTextPos) + textLib.currentDialogLine * 18;

    if (textLib.dialogPosition == DialogPosition.CenterWindow) {
      // The text should be shown in a small window at the center of the screen
      if (PAL_CLASSIC) {
        if (Global.inBattle && Global.battle.battleResult == BattleResult.OnGoing) {
          // uibattle.showText(buf, 1400);
        }
      }

      // Create the window box
      var pos = PAL_XY(PAL_X(textLib.dialogTextPos) - len * 4, PAL_Y(textLib.dialogTextPos));
      var box = ui.createSingleLineBox(pos, ~~((len + 1) / 2), true);
      var rect = new RECT(
        PAL_X(pos),
        PAL_Y(pos),
        320 - PAL_X(pos) * 2 + 32,
        64
      );

      // Show the text on the screen
      pos = PAL_XY(PAL_X(pos) + 8 + ((len & 1) << 2), PAL_Y(pos) + 10);
      ui.drawText(buf, pos, 0, false, false);
      //PAL_DrawText(lpszText, pos, 0, FALSE, FALSE);
      surface.updateScreen(rect);

      yield ui.dialogWaitForKey();

      // Delete the box
      box.free();
      //VIDEO_UpdateScreen(&rect);
      surface.updateScreen(rect);

      //PAL_EndDialog();
      yield ui.endDialog();
    } else {
      if (textLib.currentDialogLine == 0 &&
          textLib.dialogPosition != DialogPosition.Center &&
          buf[len - 1] == 0x47 && buf[len - 2] == 0xA1) {
        // name of character
        //PAL_DrawText(lpszText, g_TextLib.posDialogTitle, FONT_COLOR_CYAN_ALT, TRUE, TRUE);
        ui.drawText(buf, textLib.dialogTitlePos, FontColor.CYAN_ALT, true, true);
      } else {
        // normal texts
        var texts = [];
        if (!textLib.playingRNG && textLib.currentDialogLine == 0) {
          // Save the screen before we show the first line of dialog
          surface.backupScreen();
        }
        var offset = 0;
        while (offset < len && buf[offset] !== '\0') {
          var ch = buf[offset];
          switch (ch) {
            case '-'.charCodeAt(0):
              // Set the font color to Cyan
              if (textLib.currentFontColor == FontColor.CYAN) {
                textLib.currentFontColor = FontColor.DEFAULT;
              } else {
                textLib.currentFontColor = FontColor.CYAN;
              }
              offset++;
              break;
            case '\''.charCodeAt(0):
              // Set the font color to Red
              if (textLib.currentFontColor == FontColor.RED) {
                textLib.currentFontColor = FontColor.DEFAULT;
              } else {
                textLib.currentFontColor = FontColor.RED;
              }
              offset++;
              break;
            case '"'.charCodeAt(0):
              // Set the font color to Yellow
              if (textLib.currentFontColor == FontColor.YELLOW) {
                textLib.currentFontColor = FontColor.DEFAULT;
              } else {
                textLib.currentFontColor = FontColor.YELLOW;
              }
              offset++;
              break;
            case '$'.charCodeAt(0):
              // Set the delay time of text-displaying
              //g_TextLib.iDelayTime = atoi(lpszText + 1) * 10 / 7;
              var num = String.fromCharCode(buf[offset + 1]) + String.fromCharCode(buf[offset + 2]);
              textLib.delayTime = ~~(parseInt(num) * 10 / 7);
              offset += 3;
              break;
            case '~'.charCodeAt(0):
              // Delay for a period and quit
              //UTIL_Delay(atoi(lpszText + 1) * 80 / 7);
              var num = String.fromCharCode(buf[offset + 1]) + String.fromCharCode(buf[offset + 2]);
              yield sleep(parseInt(num) * 80 / 7);
              textLib.currentDialogLine = 0;
              textLib.userSkip = false;
              return; // don't go further
            case ')'.charCodeAt(0):
              // Set the waiting icon
              textLib.icon = 1;
              offset++;
              break;
            case '('.charCodeAt(0):
              // Set the waiting icon
              textLib.icon = 2;
              offset++;
              break;
            case '\\':
              offset++;
              // pass through
            default:
              if (ch & 0x80) {
                texts = [buf[offset], buf[offset + 1],];
                offset += 2;
              } else {
                texts = [buf[offset]];
                offset++;
              }
              ui.drawText(texts, PAL_XY(x, y), textLib.currentFontColor, true, true);
              x += (texts[0] & 0x80) ? 16 : 8;
              if (!textLib.userSkip) {
                input.clear();
                yield sleep(textLib.delayTime * 8);
                if (input.keyPress & (Key.Search | Key.Menu)) {
                  // User pressed a key to skip the dialog
                  textLib.userSkip = true;
                }
              }
            }
        }
        textLib.posIcon = PAL_XY(x, y);
        textLib.currentDialogLine++;
      }
    }
  };

  /**
   * Clear the state of the dialog.
   * @param  {Boolean} waitForKey
   * @return {Promise}
   */
  ui.clearDialog = function*(waitForKey) {
    log.trace('[TEXT] clearDialog('+!!(waitForKey)+')')
    if (textLib.currentDialogLine> 0 && waitForKey) {
      yield ui.dialogWaitForKey();
    }

    textLib.currentDialogLine = 0;

    if (textLib.dialogPosition === DialogPosition.Center) {
      textLib.dialogTitlePos = PAL_XY(12, 8);
      textLib.dialogTextPos = PAL_XY(44, 26);
      textLib.currentFontColor = FontColor.DEFAULT;
      textLib.dialogPosition = DialogPosition.Upper;
    }
  };

  /**
   * Ends a dialog.
   * @return {Promise}
   */
  ui.endDialog = function*() {
    log.trace('[TEXT] endDialog');
    yield ui.clearDialog(true);
    textLib.dialogTitlePos = PAL_XY(12, 8);
    textLib.dialogTextPos = PAL_XY(44, 26);
    textLib.currentFontColor = FontColor.DEFAULT;
    textLib.dialogPosition = DialogPosition.Upper;
    textLib.userSkip = false;
    textLib.playingRNG = false;
  };

  /**
   * Check if there are dialog texts on the screen.
   * @return {Boolean} true if there are dialog texts on the screen, false if not.
   */
  ui.isInDialog = function() {
    return (textLib.currentDialogLine !== 0);
  };

  /**
   * Check if the script used the RNG playing parameter when displaying texts.
   * @return {Boolean} true if the script used the RNG playing parameter, false if not.
   */
  ui.dialogIsPlayingRNG = function() {
    return textLib.playingRNG;
  };
};

export default text;

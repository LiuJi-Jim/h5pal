/**
 * UI
 * @module
 */

import utils from './utils';
import Sprite from './Sprite';
import ajax from './ajax';
import input from './input';
import text from './text';
import uigame from './uigame';
import itemmenu from './itemmenu';
import magicmenu from './magicmenu';

log.trace('ui module load');

var ui = {
  data: null,
  sprite: null,
  destDict: {}
};
var surface = null;

/**
 * 初始化
 * @memberof ui
 * @param  {Surface} surf
 * @return {Promise}
 */
ui.init = function*(surf) {
  log.debug('[UI] init');
  global.ui = ui;
  surface = surf;
  var mkfs = yield ajax.loadMKF('DATA', 'FBP');
  var data = ui.data = ajax.MKF.DATA;
  ui.sprite = new Sprite(data.readChunk(ui.CHUNKNUM_SPRITEUI));
  initNumColors();

  yield text.init(surf, ui);
  yield itemmenu.init(surf, ui);
  yield magicmenu.init(surf, ui);
  yield uigame.init(surf, ui);
};

/**
 * 创建一个Box
 * @memberOf ui
 * @param  {POS} pos
 * @param  {int} rows
 * @param  {int} cols
 * @param  {int} style 0或1
 * @param  {Boolean} saveScreen
 * @return {Box}
 */
ui.createBox = function(pos, rows, cols, style, saveScreen) {
  var borderRLE = [],
      sprite = ui.sprite;
  // Get the bitmaps
  for (var i = 0; i < 3; i++) {
    var arr = borderRLE[i] = [];
    for (var j = 0; j < 3; j++) {
       //rglpBorderBitmap[i][j] = PAL_SpriteGetFrame(gpSpriteUI, i * 3 + j + iStyle * 9);
       //arr[j] = PAL_SpriteGetFrame(spriteBuf, i * 3 + j + style * 9);
       arr[j] = sprite.frames[i * 3 + j + style * 9];
    }
  }

  var rect = RECT(PAL_X(pos), PAL_Y(pos), 0, 0);

  // Get the total width and total height of the box
  for (var i = 0; i < 3; i++) {
    if (i == 1){
       rect.w += borderRLE[0][i].width * cols;
       rect.h += borderRLE[i][0].height * rows;
    } else {
       rect.w += borderRLE[0][i].width;
       rect.h += borderRLE[i][0].height;
    }
  }
  var box = new Box(rect.x, rect.y, rect.w, rect.h);
  if (saveScreen) {
    // Save the used part of the screen
    box.save();
  }

  // Border takes 2 additional rows and columns...
  rows += 2;
  cols += 2;

  // Draw the box
  for (var i=0; i<rows; ++i) {
    var x = rect.x,
        m = (i === 0) ? 0 : ((i == rows - 1) ? 2 : 1);

    for (var j=0; j<cols; ++j) {
      var n = (j === 0) ? 0 : ((j == cols - 1) ? 2 : 1);

      surface.blitRLE(borderRLE[m][n], PAL_XY(x, rect.y));
      x += borderRLE[m][n].width;
    }

    rect.y += borderRLE[m][0].height;
  }

  return box;
};

/**
 * 创建一个单行Box
 * @memberOf ui
 * @param  {POS} pos
 * @param  {int} len
 * @param  {Boolean} saveScreen
 * @return {Box}
 */
ui.createSingleLineBox = function(pos, len, saveScreen) {
  var leftSpriteNum  = 44,
      midSpriteNum   = 45,
      rightSpriteNum = 46,
      sprite = ui.sprite;
  // Get the bitmaps
  var leftSprite  = sprite.frames[leftSpriteNum],
      midSprite   = sprite.frames[midSpriteNum],
      rightSprite = sprite.frames[rightSpriteNum];

  var rect = RECT(PAL_X(pos), PAL_Y(pos), 0, 0);

  // Get the total width and total height of the box
  rect.w = leftSprite.width + rightSprite.width + midSprite.width * len;
  rect.h = leftSprite.height;

  var box = new Box(rect.x, rect.y, rect.w, rect.h);
  if (saveScreen) {
    // Save the used part of the screen
    box.save();
  }

  // Draw the box
  //PAL_RLEBlitToSurface(lpBitmapLeft, gpScreen, pos);
  surface.blitRLE(leftSprite, pos);

  rect.x += leftSprite.width;

  for (var i = 0; i < len; i++) {
    //PAL_RLEBlitToSurface(lpBitmapMid, gpScreen, PAL_XY(rect.x, rect.y));
    surface.blitRLE(midSprite, PAL_XY(rect.x, rect.y));
    rect.x += midSprite.width;
  }

  surface.blitRLE(rightSprite, PAL_XY(rect.x, rect.y));

  surface.updateScreen(box);

  return box;
};

/**
 * 绘制数字
 * @param  {int} num 数字
 * @param  {int} len 绘制长度
 * @param  {POS} pos
 * @param  {NumColor} color
 * @param  {NumAlign} align
 */
ui.drawNumber = function(num, len, pos, color, align) {
  // Get the bitmaps. Blue starts from 29, Cyan from 56, Yellow from 19.
  var frames = ui.numFrames[color];

  var i = num;
  var actualLen = 0;

  // Calculate the actual length of the number.
  while (i > 0) {
    i = ~~(i / 10);
    actualLen++;
  }
  if (actualLen > len) {
    actualLen = len;
  } else if (actualLen === 0) {
    actualLen = 1;
  }

  var x = PAL_X(pos) - 6;
  var y = PAL_Y(pos);

  switch (align) {
    case NumAlign.Left:
      x += 6 * actualLen;
      break;
    case NumAlign.Mid:
      x += 3 * (len + actualLen);
      break;
    case NumAlign.Right:
      x += 6 * len;
      break;
  }

  // Draw the number.
  while (actualLen-- > 0) {
    surface.blitRLE(frames[num % 10], PAL_XY(x, y));
    x -= 6;
    num = ~~(num / 10);
  }
};

/**
 * 绘制菜单项的文字
 * @param  {MenuItem} item
 * @param  {NumColor} color
 * @param  {Boolean} shadow
 * @param  {Boolean} update
 */
ui.drawItemText = function(item, color, shadow, update) {
  shadow = shadow | false;
  update = update | false;
  ui.drawText(
    ui.getWord(item.wordNum),
    item.pos, color, shadow, update
  );
};

/**
 * 读取菜单
 * @param  {Function} onchange
 * @param  {Menu[]} list
 * @param  {int} defaultItem
 * @param  {NumColor} labelColor
 * @param  {Boolean} nocancel
 * @return {Promise}
 */
ui.readMenu = function*(onchange, list, defaultItem, labelColor, nocancel) {
  onchange = onchange || noop;
  defaultItem = defaultItem || 0;
  if (defaultItem < 0) defaultItem = 0;
  var currentItem = (defaultItem < list.length ? defaultItem : 0);

  // Draw all the menu texts.
  for (var i=0; i<list.length; ++i) {
    var item = list[i],
        color = labelColor;
    if (!item.enabled) {
      if (i == currentItem) {
        color = ui.MENUITEM_COLOR_SELECTED_INACTIVE;
      } else {
        color = ui.MENUITEM_COLOR_INACTIVE;
      }
    }

    //PAL_DrawText(PAL_GetWord(rgMenuItem[i].wNumWord), rgMenuItem[i].pos, bColor, TRUE, TRUE);
    //defer.renderOnce(ui.drawItemText(item, color, true, true));
    ui.drawItemText(item, color, true, true);
  }

  onchange(list[defaultItem].value);

  input.clear();
  while (true) {
    //drawAllMenuTexts();
    //var key = yield input.waitForKey(Key.Up, Key.Down, Key.Left, Key.Right, Key.Menu, Key.Search);
    // Redraw the selected item if needed.
    var keyPress = input.keyPress,
        item = list[currentItem];
    if (item.enabled) {
      ui.drawItemText(item, ui.MENUITEM_COLOR_SELECTED, false, true);
    }

    // pal.input.processEvent();
    if (keyPress & (Key.Down | Key.Right)) {
      // User pressed the down or right arrow key
      if (item.enabled) {
        // Dehighlight the unselected item.
        ui.drawItemText(item, labelColor, false, true);
      } else {
        ui.drawItemText(item, ui.MENUITEM_COLOR_INACTIVE, false, true);
      }
      currentItem++;
      if (currentItem >= list.length){
        currentItem = 0;
      }
      item = list[currentItem];

      // Highlight the selected item.
      if (item.enabled) {
        ui.drawItemText(item, ui.MENUITEM_COLOR_SELECTED, false, true);
      } else {
        ui.drawItemText(item, ui.MENUITEM_COLOR_SELECTED_INACTIVE, false, true);
      }
      onchange(item.value);
      input.clear();
    }else if (keyPress & (Key.Up | Key.Left)){
      // User pressed the up or left arrow key
      if (item.enabled){
        // Dehighlight the unselected item.
        ui.drawItemText(item, labelColor, false, true);
      }else{
        ui.drawItemText(item, ui.MENUITEM_COLOR_INACTIVE, false, true);
      }

      currentItem--;
      if (currentItem < 0) {
        currentItem = list.length - 1;
      }
      item = list[currentItem];

      // Highlight the selected item.
      if (item.enabled) {
        ui.drawItemText(item, ui.MENUITEM_COLOR_SELECTED, false, true);
      } else {
        ui.drawItemText(item, ui.MENUITEM_COLOR_SELECTED_INACTIVE, false, true);
      }
      onchange(item.value);
      input.clear();
    } else if (keyPress & Key.Menu) {
      input.clear();
      if (!nocancel) {
        // User cancelled
        if (item.enabled) {
          ui.drawItemText(item, labelColor, false, true);
        } else {
          ui.drawItemText(item, ui.MENUITEM_COLOR_INACTIVE, false, true);
        }
        //defer.returnValue = ui.MENUITEM_VALUE_CANCELLED;
        return ui.MENUITEM_VALUE_CANCELLED;
      }
    }else if (keyPress & Key.Search) {
      // User pressed Enter
      input.clear();
      if (item.enabled) {
        ui.drawItemText(item, ui.MENUITEM_COLOR_CONFIRMED, false, true);
        //defer.returnValue = item.value;
        //defer.resolve(item.value);
        return item.value;
      }
    }

    yield sleepByFrame(1);
  }
};
ui.loadObjectDesc = function*(filename) {
  //FILE                      *fp;
  //PAL_LARGE char             buf[512];
  //char                      *p;
  //LPOBJECTDESC               lpDesc = NULL, pNew = NULL;
  //unsigned int               i;
  var arraybuffer = (yield ajax.load(filename))[0];
  var file = new Uint8Array(arraybuffer);
  var list = [],
      nl = '\n'.charCodeAt(0),
      eq = '='.charCodeAt(0);
  var start = 0;
  for (var i=0; i<file.length; ++i) {
    var b = file[i];
    if (b == nl) {
      list.push(file.subarray(start, i - 1));
      start = i + 1;
      i++;
    }
  }
  var result = [];
  list.forEach(function(line) {
    var p = [].indexOf.call(line, eq);
    var str = [].join.call(line, ',');
    if (p >= 0){
      var hexlen = 0, id = '';
      for (; hexlen < p; ++hexlen) {
        var ch = String.fromCharCode(line[hexlen]);
        if ((/[0-9a-f]/).test(ch)){
          id += ch;
        }else{
          break;
        }
      }
      id = parseInt(id, 16);
      var desc = line.subarray(p + 1);
      // 这里存疑，应该从等号开始切，还是从括号开始？
      result.push(new ObjectDesc(id, desc));
    }
  })
  return result;
/*
  // Load the description data
  while (fgets(buf, 512, fp) != NULL)
  {
    p = strchr(buf, '=');
    if (p == NULL)
    {
      continue;
    }

    *p = '\0';
    p++;

    pNew = UTIL_calloc(1, sizeof(OBJECTDESC));

    sscanf(buf, "%x", &i);
    pNew->wObjectID = i;
    pNew->lpDesc = strdup(p);

    pNew->next = lpDesc;
    lpDesc = pNew;
  }

  fclose(fp);
  return lpDesc;*/
};

ui.getObjectDesc = function(list, id) {
  for (var i=0; i<list.length; ++i) {
    var it = list[i];
    if (it.id === id) return it;
  }
  return null;
};

utils.extend(ui, {
  CHUNKNUM_SPRITEUI: 9,

  MENUITEM_VALUE_CANCELLED: 0xff,
  MENUITEM_COLOR: 0x4F,
  MENUITEM_COLOR_INACTIVE: 0x1C,
  MENUITEM_COLOR_CONFIRMED: 0x2C,
  MENUITEM_COLOR_SELECTED_INACTIVE: 0x1F,
  MENUITEM_COLOR_SELECTED_FIRST: 0xF9,
  MENUITEM_COLOR_SELECTED_TOTALNUM: 6,

  MENUITEM_COLOR_EQUIPPEDITEM: 0xC8,

  DESCTEXT_COLOR: 0x2E,

  MAINMENU_BACKGROUND_FBPNUM: 60,
  RIX_NUM_OPENINGMENU: 4,
  MAINMENU_LABEL_NEWGAME: 7,
  MAINMENU_LABEL_LOADGAME: 8,

  LOADMENU_LABEL_SLOT_FIRST: 43,

  CONFIRMMENU_LABEL_NO: 19,
  CONFIRMMENU_LABEL_YES: 20,

  CASH_LABEL: 21,

  SWITCHMENU_LABEL_DISABLE: 17,
  SWITCHMENU_LABEL_ENABLE: 18,

  GAMEMENU_LABEL_STATUS: 3,
  GAMEMENU_LABEL_MAGIC: 4,
  GAMEMENU_LABEL_INVENTORY: 5,
  GAMEMENU_LABEL_SYSTEM: 6,

  SYSMENU_LABEL_SAVE: 11,
  SYSMENU_LABEL_LOAD: 12,
  SYSMENU_LABEL_MUSIC: 13,
  SYSMENU_LABEL_SOUND: 14,
  SYSMENU_LABEL_QUIT: 15,
  SYSMENU_LABEL_BATTLEMODE: Const.PAL_ADDITIONAL_WORD_FIRST,

  BATTLESPEEDMENU_LABEL_1: Const.PAL_ADDITIONAL_WORD_FIRST + 1,
  BATTLESPEEDMENU_LABEL_2: Const.PAL_ADDITIONAL_WORD_FIRST + 2,
  BATTLESPEEDMENU_LABEL_3: Const.PAL_ADDITIONAL_WORD_FIRST + 3,
  BATTLESPEEDMENU_LABEL_4: Const.PAL_ADDITIONAL_WORD_FIRST + 4,
  BATTLESPEEDMENU_LABEL_5: Const.PAL_ADDITIONAL_WORD_FIRST + 5,

  INVMENU_LABEL_USE: 23,
  INVMENU_LABEL_EQUIP: 22,

  STATUS_BACKGROUND_FBPNUM: 0,
  STATUS_LABEL_EXP: 2,
  STATUS_LABEL_LEVEL: 48,
  STATUS_LABEL_HP: 49,
  STATUS_LABEL_MP: 50,
  STATUS_LABEL_ATTACKPOWER: 51,
  STATUS_LABEL_MAGICPOWER: 52,
  STATUS_LABEL_RESISTANCE: 53,
  STATUS_LABEL_DEXTERITY: 54,
  STATUS_LABEL_FLEERATE: 55,
  STATUS_COLOR_EQUIPMENT: 0xBE,

  BUYMENU_LABEL_CURRENT: 35,
  SELLMENU_LABEL_PRICE: 25,

  SPRITENUM_SLASH: 39,
  SPRITENUM_ITEMBOX: 70,
  SPRITENUM_CURSOR_YELLOW: 68,
  SPRITENUM_CURSOR: 69,
  SPRITENUM_PLAYERINFOBOX: 18,
  SPRITENUM_PLAYERFACE_FIRST: 48,

  EQUIPMENU_BACKGROUND_FBPNUM: 1,

  ITEMUSEMENU_COLOR_STATLABEL: 0xBB,

  BATTLEWIN_GETEXP_LABEL: 30,
  BATTLEWIN_BEATENEMY_LABEL: 9,
  BATTLEWIN_DOLLAR_LABEL: 10,
  BATTLEWIN_LEVELUP_LABEL: 32,
  BATTLEWIN_ADDMAGIC_LABEL: 33,
  BATTLEWIN_LEVELUP_LABEL_COLOR: 0x39,
  SPRITENUM_ARROW: 47,

  BATTLE_LABEL_ESCAPEFAIL: 31
});
Object.defineProperty(ui, 'MENUITEM_COLOR_SELECTED', {
  get: function(){
    return ~~(ui.MENUITEM_COLOR_SELECTED_FIRST + hrtime() / (600 / ui.MENUITEM_COLOR_SELECTED_TOTALNUM) % ui.MENUITEM_COLOR_SELECTED_TOTALNUM);
  }
});

/**
 * 菜单项
 * @constructor
 * @memberof ui
 * @param {int} val
 * @param {int} num
 * @param {Boolean} enabled
 * @param {POS} pos
 */
var MenuItem = ui.MenuItem = function(val, num, enabled, pos){
  /*
  WORD          wValue;
  WORD          wNumWord;
  BOOL          fEnabled;
  PAL_POS       pos;
  */
  this.value = val;
  this.wordNum = num;
  this.enabled = enabled;
  this.pos = pos;
};
MenuItem.size = 2+2+4+4;

/**
 * UI盒子
 * @constructor
 * @memberOf ui
 * @extends {Drawable}
 */
var Box = ui.Box = function(x, y, w, h){
  /*
  PAL_POS        pos;
  WORD           wWidth, wHeight
  SDL_Surface   *lpSavedArea;
  */
  this.x = x;
  this.y = y;
  this.pos = PAL_XY(x, y);
  this.w = w;
  this.h = h;
};
utils.extend(Box.prototype, {
  save: function() {
    this.saveData = surface.getRect(this.x, this.y, this.w, this.h);
  },
  free: function() {
    if (this.saveData) {
      // restore the surface
      surface.putRect(this.saveData, this.x, this.y);
      // Free the memory used by the box
      delete this.saveData;
    }
  }
})

/**
 * 物品描述
 * @constructor
 * @memberOf ui
 */
var ObjectDesc = ui.ObjectDesc = function(id, desc) {
  /*
  WORD                        wObjectID;
  LPSTR                       lpDesc;
  struct tagOBJECTDESC       *next;
  */
  this.id = id;
  this.desc = desc;
};

function initNumColors() {
  var map = {
    0: 29,
    1: 56,
    2: 19
  };
  ui.numFrames = {};
  for (var color in map) {
    var offset = map[color];
    var arr = ui.numFrames[color] = [];
    for (var i=0; i<10; ++i) {
      arr[i] = ui.sprite.frames[offset + i];
    }
  }
}

export default ui;

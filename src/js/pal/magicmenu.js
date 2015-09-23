import utils from './utils';
import input from './input';
import scene from './scene';
import uibattle from './uibattle';

log.trace('magicmenu module load');

var MagicItem = function() {
  this.reset();
};
MagicItem.prototype.reset = function(magic, mp, enabled) {
  this.magic = magic || 0;
  this.MP = mp || 0;
  this.enabled = enabled || false;
  return this;
};

var magicmenu = {
  playerMP: 0,
  currentItem: 0,
  magicNum: 0,
  magicItems: utils.initArray(MagicItem, Const.MAX_PLAYER_MAGICS)
};

var surface = null;
var ui = null;

magicmenu.init = function*(surf, _ui) {
  log.debug('[UI] init magicmenu');
  ui = _ui;
  global.magicmenu = ui.magicmenu = magicmenu;
  surface = surf;
};

/**
 * Update the magic selection menu.
 * @return {Number} The selected magic. 0 if cancelled, 0xFFFF if not confirmed.
 */
magicmenu.magicSelectMenuUpdate = function() {
  log.trace(['[UI] magicmenu magicSelectMenuUpdate'].join(' '));
  // Check for inputs
  if (input.isKeyPressed(Key.Up)) {
    magicmenu.currentItem -= 3;
  } else if (input.isKeyPressed(Key.Down)) {
    magicmenu.currentItem += 3;
  } else if (input.isKeyPressed(Key.Left)) {
    magicmenu.currentItem--;
  } else if (input.isKeyPressed(Key.Right)) {
    magicmenu.currentItem++;
  } else if (input.isKeyPressed(Key.PageUp)) {
    magicmenu.currentItem -= 3 * 5;
  } else if (input.isKeyPressed(Key.PageDown)) {
    magicmenu.currentItem += 3 * 5;
  } else if (input.isKeyPressed(Key.Menu)) {
    return 0;
  }

  // Make sure the current menu item index is in bound
  if (magicmenu.currentItem < 0) {
    magicmenu.currentItem = 0;
  } else if (magicmenu.currentItem >= magicmenu.magicNum) {
    magicmenu.currentItem = magicmenu.magicNum - 1;
  }

  // Create the box.
  ui.createBox(PAL_XY(10, 42), 4, 16, 1, false);

  if (!Global.objectDesc) {
    // Draw the cash amount.
    ui.createSingleLineBox(PAL_XY(0, 0), 5, false);
    ui.drawText(ui.getWord(ui.CASH_LABEL), PAL_XY(10, 10), 0, false, false);
    ui.drawNumber(Global.cash, 6, PAL_XY(49, 14), NumColor.Yellow, NumAlign.Right);

    // Draw the MP of the selected magic.
    ui.createSingleLineBox(PAL_XY(215, 0), 5, false);
    surface.blitRLE(
      ui.sprite.getFrame(ui.SPRITENUM_SLASH),
      PAL_XY(260, 14)
    );
    ui.drawNumber(
      magicmenu.magicItems[magicmenu.currentItem].MP, 4,
      PAL_XY(230, 14),
      NumColor.Yellow, NumAlign.Right
    );
    ui.drawNumber(magicmenu.playerMP, 4, PAL_XY(265, 14), NumColor.Cyan, NumAlign.Right);
  } else {
    var descObj = ui.getObjectDesc(Global.objectDesc, magicmenu.magicItems[magicmenu.currentItem].magic)
    // Draw the magic description.
    if (descObj) {
      var d = descObj.desc;
      var k = 3;
      var offset = 0;
      while (true) {
        var descBuf = [];
        var chStar = '*'.charCodeAt(0);
        for (; offset < d.byteLength; ++offset) {
          if (d[offset] == chStar) {
            ++offset;
            break;
          }
          descBuf.push(d[offset]);
        }
        ui.drawText(descBuf, PAL_XY(100, k), ui.DESCTEXT_COLOR, true, false);
        k += 16;
        if (offset >= d.byteLength) {
          break;
        }
      }
    }

    // Draw the MP of the selected magic.
    ui.createSingleLineBox(PAL_XY(0, 0), 5, false);
    surface.blitRLE(
      ui.sprite.getFrame(ui.SPRITENUM_SLASH),
      PAL_XY(45, 14)
    );
    ui.drawNumber(
      magicmenu.magicItems[magicmenu.currentItem].MP, 4,
      PAL_XY(15, 14),
      NumColor.Yellow, NumAlign.Right
    );
    ui.drawNumber(magicmenu.playerMP, 4, PAL_XY(50, 14), NumColor.Cyan, NumAlign.Right);
  }

  // Draw the texts of the current page
  var i = ~~(magicmenu.currentItem / 3) * 3 - 3 * 2;
  if (i < 0) {
    i = 0;
  }

  for (var j = 0; j < 5; j++) {
    for (var k = 0; k < 3; k++) {
      var color = ui.MENUITEM_COLOR;

      if (i >= magicmenu.magicNum) {
        // End of the list reached
        j = 5;
        break;
      }

      if (i == magicmenu.currentItem) {
        if (magicmenu.magicItems[i].enabled) {
          color = ui.MENUITEM_COLOR_SELECTED;
        } else {
          color = ui.MENUITEM_COLOR_SELECTED_INACTIVE;
        }
      } else if (!magicmenu.magicItems[i].enabled) {
        color = ui.MENUITEM_COLOR_INACTIVE;
      }

      // Draw the text
      ui.drawText(
        ui.getWord(magicmenu.magicItems[i].magic),
        PAL_XY(35 + k * 87, 54 + j * 18), color, true, false
      );

      // Draw the cursor on the current selected item
      if (i == magicmenu.currentItem) {
        surface.blitRLE(
          ui.sprite.getFrame(ui.SPRITENUM_CURSOR),
          PAL_XY(60 + k * 87, 64 + j * 18)
        );
      }

      i++;
    }
  }

  if (input.isKeyPressed(Key.Search)) {
    if (magicmenu.magicItems[magicmenu.currentItem].enabled) {
      var j = magicmenu.currentItem % 3;
      var k = (magicmenu.currentItem < 3 * 2) ? ~~(magicmenu.currentItem / 3) : 2;

      j = 35 + j * 87;
      k = 54 + k * 18;

      ui.drawText(
        ui.getWord(magicmenu.magicItems[magicmenu.currentItem].magic),
        PAL_XY(j, k),
        ui.MENUITEM_COLOR_CONFIRMED,
        false, true
      );

      return magicmenu.magicItems[magicmenu.currentItem].magic;
    }
  }

  return 0xFFFF;
};

/**
 * Initialize the magic selection menu.
 * @param  {Number}  playerRole   the player ID.
 * @param  {Boolean} inBattle     true if in battle, false if not.
 * @param  {Number}  defaultMagic the default magic item.
 */
magicmenu.magicSelectMenuInit = function(playerRole, inBattle, defaultMagic) {
  magicmenu.currentItem = 0;
  magicmenu.magicNum = 0;

  magicmenu.playerMP = GameData.playerRoles.MP[playerRole];

  // Put all magics of this player to the array
  for (i = 0; i < Const.MAX_PLAYER_MAGICS; i++) {
    var w = GameData.playerRoles.magic[i][playerRole];
    if (w != 0) {
      magicmenu.magicItems[magicmenu.magicNum].magic = w;

      w = GameData.object[w].magic.magicNumber;
      magicmenu.magicItems[magicmenu.magicNum].MP = GameData.magic[w].costMP;

      magicmenu.magicItems[magicmenu.magicNum].enabled = true;

      if (magicmenu.magicItems[magicmenu.magicNum].MP > magicmenu.playerMP) {
        magicmenu.magicItems[magicmenu.magicNum].enabled = false;
      }

      w = GameData.object[magicmenu.magicItems[magicmenu.magicNum].magic].magic.flags;
      if (inBattle) {
        if (!(w & MagicFlag.UsableInBattle)) {
          magicmenu.magicItems[magicmenu.magicNum].enabled = false;
        }
      } else {
        if (!(w & MagicFlag.UsableOutsideBattle)) {
          magicmenu.magicItems[magicmenu.magicNum].enabled = false;
        }
      }

      magicmenu.magicNum++;
    }
  }

  // Sort the array
  /*
  magicmenu.magicItems.sort(function(a, b) {
    return (a.magic - b.magic);
  });
  */
  for (var i = 0; i < magicmenu.magicNum - 1; i++) {
    var completed = true;

    for (var j = 0; j < magicmenu.magicNum - 1 - i; j++) {
      if (magicmenu.magicItems[j].magic > magicmenu.magicItems[j + 1].magic) {
        var t = magicmenu.magicItems[j];
        magicmenu.magicItems[j] = magicmenu.magicItems[j + 1];
        magicmenu.magicItems[j + 1] = t;

        completed = false;
      }
    }

    if (completed) {
      break;
    }
  }

  // Place the cursor to the default item
  for (var i = 0; i < magicmenu.magicNum; i++) {
    if (magicmenu.magicItems[i].magic == defaultMagic){
      magicmenu.currentItem = i;
      break;
    }
  }
};

/**
 * Show the magic selection menu.
 * @param  {Number}  playerRole   the player ID.
 * @param  {Boolean} inBattle     true if in battle, false if not.
 * @param  {Number}  defaultMagic the default magic item.
 */
magicmenu.magicSelectMenu = function*(playerRole, inBattle, defaultMagic) {
  magicmenu.magicSelectMenuInit(playerRole, inBattle, defaultMagic);
  input.clear();

  while (true) {
    yield scene.makeScene();

    var w = 45;

    for (var i = 0; i <= Global.maxPartyMemberIndex; i++) {
      uibattle.playerInfoBox(
        PAL_XY(w, 165),
        Global.party[i].playerRole,
        100,
        uibattle.TIMEMETER_COLOR_DEFAULT,
        false
      );
      w += 78;
    }

    w = magicmenu.magicSelectMenuUpdate();
    surface.updateScreen(null);

    input.clear();

    if (w != 0xFFFF) {
      return w;
    }

    yield sleepByFrame(1);
  }

  throw 'should not be here';
};

export default magicmenu;

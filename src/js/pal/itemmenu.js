import utils from './utils';
import input from './input';
import scene from './scene';

log.trace('itemmenu module load');

var itemmenu = {
  numInventory: 0,
  itemFlags: 0,
  noDesc: false
};

var surface = null;
var ui = null;

itemmenu.init = function*(surf, _ui) {
  log.debug('[UI] init itemmenu');
  ui = _ui;
  global.itemmenu = ui.itemmenu = itemmenu;
  surface = surf;
};

itemmenu.itemSelectMenuUpdate = function() {
  var prevImageIndex = 0xFFFF;
  // Process input
  if (input.isKeyPressed(Key.Up)) {
    Global.curInvMenuItem -= 3;
  } else if (input.isKeyPressed(Key.Down)) {
    Global.curInvMenuItem += 3;
  } else if (input.isKeyPressed(Key.Left)) {
    Global.curInvMenuItem--;
  } else if (input.isKeyPressed(Key.Right)) {
    Global.curInvMenuItem++;
  } else if (input.isKeyPressed(Key.PageUp)) {
    Global.curInvMenuItem -= 3 * 7;
  } else if (input.isKeyPressed(Key.PageDown)) {
    Global.curInvMenuItem += 3 * 7;
  } else if (input.isKeyPressed(Key.Menu)) {
    return 0;
  }

  // Make sure the current menu item index is in bound
  if (Global.curInvMenuItem >= itemmenu.numInventory) {
    Global.curInvMenuItem = itemmenu.numInventory - 1;
  }
  if (Global.curInvMenuItem < 0) {
    Global.curInvMenuItem = 0;
  }

  // Redraw the box
  ui.createBox(PAL_XY(2, 0), 6, 17, 1, false);

  // Draw the texts in the current page
  var i = ~~(Global.curInvMenuItem / 3) * 3 - 3 * 4;
  if (i < 0) {
    i = 0;
  }

  for (var j = 0; j < 7; j++) {
    for (var k = 0; k < 3; k++) {
      var object = Global.inventory[i].item;
      var color = ui.MENUITEM_COLOR;
      if (i >= Const.MAX_INVENTORY || object == 0) {
        // End of the list reached
        j = 7;
        break;
      }
      if (i == Global.curInvMenuItem) {
        if (!(GameData.object[object].item.flags & itemmenu.itemFlags) ||
            Global.inventory[i].amount <= Global.inventory[i].amountInUse) {
          // This item is not selectable
          color = ui.MENUITEM_COLOR_SELECTED_INACTIVE;
        } else {
          // This item is selectable
          if (Global.inventory[i].amount == 0) {
            color = ui.MENUITEM_COLOR_EQUIPPEDITEM;
          } else {
            color = ui.MENUITEM_COLOR_SELECTED;
          }
        }
      } else if (!(GameData.object[object].item.flags & itemmenu.itemFlags) ||
                 Global.inventory[i].amount <= Global.inventory[i].amountInUse) {
        // This item is not selectable
        color = ui.MENUITEM_COLOR_INACTIVE;
      } else if (Global.inventory[i].amount == 0) {
        color = ui.MENUITEM_COLOR_EQUIPPEDITEM;
      }
      // Draw the text
      ui.drawText(ui.getWord(object), PAL_XY(15 + k * 100, 12 + j * 18), color, true, false);
      // Draw the cursor on the current selected item
      if (i == Global.curInvMenuItem) {
        surface.blitRLE(ui.sprite.frames[ui.SPRITENUM_CURSOR], PAL_XY(40 + k * 100, 22 + j * 18));
      }
      // Draw the amount of this item
      if (Global.inventory[i].amount - Global.inventory[i].amountInUse > 1) {
        ui.drawNumber(
          Global.inventory[i].amount - Global.inventory[i].amountInUse,
          2,
          PAL_XY(96 + k * 100, 17 + j * 18),
          NumColor.Cyan,
          NumAlign.Right);
      }

      i++;
    }
  }

  // Draw the picture of current selected item
  surface.blitRLE(ui.sprite.frames[ui.SPRITENUM_ITEMBOX], PAL_XY(5, 140));

  var object = Global.inventory[Global.curInvMenuItem].item;

  if (GameData.object[object].item.bitmap != prevImageIndex) {
    var bufImage = Files.BALL.readChunk(GameData.object[object].item.bitmap);
    if (bufImage) {
      prevImageIndex = GameData.object[object].item.bitmap;
    } else {
      prevImageIndex = 0xFFFF;
    }
  }
  if (prevImageIndex != 0xFFFF) {
    surface.blitRLE(bufImage, PAL_XY(12, 148));
  }

  // Draw the description of the selected item
  if (!itemmenu.noDesc && Global.objectDesc != null){
    var descObj = ui.getObjectDesc(Global.objectDesc, object);
    if (descObj) {
      var d = descObj.desc;
      var k = 150;
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
        ui.drawText(descBuf, PAL_XY(75, k), ui.DESCTEXT_COLOR, true, false);
        k += 16;
        if (offset >= d.byteLength) {
          break;
        }
      }
    }
  }

  if (input.isKeyPressed(Key.Search)) {
    if ((GameData.object[object].item.flags & itemmenu.itemFlags) &&
        Global.inventory[Global.curInvMenuItem].amount >
        Global.inventory[Global.curInvMenuItem].amountInUse) {
      if (Global.inventory[Global.curInvMenuItem].amount > 0) {
        var j = (Global.curInvMenuItem < 3 * 4) ? ~~(Global.curInvMenuItem / 3) : 4;
        var k = Global.curInvMenuItem % 3;

        ui.drawText(ui.getWord(object), PAL_XY(15 + k * 100, 12 + j * 18),
           ui.MENUITEM_COLOR_CONFIRMED, false, false);
      }

      return object;
    }
  }

  return 0xFFFF;
};

itemmenu.itemSelectMenuInit = function(itemFlags) {
  itemmenu.itemFlags = itemFlags;

  // Compress the inventory
  script.compressInventory();
  // Count the total number of items in inventory
  itemmenu.numInventory = 0;
  while (itemmenu.numInventory < Const.MAX_INVENTORY &&
         Global.inventory[itemmenu.numInventory].item != 0) {
    itemmenu.numInventory++;
  }
  // Also add usable equipped items to the list
  if ((itemFlags & ItemFlag.Usable) && !Global.inBattle) {
    for (var i = 0; i <= Global.wMaxPartyMemberIndex; i++) {
      var w = Global.party[i].playerRole;
      for (var j = 0; j < Const.MAX_PLAYER_EQUIPMENTS; j++) {
        if (GameData.object[GameData.playerRoles.equipment[j][w]].item.flags & ItemFlag.Usable) {
          if (itemmenu.numInventory < Const.MAX_INVENTORY) {
            Global.inventory[itemmenu.numInventory].item = GameData.playerRoles.equipment[j][w];
            Global.inventory[itemmenu.numInventory].amount = 0;
            Global.inventory[itemmenu.numInventory].amountInUse = -1;
            itemmenu.numInventory++;
          }
        }
      }
    }
  }
};

itemmenu.itemSelectMenu = function*(onchange, itemFlags) {
  itemmenu.itemSelectMenuInit(itemFlags);
  var prevIndex = Global.curInvMenuItem;
  input.clear();
  if (onchange) {
    itemmenu.noDesc = true;
    onchange(Global.inventory[Global.curInvMenuItem].item);
  }
  while (true) {
    if (!onchange) {
       yield scene.makeScene();
    }
    var w = itemmenu.itemSelectMenuUpdate();
    surface.updateScreen(null);

    input.clear();

    //var start = timestamp();
    //while (timestamp() - start < FrameTime){
    //  if (input.isKeyPress != 0){
    //    break;
    //  }
    //  yield sleep(5);
    //}
    yield sleepByFrame(1);

    if (w != 0xFFFF) {
      itemmenu.noDesc = false;
      return w;
    }

    if (prevIndex != Global.curInvMenuItem) {
      if (Global.curInvMenuItem >= 0 && Global.curInvMenuItem < Const.MAX_INVENTORY) {
        if (onchange){
          onchange(Global.inventory[Global.curInvMenuItem].item);
        }
      }

      prevIndex = Global.curInvMenuItem;
    }
  }
  throw 'should not really reach here';
};

export default itemmenu;

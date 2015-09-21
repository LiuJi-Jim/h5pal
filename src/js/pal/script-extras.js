log.trace('script_extras module load');

var surface = null
var abs = Math.abs;
var floor = Math.floor;

var script_extras = {};
var script = null;

script_extras.init = function*(surf, _script) {
  log.debug('[SCRIPT] init extras');
  script = _script;
  surface = surf;

  script.updateEquipments = function*() {
    var playerRoles = GameData.playerRoles;
    memset(Global.equipmentEffect.uint8Array, 0, Global.equipmentEffect.uint8Array.length);
    for (var i=0; i<Const.MAX_PLAYER_ROLES; ++i) {
      for (var j=0; j<Const.MAX_PLAYER_EQUIPMENTS; ++j) {
        var w = playerRoles.equipment[j][i];
        if (w != 0) {
          var obj = GameData.object[w];
          obj.item.scriptOnEquip = yield script.runTriggerScript(obj.item.scriptOnEquip, i);
        }
      }
    }
  };

  script.removeEquipmentEffect = function(role, part) {
    var playerRoles = Global.equipmentEffect[part];
    var reader = new BinaryReader(playerRoles.uint8Array); // HACKHACK
    for (var i=0; i<PlayerRoles.size/(Const.MAX_PLAYER_ROLES*2); ++i) {
      var offset = (i * Const.MAX_PLAYER_ROLES + role) * 2;
      reader.setInt16(offset, 0);
    }
    // Reset some parameters to default when appropriate
    if (part == BodyPart.Hand) {
      // reset the dual attack status
      Global.playerStatus[role][PlayerStatus.DualAttack] = 0;
    } else if (part == BodyPart.Wear) {
      // Remove all poisons leveled 99
      for (var i = 0; i <= Global.maxPartyMemberIndex; i++) {
        if (Global.party[i].playerRole == role){
          role = i;
          break;
        }
      }

      if (i <= Global.maxPartyMemberIndex) {
        var j = 0;

        for (i = 0; i < Const.MAX_POISONS; i++) {
          var w = Global.poisonStatus[i][role].poisonID;

          if (w == 0) {
             break;
          }

          if (GameData.object[w].poison.poisonLevel < 99) {
            Global.poisonStatus[j][role] = Global.poisonStatus[i][role];
            j++;
          }
        }

        while (j < Const.MAX_POISONS) {
          Global.poisonStatus[j][role].poisonID = 0;
          Global.poisonStatus[j][role].poisonScript = 0;
          j++;
        }
      }
    }
  };

  script.setPlayerStatus = function(role, statusID, numRound) {
    if (PAL_CLASSIC) {
      if (statusID == PlayerStatus.Slow &&
          Global.playerStatus[role][PlayerStatus.Haste] > 0) {
        // Remove the haste status
        script.removePlayerStatus(role, PlayerStatus.Haste);
        return;
      }
      if (statusID == PlayerStatus.Haste &&
          Global.playerStatus[role][PlayerStatus.Slow] > 0) {
        // Remove the haste status
        script.removePlayerStatus(role, PlayerStatus.Slow);
        return;
      }
    }
    switch (statusID) {
      case PlayerStatus.Confused:
      case PlayerStatus.Sleep:
      case PlayerStatus.Silence:
      //ifdef PAL_CLASSIC
      case PlayerStatus.Paralyzed:
      //else
      case PlayerStatus.Slow:
      //endif
        // for "bad" statuses, don't set the status when we already have it
        if (GameData.playerRoles.HP[role] != 0 &&
            Global.playerStatus[role][statusID] == 0) {
          Global.playerStatus[role][statusID] = numRound;
        }
        break;
      case PlayerStatus.Puppet:
        // only allow dead players for "puppet" status
        if (GameData.playerRoles.HP[role] == 0 &&
            Global.playerStatus[role][statusID] < numRound) {
          Global.playerStatus[role][statusID] = numRound;
        }
        break;
      case PlayerStatus.Bravery:
      case PlayerStatus.Protect:
      case PlayerStatus.DualAttack:
      case PlayerStatus.Haste:
        // for "good" statuses, reset the status if the status to be set lasts longer
        if (GameData.playerRoles.HP[role] != 0 &&
            Global.playerStatus[role][statusID] < numRound) {
           Global.playerStatus[role][statusID] = numRound;
        }
        break;
      default:
        game.error('[SCRIPT] 未知statusID: %d', statusID);
        break;
    }
  };

  script.removePlayerStatus = function(role, statusID) {
    // Don't remove effects of equipments
    if (Global.playerStatus[role][statusID] <= 999) {
      Global.playerStatus[role][statusID] = 0;
    }
  };

  script.clearAllPlayerStatus = function() {
    for (var i = 0; i < Const.MAX_PLAYER_ROLES; ++i) {
      for (var j = 0; j < PlayerStatus.All; ++j) {
        // Don't remove effects of equipments
        if (Global.playerStatus[i][j] <= 999) {
          Global.playerStatus[i][j] = 0;
        }
      }
    }
  };

  script.addItemToInventory = function(objectID, num) {
    if (objectID == 0) {
      return false;
    }
    if (num == 0) {
      num = 1;
    }

    var index = 0;
    var found = false;
    var inventory = Global.inventory;
    // Search for the specified item in the inventory
    while (index < Const.MAX_INVENTORY) {
      if (inventory[index].item == objectID) {
        found = true;
        break;
      } else if (inventory[index].item == 0) {
         break;
      }
      index++;
    }

    if (num > 0) {
      // Add item
      if (index >= Const.MAX_INVENTORY) {
         // inventory is full. cannot add item
         return false;
      }

      if (found) {
        inventory[index].amount += num;
        if (inventory[index].amount > 99) {
          // Maximum number is 99
          inventory[index].amount = 99;
        }
      } else {
        inventory[index].item = objectID;
        if (num > 99) {
          num = 99;
        }
        inventory[index].amount = num;
      }
      return true;
    } else {
      // Remove item
      if (found) {
        num *= -1;
        if (inventory[index].amount < num) {
          // This item has been run out
          inventory[index].amount = 0;
          return false;
        }

        inventory[index].amount -= num;
        return true;
      }
      return false;
    }
  };

  script.getItemAmount = function(item) {
    var inventory = Global.inventory;
    for (var i=0; i<Const.MAX_INVENTORY; ++i) {
      var inv = inventory[i];
      if (inv.item === 0) {
        return 0;
      }
      if (inv.item === item) {
        return inv.amount;
      }
    }
    return 0;
  };

  script.compressInventory = function() {
    var j = 0;
    var inventory = Global.inventory;
    for (var i=0; i<Const.MAX_INVENTORY; ++i) {
      if (inventory[i].item == 0) {
        break;
      }
      if (inventory[i].amount > 0) {
        memcpy(inventory[j].uint8Array, inventory[i].uint8Array, inventory[j].uint8Array.length);
        j++;
      }
    }
    for (; j< Const.MAX_INVENTORY; ++j) {
      memset(inventory[j].uint8Array, 0, inventory[j].uint8Array.length);
    }
  };

  script.increaseHPMP = function(role, HP, MP) {
    var playerRoles = GameData.playerRoles;
    // Only care about alive players
    if (playerRoles.HP[role] > 0) {
      // change HP
      playerRoles.HP[role] += HP;
      if (playerRoles.HP[role] < 0) {
        playerRoles.HP[role] = 0;
      } else if (playerRoles.HP[role] > playerRoles.maxHP[role]) {
        playerRoles.HP[role] = playerRoles.maxHP[role];
      }
      // Change MP
      playerRoles.MP[role] += MP;
      if (playerRoles.MP[role] < 0) {
        playerRoles.MP[role] = 0;
      } else if (playerRoles.MP[role] > playerRoles.maxMP[role]) {
        playerRoles.MP[role] = playerRoles.maxMP[role];
      }
      return true;
    }
    return false;
  };

  script.addPoisonForPlayer = function(role, poisonID) {
    var index = findIndexByPlayerRole(role);
    if (index < 0) return;

    var poisonStatus = Global.poisonStatus;
    for (var i=0; i<Const.MAX_POISONS; ++i) {
      var w = poisonStatus[i][index].poisonID;
      if (w == 0) {
        break;
      }
      if (w == poisonID) {
        return; // already poisoned
      }
    }
    if (i < Const.MAX_POISONS) {
      poisonStatus[i][index].poisonID = poisonID;
      poisonStatus[i][index].poisonScript = GameData.object[poisonID].poison.playerScript;
    }
  };

  script.curePoisonByKind = function(role, poisonID) {
    var index = findIndexByPlayerRole(role);
    if (index < 0) return;

    var poisonStatus = Global.poisonStatus;
    for (var i=0; i<Const.MAX_POISONS; ++i) {
      var p = poisonStatus[i][index];
      if (p.poisonID == poisonID) {
        p.poisonID = 0;
        p.poisonScript = 0;
      }
    }
  };

  script.curePoisonByLevel = function(role, maxLevel) {
    var index = findIndexByPlayerRole(role);
    if (index < 0) return;

    var poisonStatus = Global.poisonStatus;
    for (var i=0; i<Const.MAX_POISONS; ++i) {
      var p = poisonStatus[i][index];
      var w = p.poisonID;
      if (GameData.object[w].poison.poisonLevel <= maxLevel) {
        p.poisonID = 0;
        p.poisonScript = 0;
      }
    }
  };

  script.isPlayerPoisonedByLevel = function(role, minLevel) {
    var index = findIndexByPlayerRole(role);
    if (index < 0) return false;

    var poisonStatus = Global.poisonStatus;
    for (var i=0; i<Const.MAX_POISONS; ++i) {
      var p = poisonStatus[i][index];
      var w = GameData.object[p.poisonID].poison.poisonLevel;
      if (w >= 99) {
        // Ignore poisons which has a level of 99 (usually effect of equipment)
        continue;
      }
      if (w >= minLevel) {
        return true;
      }
    }
    return false;
  };

  script.isPlayerPoisonedByKind = function(role, poisonID) {
    var index = findIndexByPlayerRole(role);
    if (index < 0) return false;

    var poisonStatus = Global.poisonStatus;
    for (var i=0; i<Const.MAX_POISONS; ++i) {
      if (poisonStatus[i][index].poisonID == poisonID) {
        return true;
      }
    }
    return false;
  };

  script.getPlayerAttackStrength = function(role) {
    var w = GameData.playerRoles.attackStrength[role];
    for (var i=0; i<Const.MAX_PLAYER_EQUIPMENTS; ++i) {
      w += Global.equipmentEffect[i].attackStrength[role];
    }

    return w;
  };

  script.getPlayerMagicStrength = function(role) {
    var w = GameData.playerRoles.magicStrength[role];
    for (var i=0; i<Const.MAX_PLAYER_EQUIPMENTS; ++i) {
      w += Global.equipmentEffect[i].magicStrength[role];
    }

    return w;
  };

  script.getPlayerDefense = function(role) {
    var w = GameData.playerRoles.defense[role];
    for (var i=0; i<Const.MAX_PLAYER_EQUIPMENTS; ++i) {
      w += Global.equipmentEffect[i].defense[role];
    }

    return w;
  };

  script.getPlayerDexterity = function(role) {
    var w = GameData.playerRoles.dexterity[role];
    for (var i=0; i<Const.MAX_PLAYER_EQUIPMENTS; ++i) {
      w += Global.equipmentEffect[i].dexterity[role];
    }

    return w;
  };

  script.getPlayerFleeRate = function(role) {
    var w = GameData.playerRoles.fleeRate[role];
    for (var i=0; i<Const.MAX_PLAYER_EQUIPMENTS; ++i) {
      w += Global.equipmentEffect[i].fleeRate[role];
    }

    return w;
  };

  script.getPlayerPoisonResistance = function(role) {
    var w = GameData.playerRoles.poisonResistance[role];
    for (var i=0; i<Const.MAX_PLAYER_EQUIPMENTS; ++i) {
      w += Global.equipmentEffect[i].poisonResistance[role];
    }

    return w;
  };

  script.getPlayerElementalResistance = function(role, attr) {
    var w = GameData.playerRoles.elementalResistance[attr][role];
    for (var i=0; i<Const.MAX_PLAYER_EQUIPMENTS; ++i) {
      w += Global.equipmentEffect[i].elementalResistance[attr][role];
    }
    if (w > 100) {
      w = 100;
    }

    return w;
  };

  script.getPlayerBattleSprite = function(role) {
    var w = GameData.playerRoles.spriteNumInBattle[role];
    for (var i=0; i<Const.MAX_PLAYER_EQUIPMENTS; ++i) {
      var x = Global.equipmentEffect[i].spriteNumInBattle[role];
      if (x != 0) {
        w = x;
      }
    }

    return w;
  };

  script.getPlayerCooperativeMagic = function(role) {
    var w = GameData.playerRoles.cooperativeMagic[role];
    for (var i=0; i<Const.MAX_PLAYER_EQUIPMENTS; ++i) {
      var x = Global.equipmentEffect[i].cooperativeMagic[role];
      if (x != 0) {
        w = x;
      }
    }

    return w;
  };

  script.playerCanAttackAll = function(role) {
    for (var i = 0; i < Const.MAX_PLAYER_EQUIPMENTS; ++i) {
      if (Global.equipmentEffect[i].attackAll[role] != 0){
        return true;
      }
    }

    return false;
  };

  script.addMagic = function(role, magic) {
    var i;
    for (i = 0; i < Const.MAX_PLAYER_MAGICS; ++i) {
      if (GameData.playerRoles.magic[i][role] == magic) {
        // already have this magic
        return false;
      }
    }
    for (i = 0; i < Const.MAX_PLAYER_MAGICS; ++i) {
      if (GameData.playerRoles.magic[i][role] == 0) {
        break;
      }
    }
    if (i >= Const.MAX_PLAYER_MAGICS) {
      // Not enough slots
      return false;
    }

    GameData.playerRoles.magic[i][role] = magic;

    return true;
  };

  script.removeMagic = function(role, magic) {
    var magics = GameData.playerRoles.magic;
    for (var i=0; i<Const.MAX_PLAYER_MAGICS; ++i) {
      var m = magics[i];
      if (m[role] == magic){
        m[role] = 0;
        break;
      }
    }
  };

  script.playerLevelUp = function(role, level) {
    var playerRoles = GameData.playerRoles;
    // Add the level
    playerRoles.level[role] += level;
    if (playerRoles.level[role] > Const.MAX_LEVELS) {
      playerRoles.level[role] = Const.MAX_LEVELS;
    }

    for (var i = 0; i < level; i++) {
      // Increase player's stats
      playerRoles.maxHP[role]          += 10 + randomLong(0, 8);
      playerRoles.maxMP[role]          +=  8 + randomLong(0, 6);
      playerRoles.attackStrength[role] +=  4 + randomLong(0, 1);
      playerRoles.magicStrength[role]  +=  4 + randomLong(0, 1);
      playerRoles.defense[role]        +=  2 + randomLong(0, 1);
      playerRoles.dexterity[role]      +=  2 + randomLong(0, 1);
      playerRoles.fleeRate[role]       +=  2;
    }

    function stat_limit(t) {
      return t > 999 ? 999 : t;
    }

    playerRoles.maxHP[role]          = stat_limit(playerRoles.maxHP[role]);
    playerRoles.maxMP[role]          = stat_limit(playerRoles.maxMP[role]);
    playerRoles.attackStrength[role] = stat_limit(playerRoles.attackStrength[role]);
    playerRoles.magicStrength[role]  = stat_limit(playerRoles.magicStrength[role]);
    playerRoles.defense[role]        = stat_limit(playerRoles.defense[role]);
    playerRoles.dexterity[role]      = stat_limit(playerRoles.dexterity[role]);
    playerRoles.fleeRate[role]       = stat_limit(playerRoles.fleeRate[role]);

    // Reset experience points to zero
    Global.exp.primaryExp[role].exp = 0;
    Global.exp.primaryExp[role].level = playerRoles.level[role];
  };

  function findIndexByPlayerRole(role) {
    for (var i=0; i<=Global.maxPartyMemberIndex; ++i) {
      if (Global.party[i].playerRole == role) {
        return i;
      }
    }
    return -1;
  };
};

export default script_extras;

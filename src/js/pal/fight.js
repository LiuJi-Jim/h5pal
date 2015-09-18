import input from './input';
import script from './script';
import uibattle from './uibattle';
import sound from './sound';

log.trace('fight module load');

var fight = {};

var surface = null
var battle = null;

fight.init = function*(surf, _battle) {
  log.debug('[BATTLE] init fight');
  surface = surf;
  battle = _battle;

  /**
   * Pick an enemy target automatically.
   * @return {Number}
   */
  battle.selectAutoTarget = function() {
    var i = Global.battle.UI.prevEnemyTarget;

    if (i >= 0 && i <= Global.battle.maxEnemyIndex &&
        Global.battle.enemy[i].objectID != 0 &&
        Global.battle.enemy[i].e.health > 0) {
      return i;
    }

    for (i = 0; i <= Global.battle.maxEnemyIndex; i++) {
      if (Global.battle.enemy[i].objectID != 0 &&
          Global.battle.enemy[i].e.health > 0) {
        return i;
      }
    }

    return -1;
  };

  /**
   * Delay a while during battle.
   * @param {Number} duration      Number of frames of the delay.
   * @param {Number} objectID      The object ID to be displayed during the delay.
   * @param {Boolean} updateGesture true if update the gesture for enemies, false if not.
   */
  battle.delay = function*(duration, objectID, updateGesture) {
    var sceneBuf = Global.battle.sceneBuf;
    var screen = surface.byteBuffer;
    for (var i = 0; i < duration; i++) {
      if (updateGesture) {
        // Update the gesture of enemies.
        for (var j = 0; j <= Global.battle.maxEnemyIndex; j++) {
          var enemy = Global.battle.enemy[j];
          if (enemy.objectID == 0 ||
              enemy.status[PlayerStatus.Sleep] != 0 ||
              enemy.status[PlayerStatus.Paralyzed] != 0) {
            continue;
          }

          if (--enemy.e.idleAnimSpeed == 0) {
            enemy.currentFrame++;
            enemy.e.idleAnimSpeed = GameData.enemy[GameData.object[enemy.objectID].enemy.enemyID].idleAnimSpeed;
          }

          if (enemy.currentFrame >= enemy.e.idleFrames) {
            enemy.currentFrame = 0;
          }
        }
      }

      battle.makeScene();
      surface.BlitSurface(sceneBuf, null, screen, null);
      yield uibattle.update();

      if (objectID != 0) {
        if (objectID == ui.BATTLE_LABEL_ESCAPEFAIL) {
          // HACKHACK
          ui.drawText(ui.getWord(objectID), PAL_XY(130, 75), 15, true, false);
        } else if (SHORT(objectID) < 0) {
          ui.drawText(ui.getWord(-SHORT(objectID)), PAL_XY(170, 45), ui.DESCTEXT_COLOR, true, false);
        } else {
          ui.drawText(ui.getWord(objectID), PAL_XY(210, 50), 15, true, false);
        }
      }

      surface.updateScreen(null);

      yield sleepByFrame(1);
    }
  };

  /**
   * Update players' and enemies' gestures and locations in battle.
   */
  battle.updateFighters = function() {
    log.trace('[BATTLE] updateFighters');
    // Update the gesture for all players
    for (var i = 0; i <= Global.maxPartyMemberIndex; i++) {
      var playerRole = Global.party[i].playerRole;

      Global.battle.player[i].pos = Global.battle.player[i].originalPos;
      Global.battle.player[i].colorShift = 0;

      if (GameData.playerRoles.HP[playerRole] == 0) {
        if (Global.playerStatus[playerRole][PlayerStatus.Puppet] == 0) {
          Global.battle.player[i].currentFrame = 2; // dead
        } else {
          Global.battle.player[i].currentFrame = 0; // puppet
        }
      } else {
        if (Global.playerStatus[playerRole][PlayerStatus.Sleep] != 0 ||
          battle.isPlayerDying(playerRole)) {
          Global.battle.player[i].currentFrame = 1;
        } else if (Global.battle.player[i].defending && !Global.battle.enemyCleared) {
          Global.battle.player[i].currentFrame = 3;
        } else {
          Global.battle.player[i].currentFrame = 0;
        }
      }
    }

    // Update the gesture for all enemies
    for (var i = 0; i <= Global.battle.maxEnemyIndex; i++) {
      if (Global.battle.enemy[i].objectID == 0) {
        continue;
      }

      Global.battle.enemy[i].pos = Global.battle.enemy[i].originalPos;
      Global.battle.enemy[i].colorShift = 0;

      if (Global.battle.enemy[i].status[PlayerStatus.Sleep] > 0 ||
        Global.battle.enemy[i].status[PlayerStatus.Paralyzed] > 0) {
        Global.battle.enemy[i].currentFrame = 0;
        continue;
      }

      if (--Global.battle.enemy[i].e.idleAnimSpeed == 0)
      {
        Global.battle.enemy[i].currentFrame++;
        Global.battle.enemy[i].e.idleAnimSpeed =
          GameData.enemy[GameData.object[Global.battle.enemy[i].objectID].enemy.enemyID].idleAnimSpeed;
      }

      if (Global.battle.enemy[i].currentFrame >= Global.battle.enemy[i].e.idleFrames) {
        Global.battle.enemy[i].currentFrame = 0;
      }
    }
  };

  /**
   * Check if there are player who is ready.
   */
  battle.playerCheckReady = function() {
    log.trace('[BATTLE] playerCheckReady');
    var flMax = 0;
    var iMax = 0;

    // Start the UI for the fastest and ready player
    for (var i = 0; i <= Global.maxPartyMemberIndex; i++) {
      if (Global.battle.player[i].state == FighterState.Com ||
        (Global.battle.player[i].state == FighterState.Act && Global.battle.player[i].action.actionType == BattleActionType.CoopMagic)) {
        flMax = 0;
        break;
      } else if (Global.battle.player[i].state == FighterState.Wait) {
        if (Global.battle.player[i].timeMeter > flMax) {
          iMax = i;
          flMax = Global.battle.player[i].timeMeter;
        }
      }
    }

    if (flMax >= 100.0) {
      Global.battle.player[iMax].state = FighterState.Com;
      Global.battle.player[iMax].defending = false;
    }
  };

  /**
   * Called once per video frame in battle.
   */
  battle.startFrame = function*() {
    Global.battle.battleResult = BattleResult.Won;

    var onlyPuppet = true;
    var sceneBuf = Global.battle.sceneBuf;
    var screen = surface.byteBuffer;

    if (!Global.battle.enemyCleard) {
      battle.updateFighters();
    }

    // Update the scene
    battle.makeScene();
    surface.blitSurface(sceneBuf, null, screen, null);

    // Check if the battle is over
    if (Global.battle.enemyCleard) {
      // All enemies are cleared. Won the battle.
      Global.battle.battleResult = BattleResult.Won;
      sound.play(-1);
      return;
    } else {
      var ended = true;

      for (var i = 0; i <= Global.maxPartyMemberIndex; i++) {
        var playerRole = Global.party[i].playerRole;

        if (GameData.playerRoles.HP[playerRole] != 0) {
          onlyPuppet = false;
          ended = false;
          break;
        } else if (Global.playerStatus[playerRole][PlayerStatus.Puppet] != 0) {
          ended = false;
        }
      }

      if (ended) {
        // All players are dead. Lost the battle.
        Global.battle.battleResult = BattleResult.Lost;
        return;
      }
    }

    if (Global.battle.phase == BattlePhase.SelectAction) {
      if (Global.battle.UI.state == BattleUIState.Wait) {
        for (var i = 0; i <= Global.maxPartyMemberIndex; i++) {
          var playerRole = Global.party[i].playerRole;

          // Don't select action for this player if player is KO'ed,
          // sleeped, confused or paralyzed
          if (GameData.playerRoles.HP[playerRole] == 0 ||
              Global.playerStatus[playerRole][PlayerStatus.Sleep] ||
              Global.playerStatus[playerRole][PlayerStatus.Confused] ||
              Global.playerStatus[playerRole][PlayerStatus.Paralyzed]) {
            continue;
          }

          // Start the menu for the first player whose action is not
          // yet selected
          if (Global.battle.player[i].state == FighterState.Wait) {
            Global.battle.movingPlayerIndex = i;
            Global.battle.player[i].state = FighterState.Com;
            uibattle.playerReady(i);
            break;
          } else if (Global.battle.player[i].action.actionType == BattleActionType.CoopMagic) {
            // Skip other players if someone selected coopmagic
            i = Global.maxPartyMemberIndex + 1;
            break;
          }
        }

        if (i > Global.maxPartyMemberIndex) {
          // actions for all players are decided. fill in the action queue.
          Global.battle.repeat = false;
          Global.battle.force = false;
          Global.battle.flee = false;

          Global.battle.curAction = 0;

          for (var i = 0; i < Const.MAX_ACTIONQUEUE_ITEMS; i++) {
            Global.battle.actionQueue[i].index = 0xFFFF;
            Global.battle.actionQueue[i].dexterity = 0xFFFF;
          }

          var j = 0;

          // Put all enemies into action queue
          for (var i = 0; i <= Global.battle.maxEnemyIndex; i++) {
            if (Global.battle.enemy[i].objectID == 0) {
              continue;
            }

            Global.battle.actionQueue[j].isEnemy = true;
            Global.battle.actionQueue[j].index = i;
            Global.battle.actionQueue[j].dexterity = battle.getEnemyDexterity(i);
            Global.battle.actionQueue[j].dexterity *= randomFloat(0.9, 1.1);

            j++;

            if (Global.battle.enemy[i].e.dualMove * 50 + randomLong(0, 100) > 100) {
              Global.battle.actionQueue[j].isEnemy = true;
              Global.battle.actionQueue[j].index = i;
              Global.battle.actionQueue[j].dexterity = battle.getEnemyDexterity(i);
              Global.battle.actionQueue[j].dexterity *= randomFloat(0.9, 1.1);

              j++;
            }
          }

          // Put all players into action queue
          for (i = 0; i <= Global.maxPartyMemberIndex; i++) {
            var playerRole = Global.party[i].playerRole;
            var player = Global.battle.player[i];

            Global.battle.actionQueue[j].isEnemy = false;
            Global.battle.actionQueue[j].index = i;

            if (GameData.playerRoles.HP[playerRole] == 0 ||
                Global.playerStatus[playerRole][PlayerStatus.Sleep] > 0 ||
                Global.playerStatus[playerRole][PlayerStatus.Paralyzed] > 0) {
              // players who are unable to move should attack physically if recovered
              // in the same turn
              Global.battle.actionQueue[j].dexterity = 0;
              player.action.actionType = BattleActionType.Attack;
              player.state = FighterState.Act;
            } else {
              var dexterity = battle.getPlayerActualDexterity(playerRole);

              if (Global.playerStatus[playerRole][PlayerStatus.Confused] > 0) {
                player.action.actionType = BattleActionType.Attack;
                player.state = FighterState.Act;
              }

              switch (player.action.actionType) {
                case BattleActionType.CoopMagic:
                  dexterity *= 10;
                  break;

                case BattleActionType.Defend:
                  dexterity *= 5;
                  break;

                case BattleActionType.Magic:
                  if ((GameData.object[player.action.actionID].magic.flags & MagicFlag.UsableToEnemy) == 0) {
                     dexterity *= 3;
                  }
                  break;

                case BattleActionType.Flee:
                  dexterity /= 2;
                  break;

                case BattleActionType.UseItem:
                  dexterity *= 3;
                  break;

                default:
                  break;
              }

              if (battle.isPlayerDying(playerRole)) {
                 dexterity /= 2;
              }

              dexterity *= randomFloat(0.9, 1.1);

              Global.battle.actionQueue[j].dexterity = dexterity;
            }

            j++;
          }

          // Sort the action queue by dexterity value
          Global.actionQueue.sort(function(a, b) {
            return -(a.dexterity - b.dexterity);
          });

          // Perform the actions
          Global.battle.phase = BattlePhase.PerformAction;
        }
      }
    } else {
      // Are all actions finished?
      if (Global.battle.curAction >= Const.MAX_ACTIONQUEUE_ITEMS ||
          Global.battle.actionQueue[Global.battle.curAction].dexterity == 0xFFFF) {
        for (var i = 0; i <= Global.maxPartyMemberIndex; i++) {
          Global.battle.player[i].defending = false;
        }

        // Run poison scripts
        battle.backupStat();

        for (var i = 0; i <= Global.maxPartyMemberIndex; i++) {
          playerRole = Global.party[i].playerRole;

          for (var j = 0; j < Const.MAX_POISONS; j++)
          {
             if (Global.poisonStatus[j][i].poisonID != 0)
             {
                Global.poisonStatus[j][i].poisonScript = yield script.runTriggerScript(
                  Global.poisonStatus[j][i].poisonScript,
                  playerRole
                );
             }
          }

          // Update statuses
          for (var j = 0; j < PlayerStatus.All; j++) {
            if (Global.playerStatus[playerRole][j] > 0) {
              Global.playerStatus[playerRole][j]--;
            }
          }
        }

        for (var i = 0; i <= Global.battle.maxEnemyIndex; i++) {
          for (var j = 0; j < Const.MAX_POISONS; j++) {
            if (Global.battle.enemy[i].poisons[j].poisonID != 0) {
              Global.battle.enemy[i].poisons[j].poisonScript =yield script.runTriggerScript(
                Global.battle.enemy[i].poisons[j].poisonScript,
                WORD(i)
              );
            }
          }

          // Update statuses
          for (var j = 0; j < PlayerStatus.All; j++) {
            if (Global.battle.enemy[i].status[j] > 0) {
              Global.battle.enemy[i].status[j]--;
            }
          }
        }

        yield battle.postActionCheck(false);
        if (battle.displayStatChange()) {
          yield battle.delay(8, 0, true);
        }

        if (Global.battle.hidingTime > 0) {
          if (--Global.battle.hidingTime == 0) {
            battle.backupScene();
            battle.makeScene();
            yield battle.fadeScene();
          }
        }

        if (Global.battle.hidingTime == 0) {
          for (var i = 0; i <= Global.battle.maxEnemyIndex; i++) {
            if (Global.battle.enemy[i].objectID == 0) {
              continue;
            }

            Global.battle.enemy[i].scriptOnTurnStart = yield script.runTriggerScript(
              Global.battle.enemy[i].scriptOnTurnStart,
              i
            );
          }
        }

        // Clear all item-using records
        for (var i = 0; i < Const.MAX_INVENTORY; i++) {
          Global.inventory[i].amountInUse = 0;
        }

        // Proceed to next turn...
        Global.battle.phase = BattlePhase.SelectAction;
      } else {
        var i = Global.battle.actionQueue[Global.battle.curAction].index;

        if (Global.battle.actionQueue[Global.battle.curAction].isEnemy) {
          if (Global.battle.hidingTime == 0 &&
              !onlyPuppet &&
              Global.battle.enemy[i].objectID != 0) {
            Global.battle.enemy[i].scriptOnReady = yield script.runTriggerScript(
              Global.battle.enemy[i].criptOnReady,
              i
            );

            Global.battle.enemyMoving = true;
            yield battle.enemyPerformAction(i);
            Global.battle.enemyMoving = false;
          }
        } else if (Global.battle.player[i].state == FighterState.Act) {
          var playerRole = Global.party[i].playerRole;

          if (GameData.playerRoles.HP[playerRole] == 0) {
            if (Global.playerStatus[playerRole][PlayerStatus.Puppet] == 0) {
              Global.battle.player[i].action.actionType = BattleActionType.Pass;
            }
          } else if (Global.playerStatus[playerRole][PlayerStatus.Sleep] > 0 ||
                     Global.playerStatus[playerRole][PlayerStatus.Paralyzed] > 0) {
             Global.battle.player[i].action.actionType = BattleActionType.Pass;
          } else if (Global.playerStatus[playerRole][PlayerStatus.Confused] > 0) {
             Global.battle.player[i].action.actionType = BattleActionType.AttackMate;
          }

          // Perform the action for this player.
          Global.battle.movingPlayerIndex = i;
          yield battle.playerPerformAction(i);
        }

        Global.battle.curAction++;
      }
    }

    // The R and F keys and Fleeing should affect all players
    if (Global.battle.UI.menuState == BattleMenuState.Main &&
        Global.battle.UI.state == BattleUIState.SelectMove) {
      if (input.isKeyPressed(Key.ForceRepeat)) {
        Global.battle.repeat = true;
      } else if (input.isKeyPressed(Key.Force)) {
         Global.battle.force = true;
      }
    }

    if (Global.battle.repeat) {
      input.keyPress = Key.Repeat;
    } else if (Global.battle.force) {
      input.keyPress = Key.Force;
    } else if (Global.battle.flee) {
      input.keyPress = Key.Flee;
    }

    // Update the battle UI
    yield uibattle.update();
  };

  /**
   * Commit the action which the player decided.
   * @param  {Boolean} repeat true if repeat the last action.
   */
  battle.commitAction = function(repeat) {
    var curPlayer = Global.battle.player[Global.battle.ui.curPlayerIndex];
    if (!repeat) {
      curPlayer.action.actionType = Global.battle.UI.actionType;
      curPlayer.action.target = SHORT(Global.battle.UI.selectedIndex);
      curPlayer.action.actionID = Global.battle.UI.objectID;
    } else if (curPlayer.action.actionType == BattleActionType.Pass) {
      curPlayer.action.actionType = BattleActionType.Attack;
      curPlayer.action.target = -1;
    }

    // Check if the action is valid
    switch (curPlayer.action.actionType) {
      case BattleActionType.Magic:
        var w = curPlayer.action.actionID;
        w = GameData.magic[GameData.object[w].magic.magicNumber].costMP;

        if (GameData.playerRoles.MP[Global.player[Global.battle.UI.curPlayerIndex].playerRole] < w) {
          w = curPlayer.action.actionID;
          w = GameData.magic[GameData.object[w].magic.magicNumber].type;
          if (w == MagicType.ApplyToPlayer || w == MagicType.ApplyToParty ||
              w == MagicType.Trance) {
            curPlayer.action.actionType = BattleActionType.Defend;
          } else {
            curPlayer.action.actionType = BattleActionType.Attack;
            if (curPlayer.action.target == -1) {
              curPlayer.action.target = 0;
            }
          }
        }
        break;

      case BattleActionType.UseItem:
        if ((GameData.object[curPlayer.action.actionID].item.flags & ItemFlag.Consuming) == 0) {
          break;
        }

      case BattleActionType.Throitem:
        for (var w = 0; w < Const.MAX_INVENTORY; w++) {
          if (Global.inventory[w].item == curPlayer.action.actionID) {
            Global.inventory[w].amountInUse++;
            break;
          }
        }
        break;

      default:
        break;
    }

    if (Global.battle.UI.actionType == BattleActionType.Flee) {
      Global.battle.flee = true;
    }

    curPlayer.state = FighterState.Act;
    Global.battle.UI.state = BattleUIState.Wait;
  };

  /**
   * Show the effect for player before using a magic.
   * @param {Number} playerIndex   the index of the player.
   * @param {Boolean} summon       true if player is using a summon magic.
   */
  battle.showPlayerPreMagicAnim = function*(playerIndex, summon) {

  };

  /**
   * Check if the player is dying.
   * @param  {Number}  the player role ID.
   * @return {Boolean} true if the player is dying, false if not.
   */
  battle.isPlayerDying = function(playerRole) {
    return GameData.playerRoles.HP[playerRole] < GameData.playerRoles.maxHP[playerRole] / 5;
  };

  /**
   * Calculate the base damage value of attacking.
   * @param  {Number} attackStrength attack strength of attacker.
   * @param  {Number} defense        defense value of inflictor.
   * @return {Number}                The base damage value of the attacking.
   */
  battle.calcBaseDamage = function(attackStrength, defense) {
    // Formula courtesy of palxex and shenyanduxing
    if (attackStrength > defense) {
      return SHORT(~~(attackStrength * 2 - defense * 1.6 + 0.5));
    } else if (attackStrength > defense * 0.6) {
      return SHORT(~~(attackStrength - defense * 0.6 + 0.5));
    } else {
      return 0;
    }
  };

  /**
   * Calculate the damage of magic.
   * @param  {Number} magicStrength       magic strength of attacker.
   * @param  {Number} defense             defense value of inflictor.
   * @param  {Array}  elementalResistance inflictor's resistance to the elemental magics.
   * @param  {Number} poisonResistance    inflictor's resistance to poison.
   * @param  {Number} magicID             object ID of the magic.
   * @return {Number}                     The damage value of the magic attack.
   */
  battle.calcMagicDamage = function(magicStrength, defense, elementalResistance, poisonResistance, magicID) {
    magicID = GameData.object[magicID].magic.magicNumber;

    // Formula courtesy of palxex and shenyanduxing
    magicStrength *= randomFloat(10, 11);
    magicStrength /= 10;

    damage = PAL_CalcBaseDamage(magicStrength, defense);
    damage /= 4;
    damage += GameData.magic[magicID].baseDamage;

    if (GameData.magic[magicID].elemental != 0) {
      var elem = GameData.magic[magicID].elemental;

      if (elem > Const.NUM_MAGIC_ELEMENTAL) {
        damage *= 10 - poisonResistance;
      } else if (elem == 0) {
        damage *= 5;
      } else {
        damage *= 10 - elementalResistance[elem - 1];
      }

      damage /= 5;

      if (elem <= Const.NUM_MAGIC_ELEMENTAL) {
        damage *= 10 + GameData.battleField[Global.numBattleField].magicEffect[elem - 1];
        damage /= 10;
      }
    }

    return ~~damage;
  };

  /**
   * Calculate the damage value of physical attacking.
   * @param  {Number} attackStrength   attack strength of attacker.
   * @param  {Number} defense          defense value of inflictor.
   * @param  {Number} attackResistance inflictor's resistance to physical attack.
   * @return {Number}                  The damage value of the physical attacking.
   */
  battle.calcPhysicalAttackDamage = function(attackStrength, defense, attackResistance) {
    var damage = battle.calcBaseDamage(attackStrength, defense);
    if (attackResistance != 0) {
      damage = ~~(damage / attackResistance);
    }

    return damage;
  };

  /**
   * Get the dexterity value of the enemy.
   * @param  {Number} enemyIndex the index of the enemy.
   * @return {Number}            The dexterity value of the enemy.
   */
  battle.getEnemyDexterity = function(enemyIndex) {
    var s = 0;
    s = (Global.battle.enemy[enemyIndex].e.level + 6) * 3;
    s += SHORT(Global.battle.enemy[enemyIndex].e.dexterity);

    return s;
  };

  /**
   * Get player's actual dexterity value in battle.
   * @param  {Number} playerRole the player role ID.
   * @return {Number}            The player's actual dexterity value.
   */
  battle.getPlayerActualDexterity = function(playerRole) {
    var dexterity = script.getPlayerDexterity(playerRole);

    if (Global.playerStatus[playerRole][PlayerStatus.Haste] != 0) {
      dexterity *= 3;
    }

    if (battle.isPlayerDying(playerRole)) {
      // player who is low of HP should be slower
      dexterity /= 2;
    }

    if (dexterity > 999) {
      dexterity = 999;
    }

    return ~~dexterity;
  };

  /**
   * Backup HP and MP values of all players and enemies.
   */
  battle.backupStat = function() {
    for (var i = 0; i <= Global.battle.maxEnemyIndex; i++) {
      if (Global.battle.enemy[i].objectID == 0) {
        continue;
      }
      Global.battle.enemy[i].prevHP = Global.battle.enemy[i].e.health;
    }

    for (var i = 0; i <= Global.maxPartyMemberIndex; i++) {
      playerRole = Global.party[i].playerRole;

      Global.battle.player[i].prevHP = GameData.playerRoles.HP[playerRole];
      Global.battle.player[i].prevMP = GameData.playerRoles.MP[playerRole];
    }
  };

  /**
   * Display the HP and MP changes of all players and enemies.
   * @return {Boolean} true if there are any number displayed, false if not.
   */
  battle.displayStatChange = function() {
    var changed = false;

    for (var i = 0; i <= Global.battle.maxEnemyIndex; i++) {
      if (Global.battle.enemy[i].objectID == 0) {
        continue;
      }

      if (Global.battle.enemy[i].prevHP != Global.battle.enemy[i].e.health) {
        // Show the number of damage
        var damage = Global.battle.enemy[i].e.health - Global.battle.enemy[i].prevHP;

        var x = PAL_X(Global.battle.enemy[i].pos) - 9;
        var y = PAL_Y(Global.battle.enemy[i].pos) - 115;

        if (y < 10) {
          y = 10;
        }

        if (damage < 0) {
          uibattle.showNum(WORD(-damage), PAL_XY(x, y), NumColor.Blue);
        } else {
          uibattle.showNum(WORD(damage), PAL_XY(x, y), NumColor.Yellow);
        }

        changed = true;
      }
    }

    for (var i = 0; i <= Global.maxPartyMemberIndex; i++) {
      var playerRole = Global.party[i].playerRole;

      if (Global.battle.player[i].prevHP != GameData.playerRoles.HP[playerRole]) {
        var damage = GameData.playerRoles.HP[playerRole] - Global.battle.player[i].prevHP;

        var x = PAL_X(Global.battle.player[i].pos) - 9;
        var y = PAL_Y(Global.battle.player[i].pos) - 75;

        if (y < 10) {
          y = 10;
        }

        if (damage < 0) {
          uibattle.showNum(WORD(-damage), PAL_XY(x, y), NumColor.Blue);
        } else {
          uibattle.showNum(WORD(damage), PAL_XY(x, y), NumColor.Yellow);
        }

        changed = true;
      }

      if (Global.battle.player[i].prevMP != GameData.playerRoles.MP[playerRole]) {
        var damage = GameData.playerRoles.MP[playerRole] - Global.battle.player[i].prevMP;

        var x = PAL_X(Global.battle.player[i].pos) - 9;
        var y = PAL_Y(Global.battle.player[i].pos) - 67;

        if (y < 10) {
          y = 10;
        }

        // Only show MP increasing
        if (damage > 0) {
          uibattle.showNum(WORD(damage), PAL_XY(x, y), NumColor.Cyan);
        }

        changed = true;
      }
    }

    return changed;
  };

  /**
   * Essential checks after an action is executed.
   * @param  {Boolean} checkPlayers true if check for players, false if not.
   */
  battle.postActionCheck = function*(checkPlayers) {
    var sceneBuf = Global.battle.sceneBuf;
    var screen = surface.byteBuffer;
    var fade = false;
    var enemyRemaining = false;
    for (var i = 0; i <= Global.battle.maxEnemyIndex; i++) {
      if (Global.battle.enemy[i].objectID == 0) {
        continue;
      }

      if (SHORT(Global.battle.enemy[i].e.health) <= 0) {
        // This enemy is KO'ed
        Global.battle.expGained += Global.battle.enemy[i].e.exp;
        Global.battle.cashGained += Global.battle.enemy[i].e.cash;

        sound.play(Global.battle.enemy[i].e.deathSound);
        Global.battle.enemy[i].objectID = 0;
        fade = true;

        continue;
      }

      enemyRemaining = true;
    }

    if (!enemyRemaining) {
      Global.battle.enemyCleared = true;
      Global.battle.UI.state = BattleUIState.Wait;
    }

    if (checkPlayers && !Global.autoBattle) {
      for (var i = 0; i <= Global.maxPartyMemberIndex; i++) {
        var w = Global.party[i].playerRole;
        var name;

        if (GameData.playerRoles.HP[w] < Global.battle.player[i].prevHP &&
            GameData.playerRoles.HP[w] == 0) {
          w = GameData.playerRoles.coveredBy[w];

          for (var j = 0; j <= Global.maxPartyMemberIndex; j++) {
            if (Global.party[j].playerRole == w) {
               break;
            }
          }

          if (GameData.playerRoles.HP[w] > 0 &&
              Global.playerStatus[w][PlayerStatus.Sleep] == 0 &&
              Global.playerStatus[w][PlayerStatus.Paralyzed] == 0 &&
              Global.playerStatus[w][PlayerStatus.Confused] == 0 &&
              j <= Global.maxPartyMemberIndex) {
            name = GameData.playerRoles.name[w];

            if (GameData.object[name].player.scriptOnFriendDeath != 0) {
              yield battle.delay(10, 0, true);

              battle.makeScene();
              surface.blitSurface(sceneBuf, null, screen, null);
              surface.updateScreen(null);

              Global.battle.battleResult = BattleResult.Pause;

              GameData.object[name].player.scriptOnFriendDeath = yield script.runTriggerScript(
                GameData.object[name].player.scriptOnFriendDeath,
                w
              );

              Global.battle.battleResult = BattleResult.OnGoing;

              input.clear();
              return yield end();
            }
          }
        }
      }

      for (var i = 0; i <= Global.maxPartyMemberIndex; i++) {
        var w = Global.party[i].playerRole;
        var name;

        if (Global.playerStatus[w][PlayerStatus.Sleep] != 0 ||
           Global.playerStatus[w][PlayerStatus.Confused] != 0) {
          continue;
        }

        if (GameData.playerRoles.HP[w] < Global.battle.player[i].prevHP) {
          if (GameData.playerRoles.HP[w] > 0 && PAL_IsPlayerDying(w) &&
            Global.battle.player[i].prevHP >= GameData.playerRoles.maxHP[w] / 5) {
            var cover = GameData.playerRoles.coveredBy[w];

            if (Global.playerStatus[cover][PlayerStatus.Sleep] != 0 ||
               Global.playerStatus[cover][PlayerStatus.Paralyzed] != 0 ||
               Global.playerStatus[cover][PlayerStatus.Confused] != 0) {
              continue;
            }

            name = GameData.playerRoles.name[w];

            sound.play(GameData.playerRoles.dyingSound[w]);

            for (var j = 0; j <= Global.maxPartyMemberIndex; j++) {
              if (Global.party[j].playerRole == cover) {
                break;
              }
            }

            if (j > Global.maxPartyMemberIndex || GameData.playerRoles.HP[cover] == 0) {
              continue;
            }

            if (GameData.object[name].player.scriptOnDying != 0) {
              yield battle.delay(10, 0, true);

              battle.makeScene();
              surface.blitSurface(sceneBuf, null, screen, null);
              surface.updateScreen(null);

              Global.battle.battleResult = BattleResult.Pause;

              GameData.object[name].player.scriptOnDying = yield script.runTriggerScript(
                GameData.object[name].player.scriptOnDying,
                w
              );

              Global.battle.battleResult = BattleResult.OnGoing;
              input.clear();
              PAL_ClearKeyState();
            }

            return yield end();
          }
        }
      }
    }

    function* end() {
      if (fade) {
        battle.backupScene();
        battle.makeScene();
        yield battle.fadeScene();
      }
      // Fade out the summoned god
      if (Global.battle.summonSprite != null) {
        battle.updateFighters();
        yield battle.delay(1, 0, false);

        Global.battle.summonSprite = null;
        Global.battle.backgroundColorShift = 0;

        battle.backupScene();
        battle.makeScene();
        yield battle.fadeScene();
      }
    }
  };

  /**
   * Show the physical attack effect for player.
   * @param {Number} playerIndex    the index of the player.
   * @param {Boolean} critical      true if this is a critical hit.
   */
  battle.showPlayerAttackAnim = function*(playerIndex, critical) {

  };

  /**
   * Show the "use item" effect for player.
   * @param {Number} playerIndex   the index of the player.
   * @param {Number} objectID      the object ID of the item to be used.
   * @param {Number} target        the target player of the action.
   */
  battle.showPlayerUseItemAnim = function*(playerIndex, objectID, target) {

  };

  /**
   * Show the defensive magic effect for player.
   * @param {Number} playerIndex   the index of the player.
   * @param {Number} objectID      the object ID of the magic to be used.
   * @param {Number} target        the target player of the action.
   */
  battle.showPlayerDefMagicAnim = function*(playerIndex, objectID, target) {

  };

  /**
   * Show the offensive magic animation for player.
   * @param {Number} playerIndex   the index of the player.
   * @param {Number} objectID      the object ID of the magic to be used.
   * @param {Number} target        the target player of the action.
   */
  battle.showPlayerOffMagicAnim = function*(playerIndex, objectID, target) {

  };

  /**
   * Show the offensive magic animation for enemy.
   * @param {Number} objectID      the object ID of the magic to be used.
   * @param {Number} target        the target player index of the action.
   */
  battle.showEnemyMagicItem = function*(objectID, target) {

  };

  /**
   * Show the summon magic animation for player.
   * @param {Number} playerIndex   the index of the player.
   * @param {Number} objectID      the object ID of the magic to be used.
   */
  battle.showPlayerSummonMagicAnim = function*(playerIndex, objectID) {

  };

  /**
   * Show the post-magic animation.
   */
  battle.showPostMagicAnim = function*() {

  };

  /**
   * Validate player's action, fallback to other action when needed.
   * @param {Number} playerIndex   the index of the player.
   */
  battle.playerValidateAction = function(playerIndex) {

  };

  /**
   * Perform the selected action for a player.
   * @param {Number} playerIndex   the index of the player.
   */
  battle.playerPerformAction = function*(playerIndex) {

  };

  /**
   * Select a attackable player randomly.
   * @return {Number}
   */
  battle.enemySelectTargetIndex = function() {

  };

  /**
   * Perform the selected action for a player.
   * @param  {Number} enemyIndex the index of the player.
   */
  battle.enemyPerformAction = function*(enemyIndex) {

  };

  /**
   * Steal from the enemy.
   * @param {Number} target        the target enemy index.
   * @param {Number} stealRate     the rate of successful theft.
   */
  battle.stealFromEnemy = function*(target, stealRate) {

  };

  /**
   * Simulate a magic for players. Mostly used in item throwing script.
   * @param {Number} target        the target enemy index. -1 = all enemies.
   * @param {Number} magicObjectID the object ID of the magic to be simulated.
   * @param {Number} baseDamage    the base damage of the simulation.
   */
  battle.simulateMagic = function*(target, magicObjectID, baseDamage) {

  };
};

export default fight;

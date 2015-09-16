import utils from './utils';
import scene from './scene';
import ajax from './ajax';
import script from './script';
import music from './music';
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

var BattleAction = battle.BattleAction = function(actionType, actionID, target, remainingTime) {
  /*
    BATTLEACTIONTYPE   ActionType;
    WORD               wActionID;   // item/magic to use
    SHORT              sTarget;     // -1 for everyone
    FLOAT              flRemainingTime;  // remaining waiting time before the action start
  */
  this.actionType = actionType || BattleActionType.Pass;
  this.actionID = actionID || 0;
  this.target = target || 0;
  this.remainingTime = remainingTime || 0.0;
};

var BattleEnemy = battle.BattleEnemy = function(
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
  colorShift) {
  /*
    WORD               wObjectID;              // Object ID of this enemy
    ENEMY              e;                      // detailed data of this enemy
    WORD               rgwStatus[PlayerStatus.All];  // status effects
    FLOAT              flTimeMeter;            // time-charging meter (0 = empty, 100 = full).
    POISONSTATUS       rgPoisons[MAX_POISONS]; // poisons
    LPSPRITE           lpSprite;
    PAL_POS            pos;                    // current position on the screen
    PAL_POS            posOriginal;            // original position on the screen
    WORD               wCurrentFrame;          // current frame number
    FIGHTERSTATE       state;                  // state of this enemy

    BOOL               fTurnStart;
    BOOL               fFirstMoveDone;
    BOOL               fDualMove;

    WORD               wScriptOnTurnStart;
    WORD               wScriptOnBattleEnd;
    WORD               wScriptOnReady;

    WORD               wPrevHP;              // HP value prior to action

    INT                iColorShift;
  */
  this.objectID = objectID || 0;
  this.e = e || null;
  this.status = status || new Array(PlayerStatus.All);
  this.timeMeter = timeMeter || 0.0;
  this.poisons = poisons || Const.MAX_POISONS;
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
};

var BattlePlayer = battle.BattlePlayer = function(
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
  prevMP
  ) {
  /*
    INT                iColorShift;
    FLOAT              flTimeMeter;          // time-charging meter (0 = empty, 100 = full).
    FLOAT              flTimeSpeedModifier;
    WORD               wHidingTime;          // remaining hiding time
    LPSPRITE           lpSprite;
    PAL_POS            pos;                  // current position on the screen
    PAL_POS            posOriginal;          // original position on the screen
    WORD               wCurrentFrame;        // current frame number
    FIGHTERSTATE       state;                // state of this player
    BATTLEACTION       action;               // action to perform
    BOOL               fDefending;           // TRUE if player is defending
    WORD               wPrevHP;              // HP value prior to action
    WORD               wPrevMP;              // MP value prior to action
  #ifndef PAL_CLASSIC
    SHORT              sTurnOrder;           // turn order
  #endif
  */
  this.colorShift = colorShift || 0;
  this.timeMeter = timeMeter || 0.0;
  this.timeSpeedModifier = timeSpeedModifier || 0.0;
  this.hidingTime = hidingTime || 0;
  this.sprite = sprite || 0;
  this.pos = pos || 0;
  this.originalPos = originalPos || 0;
  this.state = state || FighterState.Wait;
  this.action = action || (new BattleAction());
  this.defending = defending || false;
  this.prevHP = prevHP || 0;
  this.prevMP = prevMP || 0;
};

var Summon = battle.Summon = function(currentFrame) {
  this.currentFrame = currentFrame || 0;
};

var MAX_BATTLE_ACTIONS = 256;
var MAX_BATTLE_ENEMIES = 256;

global.BattlePhase = {
  SelectAction:  0,
  PerformAction: 1
};

var ActionQueue = battle.ActionQueue = function(isEnemy, dexterity, index) {
  this.isEnemy = isEnemy || false;
  this.dexterity = dexterity || 0;
  this.index = index || 0;
};

Const.MAX_ACTIONQUEUE_ITEMS = (Const.MAX_PLAYERS_IN_PARTY + Const.MAX_ENEMIES_IN_TEAM * 2);

var Battle = battle.Battle = function() {
  /*
    BATTLEPLAYER     rgPlayer[MAX_PLAYERS_IN_PARTY];
    BATTLEENEMY      rgEnemy[MAX_ENEMIES_IN_TEAM];

    WORD             wMaxEnemyIndex;

    SDL_Surface     *lpSceneBuf;
    SDL_Surface     *lpBackground;

    SHORT            sBackgroundColorShift;

    LPSPRITE         lpSummonSprite;       // sprite of summoned god
    PAL_POS          posSummon;
    INT              iSummonFrame;         // current frame of the summoned god

    INT              iExpGained;           // total experience value gained
    INT              iCashGained;          // total cash gained

    BOOL             fIsBoss;              // TRUE if boss fight
    BOOL             fEnemyCleared;        // TRUE if enemies are cleared
    BATTLERESULT     BattleResult;

    FLOAT            flTimeChargingUnit;   // the base waiting time unit

    BATTLEUI         UI;

    LPBYTE           lpEffectSprite;

    BOOL             fEnemyMoving;         // TRUE if enemy is moving

    INT              iHidingTime;          // Time of hiding

    WORD             wMovingPlayerIndex;   // current moving player index

    int              iBlow;

  #ifdef PAL_CLASSIC
    BATTLEPHASE      Phase;
    ACTIONQUEUE      ActionQueue[MAX_ACTIONQUEUE_ITEMS];
    int              iCurAction;
    BOOL             fRepeat;              // TRUE if player pressed Repeat
    BOOL             fForce;               // TRUE if player pressed Force
    BOOL             fFlee;                // TRUE if player pressed Flee
  #endif
  */
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
  this.effectSprite = null;
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

  yield ajax.loadMKF('DATA');
  Files.DATA = ajax.MKF.DATA;

  yield fight.init(surf, battle);
  yield uibattle.init(surf, battle);

  Global.battle = new Battle();
};

/**
 * Generate the battle scene into the scene buffer.
 */
battle.makeScene = function*() {

};

/**
 * Backup the scene buffer.
 */
battle.backupScene = function() {

};

/**
 * Fade in the scene of battle.
 */
battle.fadeScene = function*() {

};

/**
 * The main battle routine.
 * @yield {BattleResult} The result of the battle.
 */
battle.main = function*() {
  return BattleResult.Won;
};

/**
 * Free all the loaded sprites.
 */
battle.freeBattleSprites = function() {

};

/**
 * Load all the loaded sprites.
 */
battle.loadBattleSprites = function() {

};

/**
 * Load the screen background picture of the battle.
 */
battle.loadBattleBackground = function() {

};

/**
 * Show the "you win" message and add the experience points for players.
 */
battle.won = function*() {

};

/**
 * Enemy flee the battle.
 */
battle.enemyEscape = function*() {

};

/**
 * Player flee the battle.
 */
battle.playerEscape = function*() {

};

/**
 * Start a battle.
 * @param {Number}  enemyTeam     the number of the enemy team.
 * @param {Boolean} isBoss        true for boss fight (not allowed to flee).
 * @yield {BattleResult}  The result of the battle.
 */
battle.start = function*(enemyTeam, isBoss) {
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
    Global.battle.enemy[i] = new BattleEnemy();
    var w = GameData.enemyTeam[enemyTeam].enemy[i];

    if (w == 0xFFFF) {
      break;
    }

    if (w != 0) {
      Global.battle.enemy[i].e = GameData.enemy[GameData.object[w].enemy.enemyID];
      Global.battle.enemy[i].objectID = w;
      Global.battle.enemy[i].state = FighterState.Wait;
      Global.battle.enemy[i].scriptOnTurnStart = GameData.object[w].enemy.scriptOnTurnStart;
      Global.battle.enemy[i].scriptOnBattleEnd = GameData.object[w].enemy.scriptOnBattleEnd;
      Global.battle.enemy[i].scriptOnReady = GameData.object[w].enemy.scriptOnReady;
      Global.battle.enemy[i].colorShift = 0;
    }
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
  //PAL_LoadBattleSprites();
  //PAL_LoadBattleBackground();

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

  Global.battle.UI.msg[0] = '\0';
  Global.battle.UI.nextMsg[0] = '\0';
  Global.battle.UI.msgShowTime = 0;
  Global.battle.UI.state = BattleUIState.Wait;
  Global.battle.UI.autoAttack = false;
  Global.battle.UI.selectedIndex = 0;
  Global.battle.UI.prevEnemyTarget = 0;

  utils.fillArray(Global.battle.UI.showNum, uibattle.ShowNum);
  //memset(Global.battle.UI.rgShowNum, 0, sizeof(Global.battle.UI.rgShowNum));

  Global.battle.summonSprite = null;
  Global.battle.sBackgroundColorShift = 0;

  Global.inBattle = true;
  Global.battle.BattleResult = BattleResult.PreBattle;

  battle.updateFighters();

  // Load the battle effect sprite.
  Global.battle.effectSprite = Files.DATA.readChunk(10);

  Global.battle.phase = BattlePhase.SelectAction;
  Global.battle.repeat = false;
  Global.battle.force = false;
  Global.battle.flee = false;

  //#ifdef PAL_ALLOW_KEYREPEAT
  //SDL_EnableKeyRepeat(120, 75);
  //#endif

  // Run the main battle routine.
  var result = yield battle.main();

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

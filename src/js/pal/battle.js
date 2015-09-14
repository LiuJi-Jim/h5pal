import scene from './scene';
import Palette from './palette';
import fight from './fight';

log.trace('battle module load');

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

global.BattleAction = defineStruct(
  /*
  BATTLEACTIONTYPE   ActionType;
  WORD               wActionID;   // item/magic to use
  SHORT              sTarget;     // -1 for everyone
  FLOAT              flRemainingTime;  // remaining waiting time before the action start
  */
  'BattleAction',
  `actionType|WORD actionID|WORD target|SHORT remainingTime|FLOAT`
);

global.BattleEnemy = defineStruct(
  /*
  WORD               wObjectID;              // Object ID of this enemy
  ENEMY              e;                      // detailed data of this enemy
  WORD               rgwStatus[kStatusAll];  // status effects
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
  'BattleEnemy',
  `objectID|WORD
   e|@Enemy
   status|WORD*${PlayerStatus.All}
   timeMeter|FLOAT
   poisons|@PoisonStatus*${Const.MAX_POISONS}
   pos|INT
   originalPos|INT
   currentFrame|WORD
   state|WORD
   turnStart|BOOL
   firstMoveDone|BOOL
   dualMove|BOOL
   scriptOnTurnStart|WORD
   scriptOnBattleEnd|WORD
   scriptOnReady|WORD
   prefHP|WORD
   colorShift|INT`
);

global.BattlePlayer = defineStruct(
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
  'BattlePlayer',
  `colorShift|INT
   timeMeter|FLOAT
   timeSpeedModifier|FLOAT
   hidingTime|WORD
   pos|INT
   originalPos|INT
   currentFrame|WORD
   state|WORD
   action|WORD
   defending|BOOL
   prevHP|WORD
   prevMP|WORD`
);

global.Summon = defineStruct(
  'Summon',
  `currentFrame|WORD`
);

var MAX_BATTLE_ACTIONS = 256;
var MAX_BATTLE_ENEMIES = 256;

global.BattlePhase = {
  SelectAction:  0,
  PerformAction: 1
};

global.ActionQueue = defineStruct(
  'ActionQueue',
  `isEnemy|BOOL
   dexterity|WORD
   index|WORD`
);

Const.MAX_ACTIONQUEUE_ITEMS = (Const.MAX_PLAYERS_IN_PARTY + Const.MAX_ENEMIES_IN_TEAM * 2);

global.Battle = defineStruct(
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
  'Battle',
  `player|@BattlePlayer*${Const.MAX_PLAYERS_IN_PARTY}
   enemy|@Enemy*${Const.MAX_ENEMIES_IN_TEAM}
   maxEnemyIndex|WORD
   backgroundColorShift|SHORT
   summonPos|INT
   summonFrame|INT
   expGained|INT
   cachGained|INT
   isBoss|BOOL
   enemyCleared|BOOL
   BattleResult|WORD
   enemyMoving|BOOL
   hidingTime|INT
   movingPlayerIndex|WORD
   blog|INT

   phase|WORD
   actionQueue|@ActionQueue*${Const.MAX_ACTIONQUEUE_ITEMS}
   curAction|INT
   repeat|BOOL
   force|BOOL
   flee|BOOL`
);

var playerPos = [
  [[240, 170]],                         // one player
  [[200, 176], [256, 152]],             // two players
  [[180, 180], [234, 170], [270, 146]]  // three players
];

var battle = {
};

var surface = null

battle.init = function*(surf) {
  log.trace('[BATTLE] init');
  global.battle = battle;
  surface = surf;
  yield fight.init(surf);

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
  return BattleResult.Won;
}

export default battle;

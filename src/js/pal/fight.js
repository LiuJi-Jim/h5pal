import battle from './battle';
import script from './script';

log.trace('fight module load');

var surface = null

var fight = {};

fight.init = function*(surf) {
  var battle = require('pal/battle');
  log.trace('[BATTLE] init fight');
  surface = surf;

  /**
   * Pick an enemy target automatically.
   * @return {Number}
   */
  battle.selectAutoTarget = function() {

  };

  /**
   * Delay a while during battle.
   * @param {Number} duration      Number of frames of the delay.
   * @param {Number} objectID      The object ID to be displayed during the delay.
   * @param {Boolean} updateGesture true if update the gesture for enemies, false if not.
   */
  battle.battleDelay = function*(duration, objectID, updateGesture) {

  };

  /**
   * Update players' and enemies' gestures and locations in battle.
   */
  battle.updateFighters = function() {

  };

  /**
   * Check if there are player who is ready.
   */
  battle.playerCheckReady = function() {

  };

  /**
   * Called once per video frame in battle.
   */
  battle.startFrame = function*() {

  };

  /**
   * Commit the action which the player decided.
   * @param  {Boolean} repeat true if repeat the last action.
   */
  battle.commitAction = function(repeat) {

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

  };

  /**
   * Calculate the base damage value of attacking.
   * @param  {Number} attackStrength attack strength of attacker.
   * @param  {Number} defense        defense value of inflictor.
   * @return {Number}                The base damage value of the attacking.
   */
  battle.calcBaseDamage = function(attackStrength, defense) {

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

  };

  /**
   * Calculate the damage value of physical attacking.
   * @param  {Number} attackStrength   attack strength of attacker.
   * @param  {Number} defense          defense value of inflictor.
   * @param  {Number} attackResistance inflictor's resistance to physical attack.
   * @return {Number}                  The damage value of the physical attacking.
   */
  battle.calcPhysicalAttackDamage = function(attackStrength, defense, attackResistance) {

  };

  /**
   * Get the dexterity value of the enemy.
   * @param  {Number} enemyIndex the index of the enemy.
   * @return {Number}            The dexterity value of the enemy.
   */
  battle.getEnemyDexterity = function(enemyIndex) {

  };

  /**
   * Get player's actual dexterity value in battle.
   * @param  {Number} playerRole the player role ID.
   * @return {Number}            The player's actual dexterity value.
   */
  battle.getPlayerActualDexterity = function(playerRole) {

  };

  /**
   * Backup HP and MP values of all players and enemies.
   */
  battle.battleBackupStat = function() {

  };

  /**
   * Display the HP and MP changes of all players and enemies.
   * @return {Boolean} true if there are any number displayed, false if not.
   */
  battle.displayStatChange = function() {

  };

  /**
   * Essential checks after an action is executed.
   * @param  {Boolean} checkPlayers true if check for players, false if not.
   */
  battle.postActionCheck = function(checkPlayers) {

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

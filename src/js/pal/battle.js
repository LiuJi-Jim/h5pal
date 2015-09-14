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

var battle = {
};

var surface = null

battle.init = function*(surf) {
  log.trace('[BATTLE] init');
  global.battle = battle;
  surface = surf;
  yield fight.init(surf);
};

battle.start = function*() {
  return BattleResult.Won;
}

export default battle;

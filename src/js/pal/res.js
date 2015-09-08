import ajax from './ajax';

/**
 * @module res
 * 由于资源加载已经都放在用时了，这里似乎没用了
 */
var res = {
  loadFlag: 0,

  /**
   * Set flags to load resources.
   * @param {LoadFlag} flag flags to be set.
   */
  setLoadFlags: function(flag) {
    res.loadFlag |= flag;
  },

  /**
   * Load the game resources if needed.
   */
  loadResources: function*() {
    if (res.loadFlag & LoadFlag.Scene) {
      if (Global.enteringScene) {
        Global.screenWave = 0;
        Global.waveProgression = 0;
      }
      // Free previous loaded scene (sprites and map)
      // Load map
      // Load sprites
      Global.partyOffset = PAL_XY(160, 112);
    }
    if (res.loadFlag & LoadFlag.PlayerSprite) {
      // Free previous loaded player sprites
    }

    // Clear all of the load flags
    res.loadFlag = 0;
  }
};

export default res;

import utils from './utils';
import ajax from './ajax';
import ui from './ui';
import uigame from './uigame';
import input from './input';
import play from './play';
import script from './script';
import res from './res';

log.trace('game module load');

var game = {};

game.init = function*(surf) {
  log.debug('[Game] init');
  global.game = game;
  yield play.init(surf);
};

game.clearPlayerStatus = function() {
  //Global.playerStatus = initTypedArray(PlayerStatus, Const.MAX_PLAYER_ROLES);
  var arr = Global.playerStatus = [];
  for (var i=0; i<Const.MAX_PLAYER_ROLES; ++i) {
    var st = [];
    for (var j=0; j<PlayerStatus.All; ++j) {
      st[j] = 0;
    }
    arr.push(st);
  }
};

game.loadDefaultGame = function*() {
  // Load the default data from the game data files.
  GameData.eventObject = readTypedArray(EventObject, Files.SSS.readChunk(0));
  GameData.scene = readTypedArray(Scene, Files.SSS.readChunk(1));
  GameData.object = readTypedArray(ObjectUnion, Files.SSS.readChunk(2));
  GameData.playerRoles = new PlayerRoles(Files.DATA.readChunk(3));
  // Set some other default data.
  utils.extend(Global, {
    cash: 0,
    numMusic: 0,
    numPalette: 0,
    numScene: 1,
    collectValue: 0,
    nightPalette: false,
    maxPartyMemberIndex: 0,
    viewport: PAL_XY(0, 0),
    layer: 0,
    chaseRange: 1
  });
  if (!PAL_CLASSIC) {
    Global.battleSpeed = 2;
  }
  Global.enteringScene = 1;
  //utils.extend(Global, {
  //  inventory: initTypedArray(Inventory, Const.MAX_INVENTORY),
  //  poisonStatus: [],
  //  party: initTypedArray(Party, Const.MAX_PLAYABLE_PLAYER_ROLES),
  //  trail: initTypedArray(Trail, Const.MAX_PLAYABLE_PLAYER_ROLES),
  //  exp: new AllExperience(null),
  //  enteringScene: true
  //});
  //for (var i=0; i<Const.MAX_POISONS; ++i){
  //  Global.poisonStatus[i] = initTypedArray(PoisonStatus, Const.MAX_PLAYABLE_PLAYER_ROLES);
  //}
  for (var i=0; i<Const.MAX_PLAYER_ROLES; ++i) {
    AllExperience.types.forEach(function(name) {
      Global.exp[name][i].level = GameData.playerRoles.level[i];
    });
  }
};

/**
 * Initialize global game data.
 */
game.initGlobalGameData = function*() {
  //yield ajax.loadMKF('SSS', 'DATA');
  GameData.scriptEntry = readTypedArray(ScriptEntry, Files.SSS.readChunk(4));
  GameData.store = readTypedArray(Store, Files.DATA.readChunk(0));
  GameData.enemy = readTypedArray(Enemy, Files.DATA.readChunk(1));
  GameData.enemyTeam = readTypedArray(EnemyTeam, Files.DATA.readChunk(2));
  GameData.magic = readTypedArray(Magic, Files.DATA.readChunk(4));
  GameData.battleField = readTypedArray(BattleField, Files.DATA.readChunk(5));
  GameData.levelUpMagic = readTypedArray(LevelUpMagicAll, Files.DATA.readChunk(6));
  GameData.battleEffectIndex = readArray2D(
    Files.DATA.readChunk(11),
    10, 2, 2, 0
  );
  GameData.enemyPos = new EnemyPos(Files.DATA.readChunk(13));
  GameData.levelUpExp = readArray(Files.DATA.readChunk(14), Const.MAX_LEVELS, 2, 0);
};

game.loadGame = function*(slot) {
  // Try to open the specified file
  // Read all data from the file and close.
  try {
    var buf = new Uint8Array((yield ajax.load(slot + '.RPG'))[0]);
    var s = (new SaveData(buf)).copy();
  } catch(ex) {
    return false;
  }
  return game._loadGame(s);
};

game._loadGame = function(s) {
  // Adjust endianness
  //DO_BYTESWAP(&s, sizeof(SAVEDGAME));

  // Cash amount is in DWORD, so do a wordswap in Big-Endian.
  //#if SDL_BYTEORDER == SDL_BIG_ENDIAN
  //s.dwCash = ((s.dwCash >> 16) | (s.dwCash << 16));
  //#endif

  // Get all the data from the saved game struct.
  Global.viewport = PAL_XY(s.viewportX, s.viewportY);
  Global.maxPartyMemberIndex = s.numPartyMember;
  Global.numScene = s.numScene;
  Global.nightPalette = (s.paletteOffset != 0);
  Global.partyDirection = s.partyDirection;
  Global.numMusic = s.numMusic;
  Global.numBattleMusic = s.numBattleMusic;
  Global.numBattleField = s.numBattleField;
  Global.screenWave = s.screenWave;
  Global.waveProgression = 0;
  Global.collectValue = s.collectValue;
  Global.layer = s.layer;
  Global.chaseRange = s.chaseRange;
  Global.chaseSpeedChangeCycles = s.chaseSpeedChangeCycles;
  Global.numFollower = s.numFollower;
  Global.cash = s.cash;
  if (!PAL_CLASSIC) {
    Global.battleSpeed = s.battleSpeed;
    if (Global.battleSpeed > 5 || Global.battleSpeed == 0) {
      Global.battleSpeed = 2;
    }
  }
  //Global.party = s.party;
  memcpy(Global.party.uint8Array, s.party.uint8Array, Global.party.uint8Array.length);
  //Global.trail = s.trail;
  memcpy(Global.trail.uint8Array, s.trail.uint8Array, Global.trail.uint8Array.length);
  //Global.exp = s.exp;
  memcpy(Global.exp.uint8Array, s.exp.uint8Array, Global.exp.uint8Array.length);
  GameData.playerRoles = s.playerRoles;
  //Global.poisonStatus = [];
  memset(Global.poisonStatus.uint8Array, 0, Global.poisonStatus.uint8Array.length);
  //for (var i=0; i<Const.MAX_POISONS; ++i){
  //  Global.poisonStatus[i] = initTypedArray(PoisonStatus, Const.MAX_PLAYABLE_PLAYER_ROLES);
  //}
  memcpy(Global.inventory.uint8Array, s.inventory.uint8Array, Global.inventory.uint8Array.length);
  //Global.inventory = s.inventory;
  GameData.scene = s.scene;
  GameData.object = s.object;
  GameData.eventObject = s.eventObject;
  GameData.enteringScene = false;

  //PAL_CompressInventory();
  script.compressInventory();

  // Success
  return true;
};

game._saveGame = function() {
  var saveData = new SaveData();

  saveData.viewportX = PAL_X(Global.viewport);
  saveData.viewportY = PAL_Y(Global.viewport);
  saveData.numPartyMember = Global.maxPartyMemberIndex;
  saveData.numScene = Global.numScene;
  saveData.paletteOffset = (Global.nightPalette ? 0x180 : 0);
  saveData.partyDirection = Global.partyDirection;
  saveData.numMusic = Global.numMusic;
  saveData.numBattleMusic = Global.numBattleMusic;
  saveData.numBattleField = Global.numBattleField;
  saveData.screenWave = Global.screenWave;
  saveData.collectValue = Global.collectValue;
  saveData.layer = Global.layer;
  saveData.chaseRange = Global.chaseRange;
  saveData.chaseSpeedChangeCycles = Global.chaseSpeedChangeCycles;
  saveData.numFollower = Global.numFollower;
  saveData.cash = Global.cash;
  if (!PAL_CLASSIC) {
    saveData.battleSpeed = Global.battleSpeed;
    if (saveData.battleSpeed > 5 || saveData.battleSpeed == 0) {
      saveData.battleSpeed = 2;
    }
  }
  memcpy(saveData.party.uint8Array, Global.party.uint8Array, saveData.party.uint8Array.length);
  memcpy(saveData.trail.uint8Array, Global.trail.uint8Array, saveData.trail.uint8Array.length);
  memcpy(saveData.exp.uint8Array, Global.exp.uint8Array, saveData.exp.uint8Array.length);
  memcpy(saveData.playerRoles.uint8Array, GameData.playerRoles.uint8Array, saveData.playerRoles.uint8Array.length);
  memcpy(saveData.poisonStatus.uint8Array, Global.poisonStatus.uint8Array, saveData.poisonStatus.uint8Array.length);
  memcpy(saveData.inventory.uint8Array, Global.inventory.uint8Array, saveData.inventory.uint8Array.length);
  memcpy(saveData.scene.uint8Array, GameData.scene.uint8Array, saveData.scene.uint8Array.length);
  memcpy(saveData.object.uint8Array, GameData.object.uint8Array, saveData.object.uint8Array.length);
  memcpy(saveData.eventObject.uint8Array, GameData.eventObject.uint8Array, saveData.eventObject.uint8Array.length);

  return saveData;
};

game.initGameData = function*(slot) {
  yield game.initGlobalGameData();

  Global.currentSaveSlot = slot;

  // try loading from the saved game file.
  if (slot == 0 || !(yield game.loadGame(slot))) {
    // Cannot load the saved game file. Load the defaults.
    yield game.loadDefaultGame();
  }

  Global.gameStart = true;
  Global.needToFadeIn = false;
  Global.curInvMenuItem = 0;
  Global.inBattle = false;

  //game.clearPlayerStatus();
  memset(Global.playerStatus.uint8Array, 0, Global.playerStatus.uint8Array.length);
  yield script.updateEquipments();
};

game._initGameData = function*(s) {
  yield game.initGlobalGameData();

  game._loadGame(s);

  Global.gameStart = true;
  Global.needToFadeIn = false;
  Global.curInvMenuItem = 0;
  Global.inBattle = false;

  //game.clearPlayerStatus();
  memset(Global.playerStatus.uint8Array, 0, Global.playerStatus.uint8Array.length);
  yield script.updateEquipments();
};

/**
 * Do some initialization work when game starts (new game or load game).
 */
game.start = function*() {
  res.setLoadFlags(LoadFlag.Scene | LoadFlag.PlayerSprite);
  if (!Global.enteringScene) {
    // pal.music.play(Global.musicNum, true, 1);
  }
  Global.needToFadeIn = true;
  Global.frameNum = 0;

  input.init();
  input.clear();
};

/**
 * The game entry routine.
 */
game.main = function*() {
  var slot = yield uigame.openingMenu(); // 主菜单
  //var slot = 5;
  Global.currentSaveSlot = slot;
  yield game.initGameData(slot); // 加载游戏

  while (true) {
    if (Global.gameStart) {
      yield game.start();
      Global.gameStart = false;
    }
    yield res.loadResources();
    input.clear();
    yield sleepByFrame(1);
    //try {
      yield play.startFrame();
    //} catch(ex) {
    //  log.warning('[GAME] play.startFrame() error `' + ex + '`');
    //  console.log(ex);
    //}
  }
};

game.shutdown = function() {
  console.log('over了...');
};

export default game;

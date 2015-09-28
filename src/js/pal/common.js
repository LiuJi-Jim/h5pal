global.PAL_CLASSIC = true;
global.INVINCIBLE = false;
global.SUPER_ATTACK = false;
global.SUPER_DEFENSE = false;

var slice = Array.prototype.slice;

/**
 * DEBUG配置
 * @global
 * @type {Object}
 */
global.DEBUG = {
  Timing: false,
  ShowSpriteRect: false,
  ShowSpritePos:  false,
  ShowSpriteSize: false,
};

var log = global.log = {
  level: 2,
  write: function(level) {
    if (level < log.level) return;
    var args = slice.call(arguments, 1);
    var str = sprintf.apply(this, args);
    console.log('[' + logLevelMap[level] + '] ' + str);
  }
}

var logLevelMap = [];

global.LogLevel = {
  Trace: 0,
  Debug: 1,
  Notice: 2,
  Warning: 3,
  Fatal: 4
};

for (var name in LogLevel) {
  var level = LogLevel[name];
  logLevelMap[level] = name;
  name = name.toLowerCase();
  log[name] = log.write.bind(log, level);
}

/**
 * 游戏速度倍率
 * @global
 * @type {Number}
 */
global.GameSpeed = 2;

global.FPS = 24;

global.FrameTime = (1000 / global.FPS);

/* 坐标相关 */
/**
 * x, y转POS
 * @global
 * @param {int} x
 * @param {int} y
 * @return {POS}
 */
global.PAL_XY = function(x, y) {
  //return x+','+y;
  return (((y << 16) & 0xFFFF0000) | (x & 0xFFFF));
};

/**
 * x, y转POS
 * @global
 * @param {int} y
 * @param {int} x
 * @return {POS}
 */
global.PAL_YX = function(y, x) {
  return (((y << 16) & 0xFFFF0000) | (x & 0xFFFF));
};

/**
 * POS取x
 * @global
 * @param {POS} yx
 * @return {int} x
 */
global.PAL_X = function(yx) {
  //return parseInt(yx.split(',')[0], 10);
  var ret = (yx & 0xFFFF);
  if (ret > 0x8000) ret -= 0x10000;
  return ret;
};

/**
 * POS取y
 * @global
 * @param {POS} yx
 * @return {int} y
 */
global.PAL_Y = function(yx) {
  //return parseInt(yx.split(',')[1], 10);
  var ret = ((yx >> 16) & 0xFFFF);
  if (ret > 0x8000) ret -= 0x10000;
  return ret;
};

global.PAL_XYH_TO_POS = function(x, y, h) {
  // 用位运算会更快吗
  return PAL_POS((x << 5) + (h << 4), (y << 4) + (h << 3));
  //return PAL_POS((x) * 32 + (h) * 16, (y) * 16 + (h) * 8);
};

global.PAL_POS_TO_XYH = function(pos) {
  // 用位运算会更快吗？
  return {
    h: (((PAL_X(pos) & 31) !== 0) ? 1 : 0),
    x: (PAL_X(pos) >> 5),
    y: (PAL_Y(pos) >> 4)
  };
  /*
  return {
    h: (((PAL_X(pos) % 32) !== 0) ? 1 : 0),
    x: (PAL_X(pos) / 32),
    y: (PAL_Y(pos) / 16)
  };
  */
};

global.RECT = function(x, y, w, h) {
  //return {
  //  x: x | 0,
  //  y: y | 0,
  //  w: w | 0,
  //  h: h | 0
  //};
  // 据说这样可以实现hidden type优化
  // 无new实例化
  if (!(this instanceof global.RECT)) return new global.RECT(x, y, w, h);
  this.x = x | 0;
  this.y = y | 0;
  this.w = w | 0;
  this.h = h | 0;
};

/* -------------------------------------------------- */
/**
 * 高精度计时（在不支持的时候会使用低精度）
 * @method
 * @return {Double} 毫秒
 */
global.hrtime = (function(){
  if (typeof window !== 'undefined') {
    // browser
    if (typeof window.performance !== 'undefined' && typeof performance.now !== 'undefined'){
      // support hrt
      return function() {
        return performance.now();
      };
    } else {
      // oh no..
      return function() {
        return (new Date()).getTime();
      };
    }
  } else {
    // node.js
    return function() {
      var diff = process.hrtime();
      return (diff[0] * 1e9 + diff[1]) / 1e6; // nano second -> ms
    };
  }
})();

/* -------------------------------------------------- */
global.isNumber = function(a){
  //return (a == +a);
  return !isNaN(a); // WARNING 靠不靠谱呢
};

global.toArray = function(obj) {
  return slice.call(obj, 0);
};

global.noop = function() {
  // nothing
};

global.timestamp = function() {
  //return (new Date()).getTime();
  return global.hrtime();
};

/**
 * 生成随机整数
 *
 * @param  {Number} min 下界（包含）
 * @param  {Number} max 上界（包含）
 * @return {Number}
 */
global.randomLong = function(min, max) {
  if (max <= min) return min;
  return min + ~~(Math.random() * (max + 1 - min));
};

/**
 * 生成随机浮点数
 *
 * @param  {Number} min 下界（包含）
 * @param  {Number} max 上界（不含）
 * @return {Number}
 */
global.randomFloat = function(min, max) {
  if (max <= min) return min;
  return min + (Math.random() * (max - min));
};

/**
 * SLEEP
 *
 * @param {Number} ms
 * @return {Promise}
 */
global.sleep = function(ms) {
  return new Promise(function(resolve) {
    setTimeout(resolve, ms / GameSpeed);
  })
};

/**
 * SLEEP by frame counts WARNING:TBD
 *
 * @param  {Number} frames frame count to sleep
 * @return {Promise}
 */
global.sleepByFrame = function(frames) {
  return new Promise(function(resolve) {
    setTimeout(resolve, global.FrameTime * frames / GameSpeed);
  });
};

Promise.prototype.spread = function(resolve, reject) {
  return this.then(function(array) {
      return resolve.apply(this, array);
  }, reject);
};

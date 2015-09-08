// 调色盘类
import utils from './utils';

log.trace('palette module load');

/**
 * 调色盘对象
 * @constructor
 * @param  {Uint8Array} buf
 * @return {Palette}
 */
var Palette = function(buf) {
  this.buf = buf;
  /**
   * 白天
   * @name day
   * @memberof Palette#
   * @type {Array}
   */
  this.day = new Array(256);
  /**
   * 夜晚
   * @name night
   * @memberof Palette#
   * @type {Array}
   */
  this.night = new Array(256);
  for (i = 0; i < 256; i++) {
    this.day[i] = {
      r: buf[i * 3] << 2,
      g: buf[i * 3 + 1] << 2,
      b: buf[i * 3 + 2] << 2
    };
    this.night[i] = {
      r: buf[256 * 3 + i * 3] << 2,
      g: buf[256 * 3 + i * 3 + 1] << 2,
      b: buf[256 * 3 + i * 3 + 2] << 2
    };
  }
};

utils.extend(Palette.prototype, {
});

var cache = [];
var PAT = null;

var palette = {};

palette.init = function(pat) {
  PAT = pat;
};

palette.get = function(num, night) {
  var pat = cache[num];
  if (!pat) {
    pat = new Palette(PAT.readChunk(num));
    cache[num] = pat;
  }
  if (typeof night === 'undefined') {
    return pat;
  }
  return night ? pat.night : pat.day;
};

export default palette;

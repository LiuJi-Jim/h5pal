// 文件方式的访问Map
// 依赖MKF
import utils from './utils';
import MKF from './mkf';
import Sprite from './sprite';
//var yj_1 = require('./yj_1');

log.trace('map module load');

/**
 * 地图对象
 * @constructor
 * @param  {int} mapNum
 * @param  {Uint8Array} tiles
 * @param  {Sprite} sprite
 */
var Map = function(mapNum, tiles, sprite) {
  /**
   * 地图编号
   * @type {int}
   */
  this.mapNum = mapNum;
  /**
   * Tiles
   * @type {Uint32Array}
   */
  this.tiles = new Uint32Array(tiles.buffer, tiles.byteOffset, tiles.byteLength / 4);
  /**
   * Sprites
   * @type {Sprites}
   */
  //this.sprite = new Sprites(sprite);
  this.sprite = sprite
};

// 静态方法
utils.extend(Map, {
  /**
   * 从Chunk加载地图
   * @memberOf Map.
   * @param  {int} mapNum
   * @param  {Uint8Array} tiles
   * @param  {Sprite} sprite
   * @return {Map}
   */
  fromChunk: function(mapNum, tiles, sprite) {
    return new Map(mapNum, tiles, sprite);
  },
  /**
   * 从文件加载地图
   * @memberOf Map.
   * @param  {int} mapNum
   * @param  {MKF} map
   * @param  {MKF} gop
   * @return {Map}
   */
  fromFile: function(mapNum, map, gop) {
    var tiles  = map.decompressChunk(mapNum),
        sprite = new Sprite(gop.readChunk(mapNum));
    if (!tiles) return null;
    return Map.fromChunk(mapNum, tiles, sprite);
  }
});

utils.extend(Map.prototype, {
  /**
   * 根据坐标获取Tile
   * @memberOf Map#
   * @param  {int} y
   * @param  {int} x
   * @param  {int} h
   * @return {int}
   */
  getTile: function(y, x, h) {
    return this.tiles[y * 64 * 2 + x * 2 + h];
  },
  /**
   * 根据坐标获取一个Tile的Sprite
   * @memberOf Map#
   * @param  {int} x
   * @param  {int} y
   * @param  {int} h
   * @param  {int} layer
   * @return {RLE}
   */
  getTileBitmap: function(x, y, h, layer) {
    if (x >= 64 || y >= 128 || h >= 2) {
      return false;
    }
    // map tile info of this location
    var d = this.getTile(y, x, h);

    if (layer === 0){
      // 底层Tile，用低16位
      return this.sprite.frames[(d & 0xFF) | ((d >> 4) & 0x100)];
    }else{
      // 覆盖层Tile，用高16位
      d >>= 16;
      return this.sprite.frames[((d & 0xFF) | ((d >> 4) & 0x100)) - 1];
    }
  },
  /**
   * 根据坐标检测是否被阻挡
   * @memberOf Map#
   * @param  {int}  x
   * @param  {int}  y
   * @param  {int}  h
   * @return {Boolean}
   */
  isTileBlocked: function(x, y, h) {
    if (x >= 64 || y >= 128 || h >= 2) {
      return true;
    }

    return ((this.getTile(y, x, h) & 0x2000) >> 13) == 1;
  },
  /**
   * 根据坐标检测某个块的高度
   * @param  {int} x
   * @param  {int} y
   * @param  {int} h
   * @param  {int} layer
   * @return {int}
   */
  getTileHeight: function(x, y, h, layer) {
    if (x >= 64 || y >= 128 || h >= 2) {
      return 0;
    }
    var d = this.getTile(y, x, h);
    if (layer){
      d >>= 16
    }
    d >>= 8;
    var ret = d & 0xf;
    if (d < 0){
      throw 'maybe err';
    }
    return ret;
  }
});

export default Map;

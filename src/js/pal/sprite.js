import utils from './utils';
import RLE from './rle';

log.trace('sprite module load');

/**
 * 一组Sprite动画
 * @constructor
 * @param  {Uint8Array} buf
 */
var Sprite = function(buf) {
  this.buf = buf;
  /**
   * 帧数
   * @name frameCount
   * @memberof Sprite
   * @type {int}
   */
  this.reader = new BinaryReader(buf);
  this.frameCount = this.getFrameCount();
  this.readAll();
};

utils.extend(Sprite.prototype, {
  /**
   * 获取帧数
   * @memberOf Sprite#
   * @return {int}
   */
  getFrameCount: function() {
    return (this.reader.getUint16(0) - 1);
  },
  /**
   * 获取帧偏移量
   * @memberOf Sprite#
   * @param  {int} frameNum
   * @return {int}
   */
  getFrameOffset: function(frameNum) {
    if (frameNum >= this.frameCount) {
      return false;
    }
    frameNum <<= 1;
    var offset = WORD(this.reader.getUint16(frameNum) << 1);
    return offset;
  },
  /**
   * 获取某一帧
   * @memberOf Sprite#
   * @param  {int} frameNum
   * @return {Uint8Array}
   */
  getFrame: function(frameNum) {
    var offset = this.getFrameOffset(frameNum);
    if (offset === false) return false;

    var ret = this.buf.subarray(offset);
    //ret.width = PAL_RLEGetWidth(ret);
    //ret.height = PAL_RLEGetHeight(ret);
    var rle = RLE(ret);
    return rle;
  },
  /**
   * 读取所有帧到this.frames
   * @memberOf Sprite#
   * @return {Array}
   */
  readAll: function() {
    if (this.frames) return this.frames;
    var count = this.frameCount;
    if (count <= 0) {
      this.frames = [];
      return;
    }
    this.frames = new Array(count);
    for (var i=0; i<count; ++i) {
      this.frames[i] = this.getFrame(i);
    }
  }
});

/**
 * 从MKF构建所有的Sprite
 * @param  {MKF} mkf
 * @return {Array} 内含若干个Sprite（可能为null）
 */
Sprite.fromMKF = function(mkf, decompress){
  var count = mkf.getChunkCount();
  var arr = new Array(count);
  decompress = decompress || false;
  for (var i=0; i<count; ++i) {
    var buf = mkf[decompress ? 'decompressChunk' : 'readChunk'](i);
    if (buf) {
      var sprite = new Sprite(buf);
      arr[i] = sprite;
    } else {
      arr[i] = null;
    }
  }
  return arr;
};

export default Sprite;

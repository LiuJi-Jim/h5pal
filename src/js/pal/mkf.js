// 对象方式的mkf文件读取
// decompress需要yj_1

import utils from './utils';
import yj_1 from './yj_1';

log.trace('mkf module load');

/**
 * MKF文件
 * @constructor
 * @param  {Uint8Array} buf
 * @return {MKF}
 */
var MKF = function(buf) {
  this.arraybuffer = buf;
  this.reader = new BinaryReader(buf);
  this.buf = new LPBYTE(buf);
  this.chunkCount = this.getChunkCount();
  this._chunks = new Array(this.chunkCount);
  this._decompressedChunks = new Array(this.chunkCount);
};

utils.extend(MKF.prototype, {
  /**
   * 读取一个片段
   * @memberOf MKF#
   * @param  {int} chunkNum
   * @return {Uint8Array}
   */
  readChunk: function(chunkNum) {
    // Get the total number of chunks.
    if (chunkNum >= this.getChunkCount()) {
      return new Uint8Array(0);
    }

    if (this._chunks[chunkNum]) return this._chunks[chunkNum];

    var chunkLen = this.getChunkSize(chunkNum);

    if (chunkLen !== 0) {
      // WARNING:
      // 这里的选择是TypedArray.subarray的结果
      // 因为据说TypedArray.subarray实现是共享内存，可能存在内存共享写错误
      var fp = this.buf;
      // Get the offset of the chunk.
      var offsetFP = 4 * chunkNum,
          offset = this.reader.getUint32(offsetFP + 0);
      var buf = fp.subarray(offset, offset + chunkLen);
      /*
      var buf = new Uint8Array();
      for (var i=0; i<chunkLen; ++i){
        buf[i] = fp[offset + i];
      }
      */
      return (this._chunks[chunkNum] = buf);
    } else {
      return (this._chunks[chunkNum] = new Uint8Array(0));
    }
  },
  /**
   * 片段数
   * @memberOf MKF#
   * @return {int}
   */
  getChunkCount: function() {
    var count = this.reader.getUint32(0);
    count = ~~((count - 4) / 4);
    return count;
  },
  /**
   * 获取片段大小
   * @memberOf MKF#
   * @param  {int} chunkNum
   * @return {int}
   */
  getChunkSize: function(chunkNum) {
    // Get the total number of chunks.
    if (chunkNum >= this.getChunkCount()) {
      return -1;
    }

    // Get the offset of the specified chunk and the next chunk.
    var offsetFP = 4 * chunkNum,
        buf = this.buf;
    var offset     = this.reader.getUint32(offsetFP + 0);
    var nextOffset = this.reader.getUint32(offsetFP + 4);

    // Return the length of the chunk.
    return nextOffset - offset;
  },
  /**
   * 获取解压后的片段大小
   * @memberOf MKF#
   * @param  {int} chunkNum
   * @return {int}
   */
  getDecompressedSize: function(chunkNum) {
    if (chunkNum >= this.getChunkCount()) {
      return -1;
    }

    // Get the offset of the chunk.
    var buf = this.buf,
        offsetFP = this.reader.getUint32(buf, 4 * chunkNum);

    // Read the header.
    var buf_0 = this.reader.getUint32(buf, offsetFP + 0);
    var buf_1 = this.reader.getUint32(buf, offsetFP + 4);

    return (buf_0 != 0x315f4a59) ? -1 : buf_1;
  },
  /**
   * 解压片段
   * @memberOf MKF#
   * @param  {int} chunkNum
   * @return {int}
   */
  decompressChunk: function(chunkNum) {
    if (this._decompressedChunks[chunkNum]) return this._decompressedChunks[chunkNum];
    var buf = this.readChunk(chunkNum);
    return (this._decompressedChunks[chunkNum] = yj_1.decompress(buf));
  }
});

export default MKF;

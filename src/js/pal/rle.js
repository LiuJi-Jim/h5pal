log.trace('rle module load');

/**
 * RLE，对Uint8Array进行一次封装，封装了width/height/content属性
 * @param {Uint8Array} buf
 */
var RLEMixin = {
  width: {
    get: function() {
      return this.reader.getUint16(0);
    }
  },
  height: {
    get: function() {
      return this.reader.getUint16(2);
    }
  },
  content: {
    get: function() {
      return this.tmp.subarray(4);
    }
  }
};

var RLE = function(buf) {
  var tmp = buf;
  if (!buf) return null;
  // Skip the 0x00000002 in the file header.
  if (tmp[0] === 0x02 && tmp[1] === 0x00 &&
      tmp[2] === 0x00 && tmp[3] === 0x00) {
    tmp = tmp.subarray(4);
  }

  buf.tmp = tmp;
  buf.reader = new BinaryReader(tmp);
  Object.defineProperties(buf, RLEMixin);

  // Get the width and height of the bitmap.
  //buf.width = tmp[0] | (tmp[1] << 8);
  //buf.height = tmp[2] | (tmp[3] << 8);

  //buf.content = tmp.subarray(4);

  return buf;
};

export default RLE;

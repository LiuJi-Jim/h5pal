/* 类型定义 */
var typeDefine = {
  '1':      'Uint8',
  '2':      'Uint16',
  '4':      'Uint32',

  'u8':     'Uint8',
  'UCHAR':  'Uint8',
  'BYTE':   'Uint8',
  'i8':     'Int8',
  'CHAR':   'Int8',

  'u16':    'Uint16',
  'WORD':   'Uint16',
  'USHORT': 'Uint16',
  'i16':    'Int16',
  'SHORT':  'Int16',

  'u32':    'Uint32',
  'UINT':   'Uint32',
  'UINT32': 'Uint32',
  'DWORD':  'Uint32',

  'i32':    'Int32',
  'INT':    'Int32',
  'BOOL':   'Int32',

  'FLOAT':  'Float32'
};

var sizeMap = {
    'Uint8': 1,
     'Int8': 1,
   'Uint16': 2,
    'Int16': 2,
   'Uint32': 4,
    'Int32': 4,
  'Float32': 4
};

var LPBYTE = global.LPBYTE = Uint8Array;

var LPWORD = global.LPWORD = Uint16Array;

var littleEndian = global.LittleEndian = (function() {
  var buffer = new ArrayBuffer(2);
  new DataView(buffer).setInt16(0, 256, true);
  return new Int16Array(buffer)[0] === 256;
})();

var SHORT = global.SHORT = function(x) {
  if (x >= 0x8000) {
    x -= 0x10000;
  }
  return x;
}

var WORD = global.WORD = function(x) {
  if (x < 0) {
    x += 0x10000;
  }
  if (x > 0x10000) {
    x -= 0x10000;
  }
  return x;
}

var SWAP32 = global.SWAP32 = function(x) {
  return x;
};

var SWAP16 = global.SWAP16 = function(x) {
  return x;
};

var memset = global.memset = function(p, val, len) {
  len = len || 0;
  for (var i=0; i<len; ++i) {
    p[i] = val;
  }
};

var memcpy = global.memcpy = function(dst, src, len) {
  len = len || 0;
  for (var i=0; i<len; ++i) {
    dst[i] = src[i];
  }
};

var memmove = global.memmove = function(dst, src, len) {
  var tmp = new dst.constructor(len);
  memcpy(tmp, src, len);
  memcpy(dst, tmp, len);
};

/* 继承DataView */
var BinaryReader = global.BinaryReader = function(buffer, byteOffset, byteLength, littleEndian) {
  if (Array.isArray(buffer)) {
    buffer = new Uint8Array(buffer);
  }
  if (buffer instanceof ArrayBuffer) {
    // 透传
  }else if (typeof buffer.BYTES_PER_ELEMENT == 'number') {
    // Typed Array
    byteOffset = (byteOffset || 0) + buffer.byteOffset;
    byteLength = byteLength || buffer.byteLength;
    buffer = buffer.buffer; // ArrayBuffer;
  }
  this.littleEndian = (typeof littleEndian === 'boolean' ? littleEndian : LittleEndian);
  this._buffer = buffer;
  this._dataview = new DataView(buffer, byteOffset, byteLength);
};

BinaryReader.prototype = Object.create(DataView.prototype);

Object.defineProperties(BinaryReader.prototype, {
  buffer: {
    enumerable: true,
    get: function() {
      return this._buffer;
    }
  },
  byteOffset: {
    enumerable: true,
      get: function() {
      return this._dataview.byteOffset;
    }
  },
  byteLength: {
    enumerable: true,
    get: function() {
      return this._dataview.byteLength;
    }
  },
  dataview: {
    enumerable: true,
    get: function() {
      return this._dataview;
    }
  }
});

['Int', 'Uint', 'Float'].forEach(function(type) {
  [1, 2, 4, 8].forEach(function(size) {
    ['get', 'set'].forEach(function(func) {
      var funcName = type + (size * 8);
      var getFuncName = 'get' + funcName, getFunc = DataView.prototype[getFuncName];
      var setFuncName = 'set' + funcName, setFunc = DataView.prototype[setFuncName];
      BinaryReader.prototype['get' + funcName] = function(byteOffset, littleEndian) {
        if (typeof littleEndian !== 'boolean') littleEndian = this.littleEndian;
        return getFunc.call(this.dataview, byteOffset, littleEndian);
      };
      BinaryReader.prototype['set' + funcName] = function(byteOffset, value, littleEndian) {
        if (typeof littleEndian !== 'boolean') littleEndian = this.littleEndian;
        if (value === true) value = 1;
        if (value === false) value = 0;
        return setFunc.call(this.dataview, byteOffset, value, littleEndian);
      };
    });
  });
});

for (var type in typeDefine) {
  var realType = typeDefine[type];
  BinaryReader.prototype['get' + type] = BinaryReader.prototype['get' + realType];
  BinaryReader.prototype['set' + type] = BinaryReader.prototype['set' + realType];
}

/* 字节读取 */
var readByte = global.readByte = function(p, offset) {
  // 卖萌的吗？希望JIT能内联它吧
  return p[offset];
};

var read2Bytes = global.read2Bytes = function(p, offset) {
  // TODO 这里可能有大小端序问题啊
  /*
  return (((p[offset + 1] <<  8) & 0xFF00) |
          ((p[offset + 0] <<  0) & 0x00FF));
  */
  // 更快？
  return ((p[offset + 0] << 0) |
          (p[offset + 1] << 8));

  /*
  return (((p[offset + 0] <<  8) & 0xFF00) |
          ((p[offset + 1] <<  0) & 0x00FF));
  */
};

var read4Bytes = global.read4Bytes = function(p, offset) {
  // TODO 这里可能有大小端序问题啊
  /*
  return (((p[offset + 3] << 24) & 0xFF000000) |
          ((p[offset + 2] << 16) & 0x00FF0000) |
          ((p[offset + 1] <<  8) & 0x0000FF00) |
          ((p[offset + 0] <<  0) & 0x000000FF));
  */
  // 更快？
  return ((p[offset + 0] <<  0) |
          (p[offset + 1] <<  8) |
          (p[offset + 2] << 16) |
          (p[offset + 3] << 24));

  /*
  return (((p[offset + 0] << 24) & 0xFF000000) |
          ((p[offset + 1] << 16) & 0x00FF0000) |
          ((p[offset + 2] <<  8) & 0x0000FF00) |
          ((p[offset + 0] <<  0) & 0x000000FF));
  */
};

var writeByte = global.writeByte = function(p, offset, val) {
  p[offset] = val;
};

var write2Bytes = global.write2Bytes = function(p, offset, val) {
  p[offset + 0] = ((val && 0xFF00) >> 8);
  p[offset + 1] = ((val && 0x00FF) >> 0);
};

var write4Bytes = global.write4Bytes = function(p, offset, val) {
  p[offset + 0] = ((val && 0xFF000000) >> 24);
  p[offset + 1] = ((val && 0x00FF0000) >> 16);
  p[offset + 2] = ((val && 0x0000FF00) >>  8);
  p[offset + 3] = ((val && 0x000000FF) >>  0);
};

var readString = global.readString = function(buf, offset, len) {
  var str = '';
  for (var i=0; i<len; ++i){
    str += String.fromCharCode(buf[offset + i]);
  }
  return str;
};

var readArray = global.readArray = function(buf, len, size, offset) {
  var arr = new Array(len),
      func = sizeToReadFunc[size];
  for (var i=0; i<len; ++i){
    var val = func(buf, offset + i * size);
    arr[i] = val;
  }
  return arr;
};

var readArray2D = global.readArray2D = function(buf, len1, len2, size, offset) {
  var arr = new Array(len1);
  for (var i=0; i<len1; ++i){
    arr[i] = readArray(buf, len2, size, offset + i * len2 * size);
  }
  return arr;
};

var sizeToReadFunc = {
  '1': readByte,
  '2': read2Bytes,
  '4': read4Bytes
};

var sizeToWriteFunc = {
  '1': writeByte,
  '2': write2Bytes,
  '4': write4Bytes
};

/*
function getter(size, offset){
  var func = sizeToReadFunc[size];
  return function(){
    return func(this.buffer, offset);
  };
}
function setter(size, offset){
  var func = sizeToWriteFunc[size];
  return function(val){
    func(this.buffer, offset, val);
  };
}
*/

function sizeToArray(Type, view, length, offset) {
  var arraybuffer = view.buffer;
  var ret = new Type(arraybuffer, view.byteOffset + offset, length);
  ret.uint8Array = view.subarray(offset, offset + Type.BYTES_PER_ELEMENT * length);
  return ret;
}

function arrayGetter(type, length, offset, name) {
  var key = '__' + name + '__' ;
  var Type = window[type + 'Array'];
  return function() {
    var ret = this[key];
    if (!ret) {
      ret = sizeToArray(Type, this.uint8Array, length, offset);
      this[key] = ret;
    }
    return ret;
  };
}

function array2DGetter(type, len1, len2, offset, name) {
  var key = '__' + name + '__' ;
  var Type = window[type + 'Array'];
  return function() {
    var ret = this[key];
    if (!ret) {
      ret = [];
      for (var i=0; i<len1; ++i) {
        ret.push(sizeToArray(Type, this.uint8Array, len2, offset + i * Type.BYTES_PER_ELEMENT * len2));
      }
      ret.uint8Array = this.uint8Array.subarray(offset, offset + Type.BYTES_PER_ELEMENT * len1 * len2);
      this[key] = ret;
    }
    return ret;
  };
}

function viewGetter(func, offset) {
  return function() {
    return this.view[func](offset);
  };
}

function viewSetter(func, offset) {
  return function(val) {
    if (func.charAt(3) === 'U' && val < 0) {
      val = 0;
    }
    this.view[func](offset, val);
  };
}

global.resolveStruct = function(list) {
  /*
  Example:
  resolveStruct('vanishTime|2 x|1 y|4 z|2*16' w|2*10*2);
  only 1 or 2 or 4
  */
  var arr = [],
      offset = 0;
  arr.str = list;
  list = list.split(/\s+/);
  for (var i=0; i<list.length; ++i){
    var str = list[i];
    if (str.indexOf('|') == -1) continue;
    var split = str.split('|'),
        name = split[0],
        sizetype = split[1]
    var field = {
      name: name,
      offset: offset,
      configurable: true,
      enumerable: true
    };
    var size;
    var mult = sizetype.split('*');
    field.type = mult[0];
    if (field.type.charAt(0) === '@') {
      // 是一个类
      field.type = field.type.substr(1);
      if (!field.type in global){
        throw 'type `' + field.type + '` not defined';
      }
      field.type = global[field.type];
      size = field.type.size;
    } else {
      field.type = typeDefine[field.type];
      size = sizeMap[field.type];
    }

    if (mult.length == 1) {
      field.size = size;
      if (typeof field.type === 'function') {
        // 初始化单个类
        field.get = typeGetter(field.type, field.offset, field.name);
      } else {
        field.get = viewGetter('get' + field.type, field.offset);
        field.set = viewSetter('set' + field.type, field.offset);
      }
      offset += field.size;
    } else {
      if (mult.length == 2) {
        // 一维数组
        var len = field.len  = parseInt(mult[1], 10);
        field.size = size * len;
        var getterFunc;
        if (typeof field.type === 'function') {
          getterFunc = typeArrayGetter;
        } else {
          getterFunc = arrayGetter;
        }
        field.get = getterFunc(field.type, len, field.offset, field.name);
        offset += field.size;
      } else if (mult.length == 3) {
        // 二维数组
        var len1 = field.len1 = parseInt(mult[1], 10);
        var len2 = field.len2 = parseInt(mult[2], 10);
        field.size = size * len1 * len2;
        var getterFunc;
        if (typeof field.type === 'function') {
          getterFunc = typeArray2DGetter;
        } else {
          getterFunc = array2DGetter;
        }
        field.get = getterFunc(field.type, len1, len2, field.offset, field.name);
        offset += field.size;
      }
    }
    arr.push(field);
  }
  arr.size = arr.reduce(function(cur, pre) {
    return cur + pre.size;
  }, 0);
  return arr;
};

// 用于用字符串描述一个“类”（结构体）并快速生成它的构造函数
var defineStruct = global.defineStruct = function(typename, define){
  if (arguments.length === 1) {
    define = typename;
    typename = '';
  }
  var def = resolveStruct(define);
  var ctor = function(buf) {
    var me = this;
    if (buf instanceof ArrayBuffer) {
      buf = new Uint8Array(buf);
    }
    if (!buf) {
      buf = new Uint8Array(ctor.size); // 初始化
    }
    me.view = new BinaryReader(buf);
    me.buffer = buf.buffer;
    me.uint8Array = buf;
  };
  def.forEach(function(field) {
    if (field.get) {
      Object.defineProperty(ctor.prototype, field.name, field);
    }
  });
  ctor.def = def;
  ctor.size = def.size;
  if (typename) {
    ctor.typename = typename;
    ctor.toString = function() {
      return typename;
    };
    ctor.prototype.toString = function() {
      return '[object ' + typename + ']';
    };
  }
  ctor.prototype.copy = function() {
    return new ctor(new Uint8Array(this.uint8Array));
  };
  return ctor;
};

function typeGetter(type, offset, name) {
  var key = '__' + name + '__' ;
  return function() {
    var ret = this[key];
    if (!ret) {
      ret = new type(this.uint8Array.subarray(offset, offset + type.size));
      this[key] = ret;
    }
    return ret;
  };
}

function typeArrayGetter(type, len, offset, name) {
  var key = '__' + name + '__' ;
  return function() {
    var ret = this[key];
    if (!ret) {
      var buf = this.uint8Array.subarray(offset, offset + type.size * len);
      ret = readTypedArray(type, buf, len);
      ret.uint8Array = buf;
      this[key] = ret;
    }
    return ret;
  };
}

function typeArray2DGetter(type, len1, len2, offset, name) {
  var key = '__' + name + '__' ;
  return function() {
    var ret = this[key];
    if (!ret) {
      ret = [];
      ret.uint8Array = this.uint8Array.subarray(offset, offset + type.size * len1 * len2);
      for (var i = 0; i < len1; ++i, offset += type.size * len2) {
        ret.push(readTypedArray(type, this.uint8Array.subarray(offset, offset + type.size * len2)));
      }
      this[key] = ret;
    }
    return ret;
  };
}

var readTypedArray = global.readTypedArray = function(type, buf) {
  var size = type.size;
  var len = buf.byteLength / size;
  var list = [];
  for (var i = 0, offset = 0; i < len; i++, offset += size) {
    list.push(new type(buf.subarray(offset, offset + size)));
  }
  list.uint8Array = buf;
  return list;
};

var initTypedArray = global.initTypedArray = function(type, len) {
  var size = type.size;
  var buf = new Uint8Array(size * len);
  return readTypedArray(type, buf);
}

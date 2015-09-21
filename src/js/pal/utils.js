/**
 * @module utils
 */
var utils = {};

/**
 * 开始计时，是console.time的简单封装，受DEBUG配置影响
 * @method
 * @param  {String} msg
 */
utils.startTiming = function(msg) {
  if (DEBUG.Timing) {
    console.time(msg);
  }
};
/**
 * 结束计时，是console.timeEnd的简单封装，受DEBUG配置影响
 * @method
 * @param  {String} msg
 */
utils.endTiming = function(msg) {
  if (DEBUG.Timing) {
    console.timeEnd(msg);
  }
};

/**
 * extend，和jQuery.extend一样
 * @method
 * @return {Object}
 */
var extend = utils.extend = (function() {
  // from node-extend
  // https://www.npmjs.org/package/extend
  var hasOwn = Object.prototype.hasOwnProperty;
  var toString = Object.prototype.toString;

  function isPlainObject(obj) {
    if (!obj || toString.call(obj) !== '[object Object]' || obj.nodeType || obj.setInterval)
      return false;

    var has_own_constructor = hasOwn.call(obj, 'constructor');
    var has_is_property_of_method = hasOwn.call(obj.constructor.prototype, 'isPrototypeOf');
    // Not own constructor property must be Object
    if (obj.constructor && !has_own_constructor && !has_is_property_of_method) {
      return false;
    }

    // Own properties are enumerated firstly, so to speed up,
    // if last one is own, then all properties are own.
    var key;
    for ( key in obj ) {}

    return key === undefined || hasOwn.call( obj, key );
  }

  var extend = function() {
    var options, name, src, copy, copyIsArray, clone,
        target = arguments[0] || {},
        i = 1,
        length = arguments.length,
        deep = false;

    // Handle a deep copy situation
    if ( typeof target === "boolean" ) {
      deep = target;
      target = arguments[1] || {};
      // skip the boolean and the target
      i = 2;
    }

    // Handle case when target is a string or something (possible in deep copy)
    if ( typeof target !== "object" && typeof target !== "function") {
      target = {};
    }

    for ( ; i < length; i++ ) {
      // Only deal with non-null/undefined values
      if ( (options = arguments[ i ]) !== null ) {
        // Extend the base object
        for ( name in options ) {
          src = target[ name ];
          copy = options[ name ];

          // Prevent never-ending loop
          if ( target === copy ) {
            continue;
          }

          // Recurse if we're merging plain objects or arrays
          if ( deep && copy && ( isPlainObject(copy) || (copyIsArray = Array.isArray(copy)) ) ) {
            if ( copyIsArray ) {
              copyIsArray = false;
              clone = src && Array.isArray(src) ? src : [];

            } else {
              clone = src && isPlainObject(src) ? src : {};
            }

            // Never move original objects, clone them
            target[ name ] = extend( deep, clone, copy );

          // Don't bring in undefined values
          } else if ( copy !== undefined ) {
            target[ name ] = copy;
          }
        }
      }
    }

    // Return the modified object
    return target;
  };

  return extend;
})();

var slice = Array.prototype.slice;

var toArray = function(arr) {
  return slice.call(arr, 0);
};

var arrClone = utils.arrClone = toArray;

var objClone = utils.objClone = function(obj) {
  return extend({}, obj);
};

utils.fillArray = function(arr, ctor) {
  for (var i = 0; i < arr.length; ++i) {
    arr[i] = (typeof ctor === 'function' ? (new ctor()) : ctor);
  }
};

utils.initArray = function(ctor, len) {
  var arr = new Array(len);
  utils.fillArray(arr, ctor);
  return arr;
};

/**
 * 简单的事件机制，可以将其extend到任意对象上使其获得on/off/one/fire功能
 */
utils.Events = {
  on: function(type, callback) {
    var events = type.split(/\s+/);
    if (typeof this._events === 'undefined') this._events = {};
    for (var i = 0; i < events.length; ++i) {
      var event = events[i],
        callbacks = this._events[event] || (this._events[event] = []);
      callbacks.push(callback);
    }
    return this;
  },
  off: function(type, callback) {
    var events = type.split(/\s+/);
    if (typeof this._events === 'undefined') this._events = {};
    for (var i = 0; i < events.length; ++i) {
      var event = events[i],
        callbacks = this._events[event] || (this._events[event] = []);
      for (var j = 0; j < callbacks.length; ++j) {
        if (callbacks[i] === callback) {
          callbacks.splice(i, 1);
          break;
        }
      }
    }
    return this;
  },
  onec: function(type, callback) {
    return this.on(type, function(e) {
      callback.call(this, e);
      this.off(type, arguments.callee);
    });
  },
  fire: function(type, data) {
    var events = type.split(/\s+/);
    if (typeof this._events === 'undefined') this._events = {};
    for (var i = 0; i < events.length; ++i) {
      var event = events[i],
        callbacks = this._events[event] || (this._events[event] = []);
      for (var j = 0; j < callbacks.length; ++j) {
        callbacks[j].call(this, {
          type: event,
          data: data
        });
      }
    }
    return this;
  }
};

/**
 * 返回一个this上下文固定的函数
 * @method
 * @param  {Function} fn
 * @param  {Any}   thisObj
 * @return {Function}
 */
utils.proxy = function(fn, thisObj) {
  return function() {
    return fn.apply(thisObj, [].slice.call(arguments, 0));
  };
};

function proxyThese(arr, thisObj) {
  for (var i=0; i<arr.length; ++i) {
    var fn = arr[i];
    if (typeof fn !== 'undefined') {
      return utils.proxy(fn, thisObj);
    }
  }
  return false;
}

/**
 * requestAnimationFrame的兼容
 * @method
 * @return {int} 句柄
 */
utils.requestAnimationFrame = (
  window.requestAnimationFrame ||
  window.webkitRequestAnimationFrame ||
  window.mozRequestAnimationFrame ||
  window.oRequestAnimationFrame ||
  function (fn){
    return setTimeout(fn, 1000 / 60);
  }
).bind(window);
/**
 * cancelAnimationFrame的兼容
 * @method
 * @param {int} id 句柄
 */
utils.cancelAnimationFrame = (
  window.cancelAnimationFrame ||
  window.webkitCancelAnimationFrame ||
  window.mozCancelAnimationFrame ||
  window.oCancelAnimationFrame ||
  function (id){
    clearTimeout(id);
  }
).bind(window);

utils.raf = function(fn) {
  return new Promise(function(resolve, reject) {
    utils.requestAnimationFrame(function() {
      co(fn).then(resolve, reject);
    });
  });
};

/**
 * 保持帧数的循环
 * @method
 * @param  {Function(elapsed, realElapsed)} callback 每帧回调，参数为距离上一帧游戏时间，距离上一帧真实时间
 * @param  {int}   fps
 * @param  {int}   err 允许误差，默认为每帧时间/20
 * @return {int}   ID
 */
utils.keepFPS = function(callback, fps, err) {
  var lastFrameTime = 0,//utils.hrtime(),
      frameTime = 1000 / fps;
  err = err | (frameTime / 20);
  var id = setInterval(function() {
    var now = hrtime();
    var elapsed = now - lastFrameTime;
    if (elapsed + err >= frameTime) {
      callback(elapsed * GameSpeed, elapsed);
      lastFrameTime = now;
    }
  }, 0);
  return id;
};
/**
 * 取消保持帧数的循环
 * @method
 * @param  {int} id
 */
utils.cancelKeepFPS = function(id) {
  clearInterval(id);
};

export default utils;

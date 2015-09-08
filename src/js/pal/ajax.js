import utils from './utils';
import Global from './pal-global';
import MKF from './mkf';

log.trace('ajax module load');

/**
 * 异步加载文件
 * @module ajax
 */
var ajax = {
  cache: {},
  MKF: {}
};

utils.extend(ajax, utils.Events);

/**
 * loadBinaryFile
 *
 * @method
 * @param  {String} path
 * @return {Promise}
 */
var loadBinaryFile = ajax.loadBinaryFile = function(path) {
  return new Promise(function(resolve, reject) {
    var xhr = new XMLHttpRequest();
    xhr.onload = function(e) {
      var xhr = e.target;
      if (xhr.status >= 200 && xhr.status < 300 || xhr.status == 304) {
        var data = xhr.response,
            buf = data; //new Uint8Array(data);
        resolve(buf);
      } else {
        reject(xhr.status);
      }
    };
    xhr.onerror = function(e) {
      reject(e);
    };
    xhr.onprogress = function(e) {
      if (e.lengthComputable) {
        var percent = e.loaded / e.total * 100;
        //console.log(name, e.loaded, e.total, percent.toFixed(2));
        ajax.fire('progress', {
          path: path,
          percent: percent,
          loaded: e.loaded,
          total: e.total
        });
      }
    };

    xhr.open('GET', '/pal-assets/' + path, true);
    xhr.responseType = 'arraybuffer';
    xhr.overrideMimeType('text/plain; charset=x-user-defined');
    xhr.send(null);
  });
};

/**
 * loadBig5File
 *
 * @method
 * @param  {String} path
 * @return {Promise}
 */
var loadBig5File = ajax.loadBig5File = function(path) {
  return new Promise(function(resolve, reject) {
    var xhr = new XMLHttpRequest();
    xhr.onload = function(e) {
      var xhr = e.target;
      if (xhr.status >= 200 && xhr.status < 300 || xhr.status == 304) {
        resolve(e.target.response);
      } else {
        reject(xhr.status);
      }
    };
    xhr.onerror = function(e) {
      reject(e);
    };
    xhr.onprogress = function(e) {
      if (e.lengthComputable) {
        var percent = e.loaded / e.total * 100;
        //console.log(name, e.loaded, e.total, percent.toFixed(2));
        ajax.fire('progress', {
          path: path,
          percent: percent,
          loaded: e.loaded,
          total: e.total
        });
      }
    };

    xhr.open('GET', '/pal-assets/' + path, true);
    //xhr.responseType = 'arraybuffer';
    xhr.overrideMimeType('text/plain; charset=big5');
    xhr.send(null);
  });
};

/**
 * 加载多个文件
 *
 * @method
 * @param  {Array}    fileList
 * @return {Promise}  全部完成时resolve
 */
var load = ajax.load = function(fileList) {
  if (!Array.isArray(fileList)) fileList = toArray(arguments);
  return co(function*() {
    var deferList = [];
    for (var i=0; i<fileList.length; ++i) {
      var file = fileList[i];
      if (file in ajax.cache) {
        deferList.push(ajax.cache[file]);
      } else {
        deferList.push(ajax.cache[file] = loadBinaryFile(file));
      }
    }
    return yield deferList;
  });
};

/**
 * 加载多个MKF
 *
 * @method
 * @param  {Array} mkfList fileList
 * @return {Promise}       全部完成时resolve
 */
var loadMKF = ajax.loadMKF = function(mkfList) {
  if (!Array.isArray(mkfList)) mkfList = toArray(arguments);
  return co(function*() {
    var fileList = [];
    for (var i=0; i<mkfList.length; ++i) {
      fileList.push(mkfList[i] + '.MKF');
    }
    return ajax.load(fileList).then(function(bufs) {
      for (var i=0; i<mkfList.length; ++i) {
        var name = mkfList[i];
        //ajax[name] = bufs[i];
        ajax.MKF[name] = new MKF(bufs[i]);
      }
      return bufs;
    });
  });
};

export default ajax;

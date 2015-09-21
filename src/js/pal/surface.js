import utils from './utils';
import ajax from './ajax';
import Palette from './palette';

log.trace('surface module load');

var defaultPalette = [];
for (var i=0; i<256; ++i) {
  var p = {};
  p.r = p.g = p.b = i;
  defaultPalette.push(p);
}

/**
 * 一个用于渲染的画布单位，被称为Surface
 * @constructor
 * @param  {Canvas} cvs
 */
var Surface = function(cvs, width, height, debugcvs) {
  this.cvs = cvs;
  this.ctx = cvs.getContext('2d');
  this.width = this.pitch = cvs.width = width || 320;
  this.height = cvs.height = height || 200;
  if (debugcvs) {
    this.debugcvs = debugcvs;
    debugcvs.width = 640;
    debugcvs.height = 400;
    this.debugctx = debugcvs.getContext('2d');
  }

  this.len = this.width * this.height;
  this.palette = defaultPalette;
  this.renderObjects = [];

  this.lastRefresh = hrtime();

  this.alpha = 1.0;
  this.byteBuffer = new Uint8Array(this.len);
  this.backup = new Uint8Array(this.len);
  this.backup.width = this.width;
  this.backup.height = this.height;

  this.clear();
};

Surface.shakeTime = 0;
Surface.shakeLevel = 0;

utils.extend(Surface.prototype, {
  init: function*() {
    log.debug('[VIDEO] init surface');
  },
  restoreScreen: function() {
    log.trace('[VIDEO] restoreScreen');
    //if (!this.backup) return;
    this.putRect(this.backup, 0, 0);
  },
  backupScreen: function() {
    log.trace('[VIDEO] backupScreen');
    //this.backup = this.getRect(0, 0, this.width, this.height);
    for (var i = 0; i < this.len; ++i) {
      this.backup[i] = this.byteBuffer[i];
    }
  },
  updateScreen: function(rect) {
    rect = rect || new RECT(0, 0, this.width, this.height);
    //this.__debugClear(rect.x, rect.y, rect.w, rect.h);
    log.trace('[VIDEO] updateScreen(%d, %d, %d, %d)', rect.x, rect.y, rect.w, rect.h);

    var ctx = this.ctx,
        imgdata = ctx.getImageData(rect.x, rect.y, rect.w, rect.h),
        pixels = imgdata.data,
        palette = this.palette,
        byteBuffer = this.byteBuffer,
        width = this.width,
        height = this.height;

    for (var i=0; i<rect.h; ++i) {
      var y = i + rect.y;
      for (var j=0; j<rect.w; ++j) {
        var x = j + rect.x;
        var offset = (i * rect.w + j) * 4;
        var bufferOffset = y * width + x;
        if (bufferOffset >= this.len) continue;
        var pixel = byteBuffer[bufferOffset],
            color = palette[pixel];
        pixels[offset]     = color.r;
        pixels[offset + 1] = color.g;
        pixels[offset + 2] = color.b;
        pixels[offset + 3] = 255;
      }
    }
    ctx.putImageData(imgdata, rect.x, rect.y);
  },
  /**
   * 获取一个矩形区域的byte buffer
   * @memberOf   Surface#
   * @param  {int} x
   * @param  {int} y
   * @param  {int} w
   * @param  {int} h
   * @return {Uint8Array}
   */
  getRect: function(x, y, w, h){
    var dst = new Uint8Array(w * h),
        buf = this.byteBuffer;
    dst.width = w;
    dst.height = h;
    var dstpos = 0;
    for (var i=0; i<h; ++i) {
      for (var j=0; j<w; ++j) {
        var sy = i + y,
            sx = j + x,
            srcpos = sy * this.width + sx;
        dst[dstpos++] = buf[srcpos];
      }
    }
    return dst;
  },
  /**
   * 设置一个矩形区域的byte buffer，并刷新surface
   * @memberOf   Surface#
   * @param  {Uint8Array} src
   * @param  {int} x
   * @param  {int} y
   */
  putRect: function(src, x, y) {
    var w = src.width,
        h = src.height,
        dst = this.byteBuffer,
        srcpos = 0;
    for (var i=0; i<h; ++i) {
      for (var j=0; j<w; ++j) {
        var dy = i + y,
            dx = j + x,
            dstpos = dy * this.width + dx;
        dst[dstpos] = src[srcpos++];
      }
    }
    this.updateScreen(RECT(x, y, w, h));
  },
  tick: function(){
    var now = hrtime(),
        elapsed = now - this.lastRefresh,
        fps = 1000 / elapsed;
    this.lastRefresh = now;
  },
  /**
   * 清空一个矩形区域，重置为RGB(0, 0, 0)
   * @memberOf   Surface#
   * @param  {int} x
   * @param  {int} y
   * @param  {int} w
   * @param  {int} h
   * @param  {String} color
   */
  clearRect: function(x, y, w, h, color) {
    this.ctx.fillStyle = color || '#000';
    this.ctx.fillRect(x, y, w, h);
    this.__debugClear(x, y, w, h);
  },
  /**
   * 清空整个画布，重置为RGB(0, 0, 0)
   * @memberOf   Surface#
   * @param  {String} color
   */
  clear: function(color) {
    for (var i=0,len=this.byteBuffer.length; i<len; ++i) {
      this.byteBuffer[i] = 0;
    }
    return this.clearRect(0, 0, this.width, this.height, color);
  },
  __debugClear: function(x, y, w, h) {
    if (!this.debugctx) return;
    $('#debugLayer').empty();
    var ctx = this.debugctx;
    ctx.clearRect(x * 2, y * 2, w * 2, h * 2);
  },
  /**
   * 在指定位置上打一个字符串以显示其坐标
   * @memberOf   Surface#
   * @private
   * @param  {int} x
   * @param  {int} y
   */
  __debugPos: function(x, y) {
    if (!DEBUG.ShowSpritePos) return;
    if (!this.debugctx) return;
    this.__debugStr([x, y].join(','), x, y, '#0f0', 'top', 'left');
  },
  /**
   * 在指定位置上打一个字符串
   * @memberOf   Surface#
   * @private
   * @param  {String} str
   * @param  {int} x
   * @param  {int} y
   */
  __debugStr: function(str, x, y, color, baseline, align, size) {
    if (!this.debugctx) return;
    //$('<div class="debugObj" />').html(str).css({
    //  left: x * 2,
    //  top: y * 2
    //}).appendTo($('#debugLayer'));
    var ctx = this.debugctx;
    ctx.fillStyle = color || '#0f0';
    ctx.textBaseline = baseline || 'middle';
    ctx.textAlign = align || 'center';
    ctx.font = (size || 12) + 'px monospace';
    ctx.fillText(str, x * 2, y * 2);
  },
  /**
   * 打一个指定的红色矩形框
   * @memberOf   Surface#
   * @private
   * @param  {int} x
   * @param  {int} y
   * @param  {int} w
   * @param  {int} h
   */
  __debugRect: function(x, y, w, h, color) {
    if (w === 0 || h === 0) return;
    if (!DEBUG.ShowSpriteRect) return;
    if (!this.debugctx) return;
    var ctx = this.debugctx;
    ctx.lineWidth = 1;
    ctx.strokeStyle = color || '#00f';
    ctx.strokeRect(x * 2, y * 2, w * 2, h * 2);
  },
  __debugRLE: function(RLE, pos) {
    var i, j,
        x, y,
        width = 0,
        height = 0,
        T,
        dx = PAL_X(pos),
        dy = PAL_Y(pos);
    // Check for NULL pointer.
    if (!RLE) return false;

    width = RLE.width || 0;
    height = RLE.height || 0;

    this.__debugPos(dx, dy);
    this.__debugRect(dx, dy, width, height, '#00f');
    if (DEBUG.ShowSpriteSize){
      this.__debugStr([width, height].join('*'), dx + width, dy + height, '#0f0', 'bottom', 'right');
    }
  },
  /**
   * 设置当前surface的调色板
   * @memberOf   Surface#
   * @param {Palette} palette
   */
  setPalette: function(palette, norefresh) {
    this.palette = palette;
    if (!norefresh) {
      this.updateScreen(null);
    }
  },
  /**
   * 获取当前surface的调色板
   * @memberOf   Surface#
   * @return {Palette}
   */
  getPalette: function() {
    return this.palette;
  },
  /**
   * 设置一个像素的byte值，其颜色会从当前调色板中获取
   * @memberOf   Surface#
   * @param {int} x
   * @param {int} y
   * @param {byte} pixel
   */
  setPixel: function(x, y, pixel, buf) {
    var byteBuffer = buf || this.byteBuffer,
        palette = this.palette,
        width = this.width,
        height = this.height,
        color = palette[pixel];

    byteBuffer[y * width + x] = pixel;
  },
  /**
   * blit一个FBP位图到当前画布
   * @memberOf   Surface#
   * @param  {FBP} FBP
   * @param  {RECT} src
   * @param  {RECT} dst
   */
  blitFBP: function(FBP, src, dst, buf) {
    if (src.w <= 0 || src.h <= 0 || dst.w <= 0 || dst.h <= 0) return;

    this.__debugClear(dst.x, dst.y, dst.w, dst.h);
    var byteBuffer = buf || this.byteBuffer,
        palette = this.palette;

    for (var i=0; i<src.h; ++i) {
      var y = i + dst.y;
      for (var j=0; j<src.w; ++j) {
        var x = j + dst.x;
        var pixel = FBP[(i + src.y) * src.w + j + src.x];
        byteBuffer[y * dst.w + x] = pixel;
      }
    }
    //this.__debugPos(dst.x, dst.y);
    //this.__debugRect(dst.x, dst.y, src.w, src.h);
  },
  /**
   * blit一个RLE到当前画布
   * @memberOf   Surface#
   * @param  {RLE} RLE
   * @param  {POS} pos
   */
  blitRLE: function(RLE, pos, buf, nodebug) {
    this.blitRLEWithColorShift(RLE, pos, 0, buf, nodebug);
  },
  blitRLEWithColorShift: function(RLE, pos, colorShift, buf, nodebug) {
    this.blitRLEWithMonoColorAndColorShift(RLE, pos, false, colorShift, buf, nodebug);
  },
  blitRLEMonoColor: function(RLE, pos, color, colorShift, buf, nodebug) {
    this.blitRLEWithMonoColorAndColorShift(RLE, pos, color, colorShift, buf, nodebug);
  },
  blitRLEWithMonoColorAndColorShift: function(RLE, pos, color, colorShift, buf, nodebug) {
    var i, j,
        x, y,
        len = 0,
        width = 0,
        height = 0,
        T,
        dx = PAL_X(pos),
        dy = PAL_Y(pos);
    var byteBuffer = buf || this.byteBuffer;
    // Check for NULL pointer.
    if (!RLE) return false;
    var _RLE = RLE;

    // Skip the 0x00000002 in the file header.
    if (RLE[0] === 0x02 && RLE[1] === 0x00 &&
        RLE[2] === 0x00 && RLE[3] === 0x00) {
      RLE = RLE.subarray(4);
    }

    // Get the width and height of the bitmap.
    width = RLE[0] | (RLE[1] << 8);
    height = RLE[2] | (RLE[3] << 8);
    //console.log('_blitRLE', dx, dy, width, height);

    // Calculate the total length of the bitmap.
    // The bitmap is 8-bpp, each pixel will use 1 byte.
    len = width * height;

    // Start decoding and blitting the bitmap.
    var palette = this.palette;
    RLE = RLE.subarray(4);
    var over = false, idx = 0;
    for (i = 0; i < len;) {
      if (over) break;
      T = RLE[idx++];
      if ((T & 0x80) && T <= 0x80 + width) {
        i += T - 0x80;
      } else {
        for (j = 0; j < T; j++) {
          // Calculate the destination coordination.
          // FIXME: This could be optimized
          y = ~~((i + j) / width) + dy;
          x = (i + j) % width + dx;

          // Skip the points which are out of the surface.
          if (x < 0) {
            j += -x - 1;
            continue;
          } else if (x >= this.width) {
            j += x - this.width;
            continue;
          }

          if (y < 0) {
            j += -y * width - 1;
            continue;
          } else if (y >= this.height) {
            over = true;
            break; // No more pixels needed, break out
          }

          var pixel = RLE[idx + j];
          var high = pixel & 0xF0;
          var low = pixel & 0x0F;
          if (colorShift !== 0) {
            low += colorShift;
            if (low > 0x0F) {
              low = 0x0F;
            }
            if (low < 0) {
              low = 0;
            }
            pixel = (high | low);
          }
          if (color !== false) {
            pixel = ((color & 0xF0) | low);
          }

          // Put the pixel onto the surface (FIXME: inefficient).
          //var offset = (y * this.width + x) * 4;
          byteBuffer[y * this.width + x] = pixel;
        }
        //RLE = RLE.subarray(T);
        idx += T;
        i += T;
      }
    }
    //this.ctx.putImageData(imgdata, 0, 0);

    if (!nodebug) {
      this.__debugRLE(_RLE, pos);
    }
  },
  /**
   * blit一个Map到当前画布
   * @memberOf   Surface#
   * @param  {Map} map
   * @param  {RECT} rect
   * @param  {int} layer
   */
  blitMap: function(map, rect, layer, buf) {
    this.__debugClear(rect.x, rect.y, rect.w, rect.h);
    //console.time('blitMap');
    // Convert the coordinate
    var sy = ~~(rect.y / 16) - 1;
    var dy = ~~((rect.y + rect.h) / 16) + 2;
    var sx = ~~(rect.x / 32) - 1;
    var dx = ~~((rect.x + rect.w) / 32) + 2;

    // Do the drawing.
    var yPos = sy * 16 - 8 - rect.y;
    for (var y = sy; y < dy; y++) {
      for (var h = 0; h < 2; h++, yPos += 8) {
         var xPos = sx * 32 + h * 16 - 16 - rect.x;
         for (var x = sx; x < dx; x++, xPos += 32) {
            //this.__debugStr([x,y,h].join(','),xPos, yPos);
            var bitmap = map.getTileBitmap(x, y, h, layer);
            //console.log(x, y, h, layer, (bitmap ? (bitmap.length + ':' + bitmap.width + ',' + bitmap.height) : 'false'), xPos, yPos);
            if (!bitmap) {
               if (layer) continue;
               bitmap = map.getTileBitmap(0, 0, 0, layer);
            }
            this.blitRLE(bitmap, PAL_XY(xPos, yPos), buf, true);
            if (map.isTileBlocked(x, y, h)) {
              //this.__debugRect(xPos, yPos, bitmap.width, bitmap.height, '#ccc');
              //this.__debugStr([x, y, h].join(','), xPos, yPos, '#0f0', 'top', 'left');
            }
         }
      }
    }
    //console.timeEnd('blitMap');
  },
  /**
   * blit一个全屏的FBP
   * @memberOf   Surface#
   * @param  {FBP} FBP
   */
  blit: function(FBP, buf) {
    var rect = new RECT(0, 0, this.width, this.height);
    return this.blitFBP(FBP, rect, rect, buf);
  },
  /**
   * blit一个buffer到另一个buffer
   * @param  {Uint8Array} src     源Buffer
   * @param  {RECT} srcrect 源区域
   * @param  {Uint8Array} dst     目标Buffer
   * @param  {RECT} dstrect 目标区域
   */
  blitSurface: function(src, srcrect, dst, dstrect) {
    srcrect = srcrect || new RECT(0, 0, this.width, this.height);
    dstrect = dstrect || new RECT(0, 0, this.width, this.height);
    for (var i=0; i<srcrect.h; ++i) {
      var y = i + dstrect.y;
      for (var j=0; j<srcrect.w; ++j) {
        var x = j + dstrect.x;
        var pixel = src[(i + srcrect.y) * srcrect.w + j + srcrect.x];

        dst[y * dstrect.w + x] = pixel;
      }
    }
  },
  // idx: 调色板索引
  fadeIn: function*(idx, night, time) {
    log.debug(['[VIDEO] fadeIn', idx, night, time].join(' '));
    var me = this,
        palette = Palette.get(idx, night),
        newPalette = [];
    for (var i=0; i<256; ++i) {
      newPalette[i] = {
        r: 0,
        g: 0,
        b: 0
      };
    }
    time *= 300; // 600
    var me = this;
    // Start fading in...
    var startTime = timestamp();
    while (true) {
      // Set the current palette...
      var now = timestamp();
      var elapsed = now - startTime;
      var rate = 1 - (time - elapsed) / time;
      if (rate > 1) break;
      for (var i=0; i<256; ++i) {
        var p = palette[i],
            np = newPalette[i];
        np.r = p.r * rate;
        np.g = p.g * rate;
        np.b = p.b * rate;
      }

      me.setPalette(newPalette);

      yield sleep(FrameTime);
    }

    me.setPalette(palette, true);
  },
  fadeOut: function*(time) {
    log.debug(['[VIDEO] fadeOut', time].join(' '));
    time *= 300; // 600
    var palette = this.getPalette();
    var newPalette = [];
    // Get the original palette...
    for (var i=0; i<256; ++i) {
      var p = palette[i];
      newPalette[i] = {
        r: p.r,
        g: p.g,
        b: p.b
      };
    }
    var me = this;
    var startTime = timestamp();
    while (true) {
      var now = timestamp(),
          elapsed = now - startTime;
          rate = (time - elapsed) / time;
      if (rate < 0) break;
      for (var i=0; i<256; ++i){
        var p = palette[i],
            np = newPalette[i];
        np.r = p.r * rate;
        np.g = p.g * rate;
        np.b = p.b * rate;
      }

      me.setPalette(newPalette);

      yield sleep(FrameTime);
    }

    me.setPalette(palette, true);
  },

  fadeToRed: function*() {
    log.debug(['[VIDEO] fadeToRed'].join(' '));
    var palette = this.getPalette();
    var newPalette = [];
    // Get the original palette...
    for (var i=0; i<256; ++i) {
      var p = palette[i];
      newPalette[i] = {
        r: p.r,
        g: p.g,
        b: p.b
      };
    }

    for (var i = 0; i < this.len; ++i) {
      if (this.byteBuffer[i] == 0x4F) {
        this.byteBuffer[i] = 0x4E; // HACKHACK
      }
    }
    var me = this;
    var startTime = timestamp();
    for (var i = 0; i < 32; ++i) {
      for (var j = 0; j < 256; ++j){
        if (j == 0x4F) {
          continue; // so that texts will not be affected
        }
        var p = palette[j],
            np = newPalette[j];
        var color = ~~((p.r + p.g + p.b) / 4) + 64;

        if (np.r > color) {
          np.r -= (np.r - color > 8 ? 8 : np.r - color);
        } else if (np.r < color) {
          np.r += (color - np.r > 8 ? 8 : color - np.r);
        }

        if (np.g > 0) {
          np.g -= (np.g > 8 ? 8 : np.g);
        }

        if (np.b > 0) {
          np.b -= (np.b > 8 ? 8 : np.b);
        }
      }

      me.setPalette(newPalette);
      yield sleepByFrame(1);
    }
  },
  paletteFade: function*(idx, night, update) {
    log.debug(['[VIDEO] paletteFade', idx, night, update].join(' '));
    var me = this;

    var newPalette = Palette.get(idx, night);
    if (!newPalette) {
      return;
    }

    var palette = [];
    var t = [];
    var finalPalette;
    var i, j;
    for (i = 0; i < 256; ++i) {
      var p = this.palette[i];
      palette[i] = {
        r: p.r,
        g: p.g,
        b: p.b
      };
    }

    // Start fading...
    for (i = 0; i < 32; i++) {
      for (j = 0; j < 256; j++) {
        t[j] = {
          r: palette[j].r * (31 - i) + ~~((newPalette[j].r * i) / 31),
          g: palette[j].g * (31 - i) + ~~((newPalette[j].g * i) / 31),
          b: palette[j].b * (31 - i) + ~~((newPalette[j].b * i) / 31)
        }
      }
      me.setPalette(t);

      if (update) {
        // input.clear(); // TODO
        // input.dir = Dir.Unknown; // TODO
        // input.prevDir = Dir.Unknown; // TODO
        // yield play.update(false); // TODO
        // yield scene.makeScene(); // TODO
        me.updateScreen();
      }

      yield sleep(update ? FrameTime : FrameTime / 4)
   }
  },
  colorFade: function*(delay, color, from) {
    log.debug(['[VIDEO] colorFade', delay, color, from].join(' '));
    var me = this;
    var palette = Palette.get(Global.numPalette, Global.nightPalette);
    var newPalette = [];
    var i;
    delay *= 5; // 10;
    if (delay == 0) {
      delay = 5; // 10;
    }

    var finalPalette;
    if (from) {
      for (i = 0; i < 256; ++i) {
        var p = palette[color];
        newPalette[i] = {
          r: p.r,
          g: p.g,
          b: p.b
        };
      }
      finalPalette = palette;
    } else {
      finalPalette = new Array(256);
      for (i = 0; i < 256; ++i) {
        var p = palette[i];
        newPalette[i] = {
          r: p.r,
          g: p.g,
          b: p.b
        };

        finalPalette[i] = {
          r: palette[color].r,
          g: palette[color].g,
          b: palette[color].b
        }
      }
    }

    for (i = 0; i < 64; i++) {
      for (j = 0; j < 256; j++) {
        var to = (from ? j : color);

        if (newPalette[j].r > palette[to].r) {
          newPalette[j].r -= 4;
        } else if (newPalette[j].r < palette[to].r) {
          newPalette[j].r += 4;
        }
        if (newPalette[j].g > palette[to].g) {
          newPalette[j].g -= 4;
        } else if (newPalette[j].g < palette[to].g) {
          newPalette[j].g += 4;
        }
        if (newPalette[j].b > palette[to].b) {
          newPalette[j].b -= 4;
        } else if (newPalette[j].b < palette[to].b) {
          newPalette[j].b += 4;
        }
      }

      me.setPalette(newPalette);
      yield sleep(delay);
    }



    me.setPalette(finalPalette);
  },
  shakeScreen: function*(shakeTime, shakeLevel){
    log.debug(['[VIDEO] shakeScreen', shakeTime, shakeLevel].join(' '));
    Surface.shakeTime = shakeTime;
    Surface.shakeLevel = shakeLevel;
  },
  switchScreen: function*(speed) {
    log.debug(['[VIDEO] switchScreen', speed].join(' '));

    var indices = [0, 3, 1, 5, 2, 4];

    speed++;
    speed *= 5; // 10;

    var backup = this.backup;
    var buffer = this.getRect(0, 0, 320, 200);
    var screen = this.byteBuffer;

    for (var i = 0; i < 6; i++) {
      for (var j = indices[i]; j < this.pitch * this.height; j += 6) {
        backup[j] = buffer[j];
      }

      // Draw the backup buffer to the screen
      this.blitSurface(backup, null, screen, null);
      this.updateScreen(null);

      yield sleep(speed);
    }
  },

  /**
   * Fade from the backup screen buffer to the current screen buffer.
     NOTE: This will destroy the backup buffer.
   * @param {Number} speed         speed of fading (the larger value, the slower).
   */
  fadeScreen: function*(speed) {
    log.debug(['[VIDEO] fadeScreen', speed].join(' '));
    var indices = [0, 3, 1, 5, 2, 4];

    //var offset = 240 - 200;
    //var screenRealHeight = this.height;
    //var screenRealY = 0;
    //if (!bScaleScreen)
    //{
    //  screenRealHeight -= offset;
    //  screenRealY = offset / 2;
    //}

    speed++;
    speed *= 4; // 10;

    var screen = this.byteBuffer;
    var p = this.getRect(0, 0, 320, 200);
    var backup = this.backup;

    for (var i = 0; i < 12; i++) {
      for (var j = 0; j < 6; j++) {
        // Blend the pixels in the 2 buffers, and put the result into the
        // backup buffer
        for (var k = indices[j]; k < this.pitch * this.height; k += 6) {
          var a = p[k];
          var b = backup[k];

          if (i > 0) {
            if ((a & 0x0F) > (b & 0x0F)) {
              b++;
            } else if ((a & 0x0F) < (b & 0x0F)) {
              b--;
            }
          }

          backup[k] = ((a & 0xF0) | (b & 0x0F));
        }

        // Draw the backup buffer to the screen
        if (Surface.shakeTime != 0) {
          var srcrect = new RECT(0, 0, 320, 200);
          var dstrect = new RECT(0, 0, 320, 200);

          // Shake the screen
          srcrect.x = 0;
          srcrect.y = 0;
          srcrect.w = 320;
          srcrect.h = 200 - Surface.shakeLevel;

          dstrect.x = 0;
          dstrect.y = 0; // screenRealY;
          dstrect.w = 320; //320 * ~~(this.width / this.width);
          dstrect.h = 200 - Surface.shakeLevel; // (200 - Surface.shakeLevel) * screenRealHeight / gpScreen->h;

          if (Surface.shakeTime & 1) {
            srcrect.y = Surface.shakeLevel;
          } else {
            dstrect.y = Surface.shakeLevel; //(screenRealY + Surface.shakeLevel) * screenRealHeight / gpScreen->h;
          }

          this.blitSurface(backup, srcrect, screen, dstrect);
          //SDL_SoftStretch(gpScreenBak, &srcrect, gpScreenReal, &dstrect);

          if (Surface.shakeTime & 1) {
             dstrect.y = 200 - Surface.shakeLevel; // (screenRealY + screenRealHeight - Surface.shakeLevel) * screenRealHeight / gpScreen->h;
          } else {
             dstrect.y = 0;// screenRealY;
          }

          dstrect.h = Surface.shakeLevel; // Surface.shakeLevel * screenRealHeight / gpScreen->h;

          this.fillRect(screen, dstrect, 0);
          this.updateScreen(null);
          //SDL_FillRect(gpScreenReal, &dstrect, 0);
          //SDL_UpdateRect(gpScreenReal, 0, 0, gpScreenReal->w, gpScreenReal->h);
          Surface.shakeTime--;
        } else {
          //dstrect.x = 0;
          //dstrect.y = 0; //screenRealY;
          //dstrect.w = 320; //gpScreenReal->w;
          //dstrect.h = 200; //screenRealHeight;

          this.blitSurface(backup, null, screen, null);
          this.updateScreen(null);
          //SDL_SoftStretch(gpScreenBak, NULL, gpScreenReal, &dstrect);
          //SDL_UpdateRect(gpScreenReal, 0, 0, gpScreenReal->w, gpScreenReal->h);
        }
        yield sleep(speed);
      }
    }

    // Draw the result buffer to the screen as the final step
    this.updateScreen(null);
  },

  fillRect: function(buffer, rect, color) {
    var w = rect.width,
        h = rect.height;
    for (var i=0; i<h; ++i) {
      for (var j=0; j<w; ++j) {
        var y = i + rect.y,
            x = j + rect.x,
            pos = y * this.width + x;
        buffer[pos] = color;
      }
    }
  }
});

export default Surface;

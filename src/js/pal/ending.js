import ajax from './ajax';
import Sprite from './sprite';
import scene from './scene';

log.trace('script module load');

var surface;
var screen;

var ending = {
};

var curEffectSprite = 0;
var spriteCache = {};

ending.init = function*(surf) {
  log.debug('[ENDING] init');
  global.ending = ending;
  surface = surf;
  screen = surface.byteBuffer;
  yield ajax.loadMKF('FBP', 'MGO');
  Files.FBP = ajax.MKF.FBP;
  Files.MGO = ajax.MKF.MGO;
};

/**
 * Set the effect sprite of the ending.
 * @param  {Number} spriteNum the number of the sprite.
 */
ending.setEffectSprite = function(spriteNum) {
  log.debug(['ending.setEffectSprite', spriteNum].join(' '));
  curEffectSprite = spriteNum;
};

/**
 * Draw an FBP picture to the screen.
 * @param  {Number} chunkNum number of chunk in fbp.mkf file.
 * @param  {Number} fade     fading speed of showing the picture.
 */
ending.showFBP = function*(chunkNum, fade) {
  log.debug(['ending.showFBP', chunkNum, fade].join(' '));
  var indices = [0, 3, 1, 5, 2, 4];

  var bitmap = Files.FBP.decompressChunk(chunkNum);
  if (!bitmap) {
    bitmap = new Uint8Array(320 * 200);
  }

  if (fade) {
    fade++;
    fade *= 5; // 10;

    var p = surface.getRect(0, 0, 320, 200);
    surface.blit(bitmap, p);
    surface.backupScreen();

    for (var i = 0; i < 16; i++) {
      for (var j = 0; j < 6; j++) {
        // Blend the pixels in the 2 buffers, and put the result into the
        // backup buffer
        for (var k = indices[j]; k < surface.pitch * surface.height; k += 6) {
          var a = p[k];
          var b = surface.backup[k];

          if (i > 0) {
            if ((a & 0x0F) > (b & 0x0F)) {
              b++;
            } else if ((a & 0x0F) < (b & 0x0F)) {
              b--;
            }
          }

          surface.backup[k] = ((a & 0xF0) | (b & 0x0F));
        }

        surface.blitSurface(surface.backup, null, screen, null);

        if (curEffectSprite != 0) {
          var sprite = getSprite(curEffectSprite);
          var f = ~~(hrtime() / 150);
          if (sprite) {
            var frame = sprite.getFrame(f % sprite.frameCount);
            surface.blitRLE(frame, PAL_XY(0, 0));
          }
        }

        surface.updateScreen(null);
        yield sleep(fade);
      }
    }

    // SDL_FreeSurface(p);
  }

  // HACKHACK: to make the ending show correctly
  if (chunkNum !== 0x0031) {
    // 49号位图，全剧终
    surface.blit(bitmap);
  }

  surface.updateScreen(null);
};

/**
 * Scroll up an FBP picture to the screen.
 * @param {Number} chunkNum      number of chunk in fbp.mkf file.
 * @param {Number} scrollSpeed   scrolling speed of showing the picture.
 * @param {Boolean} scrollDown   true if scroll down, false if scroll up.
 */
ending.scrollFBP = function*(chunkNum, scrollSpeed, scrollDown) {
  log.debug(['ending.scrollFBP', chunkNum, scrollSpeed, scrollDown].join(' '));
  var bitmap = Files.FBP.decompressChunk(chunkNum);
  if (!bitmap) {
    bitmap = new Uint8Array(320 * 200);
  }

  var p = surface.getRect(0, 0, 320, 200);
  surface.backupScreen();
  surface.blit(bitmap, p);

  if (scrollSpeed == 0) {
    scrollSpeed = 1;
  }

  var rect = new RECT(0, 0, 320, 200);
  var dstrect = new RECT(0, 0, 320, 200);

  rect.x = 0;
  rect.w = 320;
  dstrect.x = 0;
  dstrect.w = 320;

  for (var l = 0; l < 220; l++) {
    var i = l;
    if (i > 200) {
      i = 200;
    }

    if (scrollDown) {
      rect.y = 0;
      dstrect.y = i;
      rect.h = 200 - i;
      dstrect.h = 200 - i;
    } else {
       rect.y = i;
       dstrect.y = 0;
       rect.h = 200 - i;
       dstrect.h = 200 - i;
    }

    surface.blitSurface(surface.backup, rect, screen, dstrect);

    if (scrollDown) {
       rect.y = 200 - i;
       dstrect.y = 0;
       rect.h = i;
       dstrect.h = i;
    } else {
       rect.y = 0;
       dstrect.y = 200 - i;
       rect.h = i;
       dstrect.h = i;
    }

    surface.blitSurface(p, rect, screen, dstrect);

    scene.applyWave(screen);

    if (curEffectSprite != 0) {
      var sprite = getSprite(curEffectSprite);
      var f = ~~(hrtime() / 150);
      if (sprite) {
        var frame = sprite.getFrame(f % sprite.frameCount);
        surface.blitRLE(frame, PAL_XY(0, 0));
      }
    }

    surface.updateScreen(null);

    if (Global.needToFadeIn) {
      yield surface.fadeIn(Global.numPalette, Global.nightPalette, 1);
      Global.needToFadeIn = false;
    }

    yield sleep(400 / scrollSpeed); // sleep(800 / scrollSpeed);
  }

  surface.putRect(p);
};

/**
 * Show the ending animation.
 */
ending.endingAnimation = function*() {
  log.debug(['ending.endingAnimation'].join(' '));
  var girlPos = 180;

  var upper = surface.getRect(0, 0, 320, 200);
  var lower = surface.getRect(0, 0, 320, 200);

  surface.blit(Files.FBP.decompressChunk(0x3d), upper); // 图片61
  surface.blit(Files.FBP.decompressChunk(0x3e), lower); // 图片62

  var sprite = getSprite(571);
  var girl = getSprite(572);

  var srcrect = new RECT(0, 0, 320, 200);
  var dstrect = new RECT(0, 0, 320, 200);
  srcrect.x = 0;
  dstrect.x = 0;
  srcrect.w = 320;
  dstrect.w = 320;

  Global.screenWave = 2;

  for (var i = 0; i < 400; i++) {
    // Draw the background
    srcrect.y = 0;
    srcrect.h = 200 - ~~(i / 2);

    dstrect.y = ~~(i / 2);
    dstrect.h = 200 - ~~(i / 2);

    surface.blitSurface(lower, srcrect, screen, dstrect);

    srcrect.y = 200 - ~~(i / 2);
    srcrect.h = ~~(i / 2);

    dstrect.y = 0;
    dstrect.h = ~~(i / 2);

    surface.blitSurface(upper, srcrect, screen, dstrect);

    scene.applyWave(screen);

    // Draw the beast
    surface.blitRLE(sprite.getFrame(0), PAL_XY(0, -400 + i));
    surface.blitRLE(sprite.getFrame(1), PAL_XY(0, -200 + i));

    // Draw the girl
    girlPos -= i & 1;
    if (girlPos < 80) {
       girlPos = 80;
    }

    var f = ~~(hrtime() / 50) % 4;
    surface.blitRLE(girl.getFrame(f), PAL_XY(220, girlPos));

    // Update the screen
    surface.updateScreen(null);

    if (Global.needToFadeIn) {
      yield surface.fadeIn(Global.numPalette, Global.nightPalette, 1);
      Global.needToFadeIn = false;
    }

    yield sleep(25); // sleep(50);
  }

  Global.screenWave = 0;
};

function getSprite(n) {
  if (n === 0) return null;
  if (n in spriteCache) {
    return spriteCache[n];
  }
  var sprite = new Sprite(Files.MGO.decompressChunk(n));
  spriteCache[n] = sprite;
  return sprite;
}

export default ending;

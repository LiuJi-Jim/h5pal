import utils from './utils';
import ajax from './ajax';
import MKF from './mkf';
import Sprite from './sprite';
import Palette from './palette';
import input from './input';
import rng from './rng';

log.trace('welcome module load');

var BITMAPNUM_SPLASH_UP    = 0x26;
var BITMAPNUM_SPLASH_DOWN  = 0x27;
var SPRITENUM_SPLASH_TITLE = 0x47;
var SPRITENUM_SPLASH_CRANE = 0x49;
var NUM_RIX_TITLE          = 0x5;

var welcome = {};

welcome.trademarkScreen = function*(surface) {
  var palette = Palette.get(3).day;
  surface.setPalette(palette);
  yield rng.play(6, 0, 1000, 25);
  yield sleep(1000);
  yield surface.fadeOut(1);
};

welcome.splashScreen = function*(surface) {
  var list = yield ajax.loadMKF('FBP', 'PAT', 'MGO');
  var fbp = ajax.MKF.FBP;
  var pat = ajax.MKF.PAT;
  var mgo = ajax.MKF.MGO;
  var up = fbp.decompressChunk(BITMAPNUM_SPLASH_UP),
      down = fbp.decompressChunk(BITMAPNUM_SPLASH_DOWN);
  var titleSprite = new Sprite(mgo.decompressChunk(SPRITENUM_SPLASH_TITLE)),
      titleBitmap = titleSprite.getFrame(0);
  var craneSprite = new Sprite(mgo.decompressChunk(SPRITENUM_SPLASH_CRANE));
  var titleHeight = titleBitmap.height;//PAL_RLEGetHeight(titleBitmap);
  titleBitmap[2] = titleBitmap[3] = 0; // HACK HACK

  // Generate the positions of the cranes
  var cranepos = utils.initArray(Array, 9);
  for (i = 0; i < cranepos.length; i++) {
    cranepos[i][0] = randomLong(300, 600);
    cranepos[i][1] = randomLong(0, 80);
    cranepos[i][2] = randomLong(0, 8);
  }

  // Play the title music

  // Clear all of the events and key states
  input.init();
  input.clear();
  var palette = Palette.get(1).day;
  var startTime = timestamp(),
      currentPalette = [],
      splashTime = 8000,
      fadeInTime = 6000,
      rollTime   = 4000;
  for (var i=0; i<palette.length; ++i) {
    var p = palette[i];
    currentPalette[i] = {
      r: p.r,
      g: p.g,
      b: p.b
    };
  }
  var iCraneFrame = 0;
  var time = 0;
  var update = function(delta) {
    return utils.raf(function*() {
      time += delta;

      // 全画面滚动
      var imagePos = ~~(200 * (rollTime - time) / rollTime);
      if (imagePos > 200) imagePos = 200;
      if (imagePos < 0) imagePos = 0;
      surface.blitFBP(up, {
        x:0, y:imagePos,
        w:320, h:200-imagePos
      }, {
        x:0, y:0,
        w:320, h:200-imagePos
      });

      surface.blitFBP(down, {
        x:0, y:0,
        w:320, h:imagePos
      }, {
        x:0, y:200 - imagePos,
        w:320, h:imagePos
      });

      // Draw the cranes...
      for (i = 0; i < cranepos.length; i++) {
        var frame = craneSprite.getFrame(
          cranepos[i][2] = (cranepos[i][2] + (iCraneFrame % 2)) % 8
        );
        cranepos[i][1] += ((imagePos > 0) && (imagePos % 2)) ? 1 : 0;

        surface.blitRLE(frame, PAL_XY(cranepos[i][0], cranepos[i][1]));

        cranepos[i][0]--;
      }
      iCraneFrame++;

      // Draw the title...
      if (titleBitmap.height < titleHeight) {
        // HACKHACK
        var w = titleBitmap[2] | (titleBitmap[3] << 8);
        w++;
        titleBitmap[2] = (w & 0xFF);
        titleBitmap[3] = (w >> 8);
      }
      surface.blitRLE(titleBitmap, PAL_XY(255, 10));

      // 全画面渐入
      if (time < splashTime) {
        for (i = 0; i < 256; i++) {
          currentPalette[i].r = (palette[i].r * (time / fadeInTime));
          currentPalette[i].g = (palette[i].g * (time / fadeInTime));
          currentPalette[i].b = (palette[i].b * (time / fadeInTime));
        }
      }
      surface.setPalette(currentPalette);
      //surface.updateScreen(null); // 上一句隐含

      // Check for keypress...
      if (input.keyPress & (Key.Menu | Key.Search)) {
        input.shutdown();
        imagePos = 0;
        // User has pressed a key...
        titleBitmap[2] = titleHeight & 0xFF;
        titleBitmap[3] = titleHeight >> 8; // HACKHACK

        surface.blitRLE(titleBitmap, PAL_XY(255, 10));

        surface.updateScreen(null);

        if (time < splashTime) {
          // If the picture has not completed fading in, complete the rest
          for (i = 0; i < 256; i++) {
            currentPalette[i].r = (palette[i].r * (time / splashTime));
            currentPalette[i].g = (palette[i].g * (time / splashTime));
            currentPalette[i].b = (palette[i].b * (time / splashTime));
          }
          surface.setPalette(currentPalette)
          while (time < splashTime) {
            yield update(FrameTime * 5);
          }
        }
      }
    });
  };

  while (time < splashTime) {
    yield update(FrameTime);
    yield sleep(FrameTime);
  }

  // Quit the splash screen
  yield surface.fadeOut(1);

  input.shutdown();
  input.clear();

  delete up;
  delete down;
  delete currentPalette;
  delete palette;
  delete titleSprite;
  delete titleBitmap;
  delete craneSprite;
};

export default welcome;

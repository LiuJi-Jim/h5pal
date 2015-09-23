import ajax from './ajax';
import yj_1 from './yj_1';

log.trace('rng module load');

var rng = {
  cache: {}
};

var surface = null;

rng.init = function*(surf) {
  surface = surf;
  global.rng = rng;
  var list = ['RNG'];
  yield ajax.loadMKF(list);
  list.forEach(function(name, i) {
    Files[name] = ajax.MKF[name];
  });
};

/**
 * Read a frame from a RNG animation.
 * @param  {Number} rngNum   the number of the RNG animation in the MKF archive.
 * @param  {Number} frameNum frame number in the RNG animation.
 * @return {Uint8Array}
 */
rng.readFrame = function(rngNum, frameNum) {
  var rngMKF = Files.RNG;

  // Get the total number of chunks.
  var chunkCount = rngMKF.chunkCount;
  if (rngNum >= chunkCount) {
    return null;
  }

  // Get the offset of the chunk.
  var bufferOffset = 4 * rngNum + 0;
  //fseek(fpRngMKF, 4 * uiRngNum, SEEK_SET);
  var offset = rngMKF.reader.getUint32(bufferOffset);
  bufferOffset += 4;
  //fread(&uiOffset, sizeof(UINT), 1, fpRngMKF);
  var nextOffset = rngMKF.reader.getUint32(bufferOffset);
  bufferOffset += 4;
  //fread(&uiNextOffset, sizeof(UINT), 1, fpRngMKF);
  //uiOffset = SWAP32(uiOffset);
  //uiNextOffset = SWAP32(uiNextOffset);

  // Get the length of the chunk.
  var chunkLen = nextOffset - offset;
  if (chunkLen != 0){
    bufferOffset = offset + 0;
    //fseek(fpRngMKF, uiOffset, SEEK_SET);
  } else {
    return null;
  }

  // Get the number of sub chunks.
  var chunkCount = rngMKF.reader.getUint32(bufferOffset);
  //fread(&uiChunkCount, sizeof(UINT), 1, fpRngMKF);
  chunkCount = ~~((chunkCount - 4) / 4);
  //uiChunkCount = (SWAP32(uiChunkCount) - 4) / 4;
  if (frameNum >= chunkCount) {
    return null;
  }

  // Get the offset of the sub chunk.
  bufferOffset = offset + 4 * frameNum + 0;
  //fseek(fpRngMKF, uiOffset + 4 * uiFrameNum, SEEK_SET);
  var subOffset = rngMKF.reader.getUint32(bufferOffset);
  bufferOffset += 4;
  //fread(&uiSubOffset, sizeof(UINT), 1, fpRngMKF);
  var nextOffset = rngMKF.reader.getUint32(bufferOffset);
  bufferOffset += 4;
  //fread(&uiNextOffset, sizeof(UINT), 1, fpRngMKF);
  //uiSubOffset = SWAP32(uiSubOffset);
  //uiNextOffset = SWAP32(uiNextOffset);

  // Get the length of the sub chunk.
  chunkLen = nextOffset - subOffset;

  if (chunkLen != 0){
    bufferOffset = offset + subOffset + 0;
    var buffer = new Uint8Array(chunkLen);
    for (var i=0; i<chunkLen; ++i) {
      buffer[i] = rngMKF.reader.getUint8(bufferOffset);
      bufferOffset++;
    }
    //fseek(fpRngMKF, uiOffset + uiSubOffset, SEEK_SET);
    //fread(lpBuffer, iChunkLen, 1, fpRngMKF);
    return buffer;
  }

  return null;
};

/**
 * [blitToSurface description]
 * @param  {Number} rngNum   The number of the animation in the MKF archive.
 * @param  {Number} frameNum The number of the frame in the animation.
 * @return {Boolean}
 */
rng.blitToSurface = function(rngNum, frameNum) {
  // Check for invalid parameters.
  if (rngNum < 0 || frameNum < 0) {
    return false;
  }

  // Read the frame.
  var buf = rng.readFrame(rngNum, frameNum);
  if (!buf) {
    return false;
  }

  // Decompress the frame.
  var rngFile = yj_1.decompress(buf);
  if (!rngFile) {
    return false;
  }

  // Draw the frame to the surface.
  // FIXME: Dirty and ineffective code, needs to be cleaned up
  var ended = false;
  var ptr = 0;
  var dst_ptr = 0;
  var data = 0;
  var wdata = 0;
  while (!ended) {
    data = rngFile[ptr++];
    if (!data) {
      ended = true;
      break;
    }
    switch (data) {
      case 0x00:
      case 0x13:
        // End
        ended = true;
        break;
      case 0x02:
        dst_ptr += 2;
        break;
      case 0x03:
        data = rngFile[ptr++];
        dst_ptr += (data + 1) * 2;
        break;
      case 0x04:
        wdata = rngFile[ptr] | (rngFile[ptr + 1] << 8);
        ptr += 2;
        dst_ptr += (wdata + 1) * 2;
        break;
      case 0x0a:
        var x = dst_ptr % 320;
        var y = ~~(dst_ptr / 320);
        surface.byteBuffer[y * surface.pitch + x] = rngFile[ptr++];
        if (++x >= 320) {
          x = 0;
          ++y;
        }
        surface.byteBuffer[y * surface.pitch + x] = rngFile[ptr++];
        dst_ptr += 2;
      case 0x09:
        var x = dst_ptr % 320;
        var y = ~~(dst_ptr / 320);
        surface.byteBuffer[y * surface.pitch + x] = rngFile[ptr++];
        if (++x >= 320) {
          x = 0;
          ++y;
        }
        surface.byteBuffer[y * surface.pitch + x] = rngFile[ptr++];
        dst_ptr += 2;
      case 0x08:
        var x = dst_ptr % 320;
        var y = ~~(dst_ptr / 320);
        surface.byteBuffer[y * surface.pitch + x] = rngFile[ptr++];
        if (++x >= 320) {
          x = 0;
          ++y;
        }
        surface.byteBuffer[y * surface.pitch + x] = rngFile[ptr++];
        dst_ptr += 2;
      case 0x07:
        var x = dst_ptr % 320;
        var y = ~~(dst_ptr / 320);
        surface.byteBuffer[y * surface.pitch + x] = rngFile[ptr++];
        if (++x >= 320) {
          x = 0;
          ++y;
        }
        surface.byteBuffer[y * surface.pitch + x] = rngFile[ptr++];
        dst_ptr += 2;
      case 0x06:
        var x = dst_ptr % 320;
        var y = ~~(dst_ptr / 320);
        surface.byteBuffer[y * surface.pitch + x] = rngFile[ptr++];
        if (++x >= 320) {
          x = 0;
          ++y;
        }
        surface.byteBuffer[y * surface.pitch + x] = rngFile[ptr++];
        dst_ptr += 2;
        break;
      case 0x0b:
        data = rngFile[ptr++];
        //data = *(rngFile + ptr++);
        for (var i = 0; i <= data; i++) {
          var x = dst_ptr % 320;
          var y = ~~(dst_ptr / 320);
          surface.byteBuffer[y * surface.pitch + x] = rngFile[ptr++];
          if (++x >= 320) {
            x = 0;
            ++y;
          }
          surface.byteBuffer[y * surface.pitch + x] = rngFile[ptr++];
          dst_ptr += 2;
        }
        break;
      case 0x0c:
        wdata = rngFile[ptr] | (rngFile[ptr + 1] << 8);
        ptr += 2;
        for (var i = 0; i <= wdata; i++) {
          var x = dst_ptr % 320;
          var y = ~~(dst_ptr / 320);
          surface.byteBuffer[y * surface.pitch + x] = rngFile[ptr++];
          if (++x >= 320) {
            x = 0;
            ++y;
          }
          surface.byteBuffer[y * surface.pitch + x] = rngFile[ptr++];
          dst_ptr += 2;
        }
        break;
      case 0x0d:
      case 0x0e:
      case 0x0f:
      case 0x10:
        for (var i = 0; i < data - (0x0d - 2); i++) {
          var x = dst_ptr % 320;
          var y = ~~(dst_ptr / 320);
          surface.byteBuffer[y * surface.pitch + x] = rngFile[ptr];
          if (++x >= 320) {
            x = 0;
            ++y;
          }
          surface.byteBuffer[y * surface.pitch + x] = rngFile[ptr + 1];
          dst_ptr += 2;
        }
        ptr += 2;
        break;
      case 0x11:
        data = rngFile[ptr++];
        //data = *(rngFile + ptr++);
        for (var i = 0; i <= data; i++) {
          var x = dst_ptr % 320;
          var y = ~~(dst_ptr / 320);
          surface.byteBuffer[y * surface.pitch + x] = rngFile[ptr];
          if (++x >= 320) {
            x = 0;
            ++y;
          }
          surface.byteBuffer[y * surface.pitch + x] = rngFile[ptr + 1];
          dst_ptr += 2;
        }
        ptr += 2;
        break;
      case 0x12:
        var n = (rngFile[ptr] | (rngFile[ptr + 1] << 8)) + 1;
        ptr += 2;
        for (var i = 0; i < n; i++) {
          var x = dst_ptr % 320;
          var y = ~~(dst_ptr / 320);
          surface.byteBuffer[y * surface.pitch + x] = rngFile[ptr];
          if (++x >= 320) {
            x = 0;
            ++y;
          }
          surface.byteBuffer[y * surface.pitch + x] = rngFile[ptr + 1];
          dst_ptr += 2;
        }
        ptr += 2;
        break;
    }
  }

  return true;
};

rng.play = function*(rngNum, startFrame, endFrame, speed) {
  log.debug('play rng', rngNum, startFrame, endFrame, speed);

  for (; startFrame <= endFrame; startFrame++){
    if (!rng.blitToSurface(rngNum, startFrame)) {
      // Failed to get the frame, don't go further
      return;
    }

    // Update the screen
    surface.updateScreen();

    // Fade in the screen if needed
    if (Global.needToFadeIn) {
      yield surface.fadeIn(Global.numPalette, Global.nightPalette, 1);
      Global.needToFadeIn = false;
    }

    // Delay for a while
    yield sleep(800 / (speed === 0 ? 16 : speed));
  }
};

export default rng;

/**
 * Battle UI
 * @module
 * @memberOf  ui
 */

import utils from './utils';
import MKF from './MKF';
import RLE from './RLE';
import Palette from './palette';
import Sprite from './sprite';
import ajax from './ajax';
import music from './music';
import text from './text';
import input from './input';

log.trace('uibattle module load');

var uibattle = {};

var surface = null;
var ui = null;

uibattle.init = function*(surf, _ui) {
  log.debug('[UI] init uibattle');
  ui = _ui;
  global.uibattle = ui.uibattle = uibattle;
  surface = surf;
};

export default uibattle;

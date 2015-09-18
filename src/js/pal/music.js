log.trace('music module load');

var music = {};

music.play = function() {
  var args = toArray(arguments);
  log.debug(['[MUSIC] play'].concat(args).join(' '));
};

export default music;

log.trace('music module load');

var music = {};

function pad(num, size) {
  var s = num+"";
  while (s.length < size) s = "0" + s;
  return s;
}

music.play = function() {
  Global.numMusic = arguments[0];
  var args = toArray(arguments);
  log.debug(['[MUSIC] play'].concat(args).join(' '));
  var audioSource = document.getElementById('bg-music-source');
  audioSource.src = "/pal-assets/MP3/" + pad(arguments[0], 3) + ".mp3";
  var audio = document.getElementById('bg-music');
  audio.pause();
  audio.load();
  audio.play();
};

export default music;

var gulp = require('gulp');
var del = require('del');
var connect = require('gulp-connect');
var sourcemaps = require('gulp-sourcemaps');
var to5 = require('gulp-6to5');
var runSequence = require('run-sequence');
var stylus = require('gulp-stylus');
var rename = require('gulp-rename');
var path = require('path');

var JS = ['src/**/*.js'];

var port = 8005;
var reloadPort = 35729;

// Clean Output Directory
gulp.task('clean', function(callback) {
  del(['.tmp', 'dist'], function(err, deletedFiles) {
    callback();
  });
});

gulp.task('js', function() {
  gulp.src(JS)
    .pipe(sourcemaps.init())
    .pipe(to5({
      blacklist: ['useStrict', 'regenerator'],
      modules: 'amd'
    }))
    //.pipe(concat('all.js'))
    .pipe(rename({ extname: '.js' }))
    .pipe(sourcemaps.write('.'))
    .pipe(gulp.dest('dist/'));
});

gulp.task('style', function() {
  return gulp.src(['src/stylus/*.styl', 'src/css/**/*.css'])
    .pipe(sourcemaps.init())
    .pipe(stylus({
      //linenos: true
    }))
    .pipe(sourcemaps.write('.'))
    .pipe(gulp.dest('dist/css/'));
});

gulp.task('build-lib', function() {
  var libs = {
    'jquery': 'dist/*',
    'requirejs': 'require.js',
    'sprintf': 'dist/sprintf.*',
    'q': 'q.js',
    'co': 'co.js'
  };
  for (var name in libs) {
    var src = path.join('bower_components', name, libs[name]);
    var dest = path.join('dist/lib', name);
    gulp.src(src).pipe(gulp.dest(dest));
  }
})

gulp.task('build', function(callback) {
  runSequence(
    ['build-lib'],
    ['js', 'style'],
    callback
  );
});

gulp.task('serve', function() {
  connect.server({
    host: '0.0.0.0',
    port: port
  });
});

gulp.task('dev', ['build', 'serve'], function() {
  gulp.watch(['src/js/**'], { interval: 500, debounceDelay: 1000 }, ['js']);
})

gulp.task('default', function() {
  runSequence(
    ['clean'],
    ['build']
  );
});

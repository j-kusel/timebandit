const gulp = require('gulp');
const jsdoc = require('gulp-jsdoc3');
const open = require('open');
const log = require('fancy-log');

log(__dirname + '/docs/index.html');
open(__dirname + '/docs/index.html', {app: 'firefox'});

gulp.task('docs', () => {
    gulp.watch(['./src/**/*.js'], cb => {
        const config = require('./jsdoc.conf.json');
        gulp.src(['./src/**/*.js'], {read: false})
            .pipe(jsdoc(config, cb));
    });
});


const gulp = require('gulp');
const jsdoc = require('gulp-jsdoc3');

gulp.task('docs', () => {
    gulp.watch(['./src/**/*.js'], cb => {
        const config = require('./jsdoc.conf.json');
        gulp.src(['./src/**/*.js'], {read: false})
            .pipe(jsdoc(config, cb));
    });
});


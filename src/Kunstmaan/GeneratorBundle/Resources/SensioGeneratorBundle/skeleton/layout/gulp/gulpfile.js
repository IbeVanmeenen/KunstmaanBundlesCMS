'use strict';

/* ==========================================================================
   Gulpfile


   Development-tasks:
   - gulp (builds for dev + watch)
   - gulp build (builds for prod)
   - gulp watch

   - gulp migrate
   - gulp cc (Clear Cache)
   - gulp fixperms
   - gulp maintenance
   - gulp apachectl
   ========================================================================== */


/* Setup Gulp
   ========================================================================== */
// Require
var gulp = require('gulp'),
    del = require('del'),
    fs = require('fs'),
    path = require('path'),
    _ = require('lodash'),
    rebase = require("rebase/tasks/gulp-rebase"),
    notifier = require('node-notifier'),
    runSequence = require('run-sequence'),
    plugins = require('gulp-load-plugins')();


// Gulp Config
var showErrorNotifications = true,
    allowChmod = true;


// Project Config
var bowerComponentsPath = JSON.parse(fs.readFileSync(path.resolve(__dirname, '.bowerrc'))).directory;

var config = fs.readFileSync(path.resolve(__dirname, '.groundcontrollrc'), 'UTF-8'),
    vars = _.merge({
        'bowerComponentsPath': bowerComponentsPath
    }, JSON.parse(config).vars);

var resourcesPath = vars.resourcesPath;
var distPath = vars.distPath;

_.forEach(vars, function(value, key) {
    config = config.replace(new RegExp('\<\=\s*' + key + '\s*\>', 'ig'), value);
});

config = JSON.parse(config);


/* Errorhandling
   ========================================================================== */

var errorLogger, headerLines;

errorLogger = function(headerMessage,errorMessage){
    var header = headerLines(headerMessage);
        header += '\n             '+ headerMessage +'\n           ';
        header += headerLines(headerMessage);
        header += '\r\n \r\n';
    plugins.util.log(plugins.util.colors.red(header) + '             ' + errorMessage + '\r\n')

    if(showErrorNotifications){
        notifier.notify({
            'title': headerMessage,
            'message': errorMessage,
            'contentImage':  __dirname + "/gulp_error.png"
        });
    }
}

headerLines = function(message){
    var lines = '';
    for(var i = 0; i< (message.length + 4); i++){
        lines += '-';
    }
    return lines;
}


/* Styles
   ========================================================================== */

gulp.task('styles', function() {
    return plugins.rubySass(config.scssFolder, {
            loadPath: ['./'],
            bundleExec: true
        })
        .on('error', function (err) {
            errorLogger('SASS Compilation Error', err.message);
        })

        // Combine Media Queries
        .pipe(plugins.combineMq())

        // Prefix where needed -> versie nummers in Gonfiguratie
        .pipe(plugins.autoprefixer('last 2 versions', 'ie 9', 'ie 10', 'ie 11'))

        // Minify output
        .pipe(plugins.minifyCss())

        // Rename the file to respect naming covention.
        .pipe(plugins.rename(function(path){
            path.basename += '.min';
        }))

        // Write to output
        .pipe(gulp.dest(config.dist.css))

        // Show total size of css
        .pipe(plugins.size({
            title: 'css'
        }));
});

/* Javascript
   ========================================================================== */

// Jshint
gulp.task('jshint', function() {
    return gulp.src([config.js.app, '!' + resourcesPath + '/ui/js/vendors/**/*.js'])
        // Jshint
        .pipe(plugins.jshint())
        .pipe(plugins.jshint.reporter(require('jshint-stylish')));
});


// Production
gulp.task('scripts-prod', ['jshint'], function() {
    return gulp.src(config.js.footer)
        // Uglify
        .pipe(plugins.uglify({
            mangle: {
                except: ['jQuery']
            }
        }))
        .on('error', function (err){
            errorLogger('Javascript Error', err.message);
        })

        // Concat
        .pipe(plugins.concat('footer.min.js'))

        // Set desitination
        .pipe(gulp.dest(config.dist.js))

        // Show total size of js
        .pipe(plugins.size({
            title: 'js'
        }));
});

gulp.task('inject-prod-scripts', ['scripts-prod'], function() {
    return gulp.src('src/'+ config.project.name + '/' + config.project.mainBundle + '/Resources/views/' + config.project.mainJsInclude.folder + '/' + config.project.mainJsInclude.fileName)
        // Inject
        .pipe(plugins.inject(gulp.src(config.dist.js + '/footer.min.js'), {
            ignorePath: '/web'
        }))

        // Chmod for local use
        .pipe(plugins.if(allowChmod, plugins.chmod(777)))

        // Write
        .pipe(gulp.dest('src/'+ config.project.name + '/' + config.project.mainBundle + '/Resources/views/' + config.project.mainJsInclude.folder + '/'));
});

// Development
gulp.task('scripts-dev', ['jshint'], function() {
    return gulp.src(config.js.footer)
        // Write
        .pipe(gulp.dest(config.dist.js));
});

gulp.task('inject-dev-scripts', ['scripts-dev'], function() {
    var files = gulp.src(config.js.footer, {read: false})

    return gulp.src('src/'+ config.project.name + '/' + config.project.mainBundle + '/Resources/views/' + config.project.mainJsInclude.folder + '/' + config.project.mainJsInclude.fileName)
        // Inject
        .pipe(plugins.inject(files))

        // Rebase
        .pipe(rebase({
            script: {
                '(\/[^"]*\/)': '/frontend/js/'
            }
        }))

        // Write
        .pipe(gulp.dest('app/Resources/'+ config.project.name + config.project.mainBundle + '/views/' + config.project.mainJsInclude.folder + '/'));
});


/* Images
   ========================================================================== */

gulp.task('images', function() {
    return gulp.src(config.img)
        // Only optimize changed images
        .pipe(plugins.changed(config.dist.img))

        // Imagemin
        .pipe(plugins.imagemin({
            optimizationLevel: 3,
            progressive: true,
            svgoPlugins: [{
                removeViewBox: false
            }]
        }))

        // Set desitination
        .pipe(gulp.dest(config.dist.img))

        // Show total size of images
        .pipe(plugins.size({
            title: 'images'
        }));
});


/* Styleguide
   ========================================================================== */

// Hologram
gulp.task('styleguide', function() {
    return gulp.src(config.styleguideFolder, {read: false})
        // Hologram
        .pipe(plugins.shell([
            'bundle exec hologram',
        ], {
            cwd: config.styleguideFolder
        }));
});


// Inject scripts
gulp.task('styleguide-prod-js', function() {
    return gulp.src(config.dist.styleguide + '/*.html')
        // Inject
        .pipe(plugins.inject(gulp.src(config.dist.js + '/footer.min.js'), {
            ignorePath: '/web'
        }))

        // Write
        .pipe(gulp.dest(config.dist.styleguide));
});

gulp.task('styleguide-dev-js', function() {
    var files = gulp.src(config.js.footer, {read: false})

    return gulp.src(config.dist.styleguide + '/*.html')

        // Inject
        .pipe(plugins.inject(files))

        // Rebase
        .pipe(rebase({
            script: {
                '(\/[^"]*\/)': '/frontend/js/'
            }
        }))

        // Write
        .pipe(gulp.dest(config.dist.styleguide));
});



/* Clean/clear
   ========================================================================== */

gulp.task('clean', function(done) {
    del([
        distPath + '**',
        'app/Resources/'+ config.project.name + config.project.mainBundle + '/views/' + config.project.mainJsInclude.folder + '/' + config.project.mainJsInclude.fileName,
    ], done);
});


/* Default tasks
   ========================================================================== */

// Watch
gulp.task('watch', function() {
    // Livereload
    plugins.livereload.listen();
    gulp.watch(config.liveReloadFiles).on('change', function(file) {
        plugins.livereload.changed(file.path);
        gulp.start('styleguide');
    });

    // Styles
    gulp.watch(config.scss, ['styles']);

    // Scripts
    gulp.watch(config.js.app, ['scripts']);

    // Images
    gulp.watch(config.img, ['images']);
});


// Build
gulp.task('build', function(done) {
    runSequence(
        'clean',
        ['clear-symfony-cache', 'styles', 'inject-prod-scripts', 'images'],
        'styleguide',
        'styleguide-prod-js',
    done);
});


// Build Deploy
gulp.task('build-deploy', function(done) {
    allowChmod = false;

    gulp.start('build');
});


// Default
gulp.task('default', function(done) {
    runSequence(
        'clean',
        ['clear-symfony-cache', 'styles', 'inject-dev-scripts', 'images'],
        ['styleguide', 'watch'],
        'styleguide-dev-js',
    done);
});


/* Other tasks
   ========================================================================== */

// Clear symfony cache
gulp.task('clear-symfony-cache', plugins.shell.task([
    'rm -rf app/cache/*'
]));


// Migrate
gulp.task('migrate', plugins.shell.task([
    'app/console doctrine:migrations:migrate --no-interaction'
]));

// Clear Cache
gulp.task('cc', plugins.shell.task([
    'php app/console cache:clear',
    'php app/console assetic:dump',
    'php app/console assets:install web --symlink'
]));

// Fix perms
gulp.task('fixperms', plugins.shell.task([
    ['sudo python fixperms.py' + config.project.name]
], {
    cwd: '/opt/kDeploy/tools'
}));

// Maintenance
gulp.task('maintenance', plugins.shell.task([
    'sudo python maintenance.py quick'
], {
    cwd: '/opt/kDeploy/tools'
}));

// Restart Apache
gulp.task('apachectl', plugins.shell.task([
    'sudo apachectl restart'
], {
    cwd: '/opt/kDeploy/tools'
}));


// Install for Bower & npm
gulp.task('install_npm_bower', plugins.shell.task([
    'npm install',
    'bower install'
]));

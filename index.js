/*jslint node: true */
"use strict";


var express = require('express');
var engine = require('ejs-locals'); // needed to use layout.ejs in express 3.x
var app = express();

var db = require('./db');
db.connect({
    onOpen: initApplication
});

function initApplication() {
    var config = require('./config');
    var OAuth = require('oauth').OAuth;
    var oa = new OAuth(
        "https://api.twitter.com/oauth/request_token",
        "https://api.twitter.com/oauth/access_token",
        config.twitter.consumerKey,
        config.twitter.consumerSecret,
        "1.0A",
        config.twitter.authCallback,
        "HMAC-SHA1"
    );
    var middle = require('./middleware');
    var auth = require('./controller/auth')(oa);
    var timeline = require('./controller/timeline')(oa);

    var cron = require('./cron')(oa, timeline);

    console.log("connected to DB -> initApplication");

    // use ejs-locals for all ejs templates:
    app.engine('ejs', engine);
    app.set('views', __dirname + '/views');
    app.set('view engine', 'ejs');

    app.use(express.bodyParser());
    app.use(express.cookieParser(config.app.cookie.secret));
    app.use(express.session());
    app.use(app.router);
    app.use(express.static('public'));

    // global error handler
    app.use(function(err, req, res, next){
        res.send(500, { error: 'Sorry something bad happened! ' + err });
    });


    // Routes
    app.get('/', function(req, res) {
        res.render('index', { user: req.session.user });
    });
    app.get('/auth/twitter', auth.twitterAuth);
    app.get('/auth/twitter/callback', auth.twitterAuthCallback);
    app.get('/auth/logout', auth.logout);
    app.get('/rss/:userid', timeline.getUserFeed);

    app.listen(3000);
    console.log('Listening on port 3000', process.pid);

    // start cron
    cron.init();
}

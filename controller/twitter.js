/*jslint node: true */
"use strict";

var crypto = require('crypto');

var generate_key = function() {
    var sha = crypto.createHash('sha256');

    sha.update(Math.random().toString());
    return sha.digest('hex');
};

module.exports = function(oa) {
    var db = require('../db'),
        User = db.User,
        io = require('./io'),
        apiUrl = 'https://api.twitter.com/';

    var auth = function(req, res, next) {
        oa.getOAuthRequestToken(function (error, token, tokenSecret, results) {
            if (error) {
                console.error(new Date(), error);
                next(new Error("yeah no. didn't work."));
            }
            else {
                req.session.oauth = {};
                req.session.oauth.token = token;
                req.session.oauth.tokenSecret = tokenSecret;
                console.log('token: ' + req.session.oauth.token);
                console.log('tokenSecret: ' + req.session.oauth.tokenSecret);
                res.redirect(apiUrl + 'oauth/authenticate?oauth_token=' + token);
            }
        });
    };

    var authCallback = function(req, res, next) {
        if (req.session.oauth) {
            req.session.oauth.verifier = req.query.oauth_verifier;

            oa.getOAuthAccessToken(
                req.session.oauth.token,
                req.session.oauth.tokenSecret,
                req.session.oauth.verifier,
                function (error, accessToken, accessTokenSecret, data) {
                    if (error) {
                        console.error(new Date(), error);
                        next(new Error("something broke."));
                    }
                    else {
                        req.session.oauth.accessToken = accessToken;
                        req.session.oauth.accessTokenSecret = accessTokenSecret;

                        User.findOne({id: data.user_id}, function (err, user) {
                            var newSession = generate_key();

                            if (typeof user === 'undefined' || user === null) {
                                // user not found -> create
                                user = new User({
                                    id: db.Long.fromString(data.user_id),
                                    screenname: data.screen_name,
                                    oauth_token: accessToken,
                                    oauth_secret: accessTokenSecret,
                                    lastGReaderTweet: 0,
                                    session: newSession,
                                    timeline: []
                                });
                            }
                            else {
                                // user found -> update token
                                user.oauth_token = accessToken;
                                user.oauth_secret = accessTokenSecret;
                                user.session = newSession;
                            }

                            // save user to session
                            req.session.user = user;

                            // save session to cookie
                            res.cookie('tfr-session', newSession, {
                                maxAge: 60 * 1000 * 60 * 24 * 365
                            });

                            user.save(function (err2) {
                                if (err2) {
                                    console.error(
                                        new Date(),
                                        "error while saving new user to DB",
                                        err2
                                    );
                                }
                                else {
                                    console.log("user added/updated > " + user.screenname);
                                }
                                res.redirect('/');
                            });
                        });
                    }
                }
            );
        }
        else {
            next(new Error("you're not supposed to be here."));
        }
    };

    var getHomeTimeline = function(user, callback) {
        var url = apiUrl + '1.1/statuses/home_timeline.json',
            lastTweet;

        if (user.timeline && user.timeline.length > 0) {
            lastTweet = user.timeline[user.timeline.length-1];
            url += '?since_id=' + lastTweet;
        }

        console.log(user.screenname, "getHomeTimeline() " + url);

        oa.get(url, user.oauth_token, user.oauth_secret, function (error, data) {
            if (error) {
                console.error(new Date(), user.screenname, error);
            }
            else {
                // replace 'type' with 'media_type' b/c conflicts w/ mongoose
                data = data.replace(/"type":/g, '"media_type":');
                data = JSON.parse(data);
                data.reverse(); // sort: old -> new
                io.addTweetsToUser(data, user.id);
            }

            // tell cron to fetch next user from twitter + ignore any errors
            callback(null);
        });
    };

    var logout = function(req, res, next) {
        User.findOne({id: req.session.user.id}, function (err, user) {
            if (err) {
                console.error(new Date(), err);
                next(new Error('logout failed (1)'));
            }

            user.session = null;

            user.save(function(err) {
                if (err) {
                    console.error(new Date(), err);
                    next(new Error('logout failed (2)'));
                }

                delete req.session.user;
                res.clearCookie('tfr-session');

                res.redirect('/');
            });
        });
    };

    // public methods
    return {
        auth: auth,
        authCallback: authCallback,
        getHomeTimeline: getHomeTimeline,
        logout: logout
    };
};
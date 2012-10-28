/*jslint node: true */
"use strict";

module.exports = function(oa) {
    var db = require('../db'),
        User = db.User,
        io = require('./io');

    var auth = function(req, res) {
        oa.getOAuthRequestToken(function (error, oauth_token, oauth_token_secret, results){
            if (error) {
                console.error(new Date(), error);
                res.send(404, "yeah no. didn't work.");
            }
            else {
                req.session.oauth = {};
                req.session.oauth.token = oauth_token;
                req.session.oauth.token_secret = oauth_token_secret;
                console.log('oauth.token: ' + req.session.oauth.token);
                console.log('oauth.token_secret: ' + req.session.oauth.token_secret);
                res.redirect('https://api.twitter.com/oauth/authenticate?oauth_token='+oauth_token);
            }
        });
    };

    var authCallback = function(req, res, next) {
        if (req.session.oauth) {
            req.session.oauth.verifier = req.query.oauth_verifier;
            oa.getOAuthAccessToken(req.session.oauth.token,
                req.session.oauth.token_secret,
                req.session.oauth.verifier,
                function (error, oauth_access_token, oauth_access_token_secret, results) {
                    if (error) {
                        console.error(new Date(), error);
                        res.send(404, "something broke.");
                    }
                    else {
                        req.session.oauth.access_token = oauth_access_token;
                        req.session.oauth.access_token_secret = oauth_access_token_secret;

                        User.findOne({id:results.user_id}, function (err, user) {
                            if (typeof user === 'undefined' || user === null) {
                                console.log("user not found -> " + results.screen_name);
                                user = new User({
                                    id: db.Long.fromString(results.user_id),
                                    screenname: results.screen_name,
                                    oauth_token: oauth_access_token,
                                    oauth_secret: oauth_access_token_secret,
                                    lastGReaderTweet: 0
                                });
                            }
                            else {
                                console.log("1) user found -> " + results.screen_name);

                                // update token
                                user.oauth_token = oauth_access_token;
                                user.oauth_secret = oauth_access_token_secret;
                            }

                            // save user to session
                            req.session.user = user;

                            user.save(function (err2) {
                                if (err2) {
                                    console.error(new Date(), "error while trying to save new user to DB :: ", err2);
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
        var url = 'https://api.twitter.com/1.1/statuses/home_timeline.json',
            lastTweet;

        if (user.timeline && user.timeline.length > 0) {
            lastTweet = user.timeline[user.timeline.length-1];
            url += '?since_id=' + lastTweet.tweet_id;
        }

        console.log(user.screenname, "getHomeTimeline() " + url);

        oa.get(url, user.oauth_token, user.oauth_secret, function (error, data) {
            if (error) {
                console.error(new Date(), user.screenname, error);
            }
            else {
                // replace 'type' with 'media_type' otherwise conflicts w/ mongoose
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
        delete req.session.user;
        res.redirect('/');
    };

    // public methods
    return {
        auth: auth,
        authCallback: authCallback,
        getHomeTimeline: getHomeTimeline,
        logout: logout
    };
};
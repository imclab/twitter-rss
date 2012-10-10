/*jslint node: true */
"use strict";

module.exports = function(oa) {
    var db = require('../db'),
        User = db.User;

    return {
        twitterAuth: function(req, res) {
            oa.getOAuthRequestToken(function (error, oauth_token, oauth_token_secret, results){
                if (error) {
                    console.error(error);
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
        },

        twitterAuthCallback: function(req, res, next) {
            if (req.session.oauth) {
                req.session.oauth.verifier = req.query.oauth_verifier;
                oa.getOAuthAccessToken(req.session.oauth.token,
                    req.session.oauth.token_secret,
                    req.session.oauth.verifier,
                    function (error, oauth_access_token, oauth_access_token_secret, results) {
                        if (error) {
                            console.error(error);
                            res.send(404, "something broke.");
                        }
                        else {
                            req.session.oauth.access_token = oauth_access_token;
                            req.session.oauth.access_token_secret = oauth_access_token_secret;

                            User.findOne({id:results.user_id}, function (err, user) {
                                if (typeof user === 'undefined' || user === null) {
                                    console.log("user not found");
                                    user = new User({
                                        id: parseInt(results.user_id, 10),
                                        screenname: results.screen_name,
                                        oauth_token: oauth_access_token,
                                        oauth_secret: oauth_access_token_secret
                                    });
                                }
                                else {
                                    console.log("1) user found");

                                    // update token
                                    user.oauth_token = oauth_access_token;
                                    user.oauth_secret = oauth_access_token_secret;
                                }

                                // save user to session
                                req.session.user = user;

                                user.save(function (err2) {
                                    if (err2) {
                                        console.error("error while trying to save new user to DB :: ", err2);
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
        },

        logout: function(req, res, next) {
            delete req.session.user;
            res.redirect('/');
        }
    };
};
/*jslint node: true */
"use strict";

var async = require('async'),
    db = require('../db'),
    User = db.User,
    Tweet = db.Tweet;

// queue for saving tweets
var q = async.queue(function (task, callback) {
    saveTweets(task, callback);
}, 1);

var getUserFeed = function(req, res, next) {
    var userId = req.params.userid,
        userAgent = req.headers['user-agent'];

    User.findOne({id: userId}, function (err, user) {
        var i, l, ids, id,
            lastGReaderTweet, lastTweet,
            isFeedfetcher = false;

        if (err) {
            res.send(404, 'Sorry, we cannot find that!');
        }
        else {
            if (user !== null && user.timeline && user.timeline.length > 0) {
                lastGReaderTweet = user.lastGReaderTweet;

                // check if google reader feedfetcher
                isFeedfetcher = userAgent.indexOf('Feedfetcher-Google') !== -1;
                if (isFeedfetcher) {
                    console.log(new Date(), 'getUserFeed() Google Feedfetcher');
                    lastTweet = user.timeline[user.timeline.length-1];
                    user.lastGReaderTweet = lastTweet.tweet_id;
                    user.save(function (err) {
                        if (err) {
                            console.error(
                                new Date(),
                                'Error update GReaderTweet',
                                err
                            );
                        }
                    });
                }

                ids = [];
                if (isFeedfetcher && lastGReaderTweet > 0) {
                    i = user.timeline.length-1;
                    do {
                        id = user.timeline[i].tweet_id;
                        ids.push(id);
                        --i;
                        if (i < 0) {
                            console.error(
                                new Date(),
                                "GReader index out of bounds...",
                                lastGReaderTweet
                            );
                            break;
                        }
                    } while (id > lastGReaderTweet);
                }
                else {
                    l = user.timeline.length;
                    i = l-1;
                    l = (l < 50) ? 0 : l-50; // max 50 tweets
                    while (i>l) {
                        ids.push(user.timeline[i].tweet_id);
                        --i;
                    }
                }

                Tweet.find(
                    {'id': { $in: ids}},
                    null,
                    {sort: {created_at: -1}},
                    function (err, tweets) {
                        if (err) {
                            console.error(new Date(), err);
                        }
                        else {
                            res.render('rss', {
                                user: user,
                                tweets: tweets,
                                layout: false
                            });
                        }
                        ids = null;
                        lastTweet = null;
                        lastGReaderTweet = null;
                    }
                );
            }
            else {
                res.send(404, 'Sorry, we cannot find that!');
            }
        }
    });
};

var saveTweets = function(data, next) {
    var addedTweet = false;

    // get user by ID
    User.findOne({id:data.userId}, function (error, user) {
        if (error) {
            console.error(new Date(), error);
        }
        else if (typeof user !== 'undefined' && user !== null) {
            // iterate over every tweet and check if it's new
            async.forEachSeries(data.tweets, function (tweetData, callback) {
                var tweet,
                    retweet_user;

                tweet = {
                    id: db.Long.fromString(tweetData.id_str),
                    created_at: tweetData.created_at,
                    text: tweetData.text,
                    entities: tweetData.entities,
                    user: {
                        name: tweetData.user.name,
                        screen_name: tweetData.user.screen_name,
                        profile_image_url: tweetData.user.profile_image_url
                    },
                    retweet: false
                };

                // check for retweet and adjust accordingly
                if (typeof tweetData.retweeted_status !== 'undefined') {
                    tweet.retweet = true;
                    retweet_user = tweetData.retweeted_status.user;
                    tweet.retweet_user = {
                        name: retweet_user.name,
                        screen_name: retweet_user.screen_name,
                        profile_image_url: retweet_user.profile_image_url
                    };
                }

                Tweet.update(
                    {id: tweet.id},
                    tweet,
                    {upsert: true},
                    function (error) {
                        var i, l, t,
                            found = false;

                        if (error) {
                            console.error(new Date(), error);
                        }
                        else {
                            i = user.timeline.length-1;
                            while (i>0) {
                                t = user.timeline[i];
                                if (t.tweet_id.equals(tweet.id)) {
                                    found = true;
                                    break;
                                }
                                else if (t.tweet_id.lessThan(tweet.id)) {
                                    // break because tweet_id from timeline-tweet
                                    // is older than the ID from the tweet we're
                                    // looking for
                                    break;
                                }
                                --i;
                            }

                            if (!found) {
                                console.log(
                                    user.screenname,
                                    "push " + tweet.id,
                                    tweet.created_at
                                );
                                user.timeline.push({ 'tweet_id': tweet.id });
                                addedTweet = true;
                            }
                        }

                        // next iteration in async-series
                        callback(null);
                        tweet = null;
                        retweet_user = null;
                    }
                );
            },
            // async done callback
            function (asyncError) {
                if (addedTweet) {
                    // save user regardless of occuring error
                    user.save(function(errorSave) {
                        if (errorSave) {
                            console.error(
                                new Date(),
                                user.screenname,
                                errorSave
                            );
                        }
                        else {
                            console.log("user updated ... " + user.screenname);
                        }
                        next();
                    });
                }
                else {
                    next();
                }
            });
        }
    });
};

module.exports = {
    getFeedForUser: getUserFeed,
    addTweetsToUser: function(tweets, userId) {
        q.push({
            tweets: tweets,
            userId: userId
        });
    }
};
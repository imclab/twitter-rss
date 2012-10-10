/*jslint node: true */
"use strict";


module.exports = function(oa) {
    var async = require('async'),
        db = require('../db'),
        User = db.User,
        Tweet = db.Tweet;

    function saveTweetsToUser(tweets, user) {
        async.forEachSeries(tweets, function (tweetData, cb) {
            var tweet = {
                id: tweetData.id_str,
                created_at: tweetData.created_at,
                text: tweetData.text,
                entities: tweetData.entities,
                user: {
                    name: tweetData.user.name,
                    screen_name: tweetData.user.screen_name,
                    profile_image_url: tweetData.user.profile_image_url
                }
            };

            Tweet.update({id: tweet.id}, tweet, {upsert: true}, function (err) {
                var i, l, t,
                    found = false;

                if (err) {
                    console.error(err);
                }
                else {
                    // TODO: speed up search
                    i = user.timeline.length-1;
                    while (i>0) {
                        t = user.timeline[i];
                        if (t.tweet_id === tweet.id) {
                            found = true;
                            break;
                        }
                        --i;
                    }

                    if (!found) {
                        console.log(user.screenname, "push", tweet.id);
                        user.timeline.push({'tweet_id': tweet.id, 'tweet_time': tweet.created_at});
                    }
                }

                cb(null);
                tweet = null;
            });

        }, function (err) {
            if (err) {
                console.error(err);
            }
            else {
                user.save(function(err2) {
                    if (err2) {
                        console.error(user.screenname, err2);
                    }
                });
            }
        });
    }

    return {
        getHomeTimeline: function(user, callback) {
            var url = 'https://api.twitter.com/1.1/statuses/home_timeline.json',
                lastTweet;

            if (user.timeline && user.timeline.length > 0) {
                lastTweet = user.timeline[user.timeline.length-1];
                url += '?since_id=' + lastTweet.tweet_id;
            }

            oa.get(url, user.oauth_token, user.oauth_secret, function (error, data) {
                if (error) {
                    console.error('error', user.screenname, error.toString());
                }
                else {
                    // parse and save data to DB
                    data = JSON.parse(data);
                    data.reverse();
                    saveTweetsToUser(data, user);
                }
                // tell cron to fetch next user from twitter
                callback(null);
            });
        },

        getUserFeed: function(req, res, next) {
            var userId = req.params.userid;
            User.findOne({id: userId}, function (err, user) {
                var i, l, ids;
                if (err) {
                    res.send(404, 'Sorry, we cannot find that!');
                }
                else {
                    if (user !== null &&
                        user.timeline &&
                        user.timeline.length > 0
                    ) {
                        ids = [];
                        l = user.timeline.length;
                        i = l-1;
                        l = (l < 200) ? 0 : l-200; // max 200 tweets
                        while (i>l) {
                            ids.push(user.timeline[i].tweet_id);
                            --i;
                        }

                        Tweet.find(
                            {'id': { $in: ids}},
                            null,
                            {sort: {created_at: -1}},
                            function (err, tweets) {
                                if (err) {
                                    console.error(err);
                                }
                                else {
                                    res.render('rss', {
                                        user: user,
                                        tweets: tweets,
                                        layout: false
                                    });
                                }
                                ids = null;
                            }
                        );
                    }
                    else {
                        res.send(404, 'Sorry, we cannot find that!');
                    }
                }
            });
        }
    };

};
/*jslint node: true */
"use strict";


module.exports = function(oa) {
    var async = require('async'),
        db = require('../db'),
        User = db.User,
        Tweet = db.Tweet;

    var formatTweet = function(tweet) {
        var i, l,
            url, user, media,
            r, replaces = [],
            html, title,
            instagramRegex = /http:\/\/instagr.am\/p\/([A-Za-z0-9]+)\//g,
            match, temp;

        html = title = tweet.text;

        if (tweet.entities.urls.length > 0) {
            for (i=0,l=tweet.entities.urls.length;i<l;++i) {
                url = tweet.entities.urls[i];

                temp = {
                    type: 'url',
                    start: url.indices[0],
                    end: url.indices[1],
                    content: url.expanded_url,
                    html: '<a href="'+url.expanded_url+'">'+url.expanded_url+'</a>'
                };

                // look for instagram URLs like e.g. http://instagr.am/p/<ID>/
                match = instagramRegex.exec(url.expanded_url);
                if (match !== null) {
                    temp.html = '<p><img src="http://instagr.am/p/'+match[1]+'/media/?size=l"></p>';
                }

                replaces.push(temp);
            }
        }
        if (tweet.entities.user_mentions.length > 0) {
            for (i=0,l=tweet.entities.user_mentions.length;i<l;++i) {
                user = tweet.entities.user_mentions[i];
                replaces.push({
                    type: 'user',
                    start: user.indices[0],
                    end: user.indices[1],
                    content: '@'+user.screen_name,
                    html: '<a href="https://twitter.com/'+user.screen_name+'">@'+user.screen_name+'</a>'
                });
            }
        }
        if (tweet.entities.media && tweet.entities.media.length > 0) {
            for (i=0,l=tweet.entities.media.length;i<l;++i) {
                media = tweet.entities.media[i];
                if (media.media_type === 'photo') {
                    replaces.push({
                        type: 'photo',
                        start: media.indices[0],
                        end: media.indices[1],
                        content: media.media_url,
                        html: '<p><img src="'+media.media_url+'"></p>'
                    });
                }
            }
        }

        // sort replaces DESC
        replaces.sort(function (a, b) {
            return b.start - a.start;
        });

        // replacing...
        for (i=0,l=replaces.length;i<l;++i) {
            r = replaces[i];
            html = insertSubstring(html, r.start, r.end, r.html);
            // for tweet's title only replace URLs
            if (r.type === 'url') {
                title = insertSubstring(title, r.start, r.end, r.content);
            }
        }

        html.replace(/\n/g, '<br>');
        tweet.html = html;

        title.replace(/\n/g, ' ');
        tweet.title = title;

        return tweet;
    };

    var insertSubstring = function(str, start, end, s) {
        return str.slice(0, start) + s + str.slice(end);
    };

    var saveTweetsToUser = function(tweets, user) {
        var addedTweet = false;
        // iterate over every tweet and check if it's new
        async.forEachSeries(tweets, function (tweetData, cb) {
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

            if (typeof tweetData.retweeted_status !== 'undefined') {
                tweet.retweet = true;
                retweet_user = tweetData.retweeted_status.user;
                tweet.retweet_user = {
                    name: retweet_user.name,
                    screen_name: retweet_user.screen_name,
                    profile_image_url: retweet_user.profile_image_url
                };
            }

            Tweet.update({id: tweet.id}, tweet, {upsert: true}, function (error) {
                var i, l, t,
                    found = false;

                if (error) {
                    console.error(new Date(), error);
                }
                else {
                    // TODO: speed up search (binary?!)
                    i = user.timeline.length-1;
                    while (i>0) {
                        t = user.timeline[i];
                        if (t.tweet_id.equals(tweet.id)) {
                            found = true;
                            break;
                        }
                        else if (t.tweet_id.lessThan(tweet.id)) {
                            // break because tweet_id from timeline-tweet is
                            // older than the ID from the tweet we're looking for
                            break;
                        }
                        --i;
                    }

                    if (!found) {
                        console.log(user.screenname, "push " + tweet.id, tweet.created_at);
                        user.timeline.push({'tweet_id': tweet.id, 'tweet_time': tweet.created_at});
                        addedTweet = true;
                    }
                }

                cb(null);
                tweet = null;
                retweet_user = null;
            });

        }, function (errorAsync) {
            if (errorAsync) {
                console.error(new Date(), "AsyncResult >>> ", errorAsync);
            }

            if (addedTweet) {
                // save user regardless of occuring error
                user.save(function(errorSave) {
                    if (errorSave) {
                        console.error(new Date(), user.screenname, errorSave);
                    }
                    else {
                        console.log("user updated ... " + user.screenname);
                    }
                });
            }

        });
    };


    // public methods
    return {
        getHomeTimeline: function(user, callback) {
            var url = 'https://api.twitter.com/1.1/statuses/home_timeline.json',
                lastTweet;

            if (user.timeline && user.timeline.length > 0) {
                lastTweet = user.timeline[user.timeline.length-1];
                url += '?since_id=' + lastTweet.tweet_id;
            }

            console.log(user.screenname, "getHomeTimeline() " + url, lastTweet.tweet_time);

            oa.get(url, user.oauth_token, user.oauth_secret, function (error, data) {
                if (error) {
                    console.error(new Date(), user.screenname, error);
                }
                else {
                    // replace 'type' with 'media_type' otherwise conflicts w/ mongoose
                    data = data.replace(/"type":/g, '"media_type":');
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
            var userId = req.params.userid,
                userAgent = req.headers['user-agent'];
            console.log('getUserFeed() :: User-Agent: ' + userAgent);

            User.findOne({id: userId}, function (err, user) {
                var i, l, ids, id,
                    lastGReaderTweet, lastTweet;

                if (err) {
                    res.send(404, 'Sorry, we cannot find that!');
                }
                else {
                    if (user !== null &&
                        user.timeline &&
                        user.timeline.length > 0
                    ) {
                        lastGReaderTweet = user.lastGReaderTweet;
                        // check if google reader
                        if (userAgent.indexOf('Feedfetcher-Google') !== -1) {
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
                        if (lastGReaderTweet <= 0) {
                            l = user.timeline.length;
                            i = l-1;
                            l = (l < 50) ? 0 : l-50; // max 50 tweets
                            while (i>l) {
                                ids.push(user.timeline[i].tweet_id);
                                --i;
                            }
                        }
                        else {
                            i = user.timeline.length-1;
                            do {
                                id = user.timeline[i].tweet_id;
                                ids.push(id);
                                --i;
                                if (i < 0) {
                                    console.error(new Date(), "GReader index out of bounds...", lastGReaderTweet);
                                    break;
                                }
                            } while (id > lastGReaderTweet);
                        }

                        Tweet.find(
                            {'id': { $in: ids}},
                            null,
                            {sort: {created_at: -1}},
                            function (err, tweets) {
                                var i, l;

                                if (err) {
                                    console.error(new Date(), err);
                                }
                                else {
                                    // replace URLs/MENTIONs/MEDIA
                                    for (i=0,l=tweets.length;i<l;++i) {
                                        tweets[i] = formatTweet(tweets[i]);
                                    }

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
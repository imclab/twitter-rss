/*jslint node: true */
"use strict";

var mongoose = require('mongoose');
var ObjectId = mongoose.Schema.Types.ObjectId;

var userSchema = new mongoose.Schema({
    id: {type: Number, unique: true},
    screenname: String,
    oauth_token: String,
    oauth_secret: String,
    timeline: [{
        tweet_id: {type: String, unique: true},
        tweet_time: Date
    }],
    lastGReaderTweet: Number
});

var tweetSchema = new mongoose.Schema({
    id: {type: String, unique: true},
    created_at: Date,
    text: String,
    entities: {
        hashtags: [{
            text: String,
            indices: [Number]
        }],
        urls: [{
            expanded_url: String,
            url: String,
            indices: [Number],
            display_url: String
        }],
        user_mentions: [{
            name: String,
            id: Number,
            indices: [Number],
            screen_name: String
        }],
        media: [{
            indices: [Number],
            media_url: String,
            media_url_https: String,
            display_url: String,
            media_type: String
        }]
    },
    user: {
        id: Number,
        name: String,
        screen_name: String,
        profile_image_url: String
    }
});

exports.User = mongoose.model('User', userSchema);
exports.Tweet = mongoose.model('Tweet', tweetSchema);

exports.connect = function(options) {
    var _ = require('underscore');
    var config = require('./config');
    var db,
        connectCallback,
        errorCallback;

    options = _.extend({
        onOpen: function () {
            console.log("DB connected");
        },
        onError: function (err) {
            if (err) {
                console.error("DB error " + err);
            }
        }
    }, options);

    mongoose.connection.once('open', options.onOpen);
    mongoose.connect(config.db.mongoUrl, options.onError);
};


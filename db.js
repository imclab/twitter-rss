/*jslint node: true */
"use strict";

var mongoose = require('mongoose');
require('mongoose-long')(mongoose);

var ObjectId = mongoose.Schema.Types.ObjectId;
var Long = mongoose.Schema.Types.Long;

// different Long for working w/ Longs
exports.Long = mongoose.Types.Long;

var userSchema = new mongoose.Schema({
    id: {type: Long, unique: true},
    screenname: String,
    oauth_token: String,
    oauth_secret: String,
    timeline: [Long],
    lastGReaderTweet: Long
});

var tweetSchema = new mongoose.Schema({
    id: {type: Long, unique: true},
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
        name: String,
        screen_name: String,
        profile_image_url: String
    },
    retweet: Boolean,
    retweet_user: {
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


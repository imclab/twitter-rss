/*jslint node: true */
"use strict";

exports.app = {
    cookie: {
        secret: '<TOPSECRET>'
    }
};

exports.twitter = {
    consumerKey: '<KEY>',
    consumerSecret: '<SECRET>',
    // only define authCallback if differs from twitter app setup
    authCallback: '<CALLBACK>'
};

exports.db = {
    mongoUrl: 'mongodb://<USER>:<PWD>@<URL/IP>:<PORT>/<DB>'
};
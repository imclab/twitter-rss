/*jslint node: true */
"use strict";

exports.ensureAuthenticated = function(req, res, next) {
    if (req.session &&
        req.session.oauth &&
        req.session.oauth.accessToken &&
        req.session.oauth.accessTokenSecret) {
        next();
    }
    else {
        res.redirect('/auth');
    }
};
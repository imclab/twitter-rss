/*jslint node: true */
"use strict";

exports.ensureAuthenticated = function(req, res, next) {
    if (req.session &&
        req.session.oauth &&
        req.session.oauth.access_token &&
        req.session.oauth.access_token_secret) {
        next();
    }
    else {
        res.redirect('/auth/twitter');
    }
};
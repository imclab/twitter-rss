/*jslint node: true */
"use strict";


module.exports = function (oa, timeline) {
    var async = require('async'),
        CronJob = require('cron').CronJob,
        db = require('./db'),
        User = db.User;

    return {
        init: function() {
            var job = new CronJob(
                '*/1 * * * *',
                function() {
                    var start,
                        stop;

                    start = new Date();
                    console.log("cron start " + start);

                    User.find({}, function (err, users) {
                        if (err) {
                            console.error(err);
                        }
                        if (users && users.length > 0) {
                            console.log("Users found: ", users.length);
                            async.forEachSeries(
                                users,
                                timeline.getHomeTimeline,
                                function (err2) {
                                    if (err2) {
                                        console.error(err2);
                                    }
                                    stop = new Date();
                                    console.log("cron done " + stop);
                                    console.log("duration: " + (stop-start));
                                }
                            );
                        }
                        else {
                            console.log("no users found -> stop");
                        }
                    });

                },
                function () {/* This function is executed when the job stops */},
                true /* Start the job right now */
            );
        }
    };

};



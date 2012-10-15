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
                    User.find({}, function (err, users) {
                        if (err) {
                            console.error(err);
                        }
                        if (users && users.length > 0) {
                            async.forEachSeries(
                                users,
                                timeline.getHomeTimeline,
                                function (err2) {
                                    var debug;
                                    if (err2) {
                                        console.error(err2);
                                    }
                                    stop = new Date();
                                    debug = 'cron done -> ' + stop + ' -> ';
                                    debug += users.length + ' users found -> ';
                                    debug += 'took ' + (stop-start) + 'ms';
                                    console.log(debug);
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



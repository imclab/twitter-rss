/*jslint node: true */
"use strict";

var formatTweet = exports.formatTweet = function(tweet) {
    var i, l,
        url, user, media,
        r, replaces = [],
        html, title,
        instagramRgx = /(https?:\/\/)?(instagr)(\.am|am\.com)\/p\/([\w\-_]+)\//gi,
        imageRgx = /(https?:\/\/)?((www\.)?[\w\-_\.]+\.[a-z]+\/((([\w\-_\/]+)\/)?[\w\-_\.]+\.(png|gif|jpe?g)))/gi,
        match, temp,
        imageUrl, images = [];

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
            match = instagramRgx.exec(url.expanded_url);
            if (match !== null) {
                temp.html = '<p><img src="http://instagr.am/p/'+match[2]+'/media/?size=l"></p>';
            }

            // look for linked images
            match = imageRgx.exec(url.expanded_url);
            if (match !== null) {
                imageUrl = (match[1]) ? match[1] : 'http://';
                imageUrl += match[2];
                images.push('<img src="' + imageUrl + '">');
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

    // add images underneath tweet text
    if (images.length > 0) {
        tweet.html += '<p>';
        for (i=0,l=images.length;i<l;++i) {
            tweet.html += images[i];
        }
        tweet.html += '</p>';
    }

    title.replace(/\n/g, ' ');
    tweet.title = title;

    return tweet;
};

var insertSubstring = exports.insertSubstring = function(str, start, end, s) {
    return str.slice(0, start) + s + str.slice(end);
};
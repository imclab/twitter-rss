# Tweet / Feed / Read

Read your Twitter timeline as an RSS-feed

## Dependencies

  * [node.js](https://github.com/joyent/node) (tested on v0.6.18 / v0.8.11)
  * npm
    * express v3
    * oauth
    * ejs
    * ejs-locals
    * mongoose
    * mongoose-long
    * cron
    * async
    * dateformat
    * underscore
  * [mongoDB](http://www.mongodb.org/downloads)

## Install

  1. [install node.js](https://github.com/joyent/node/wiki/Installation)
  2. [install mongoDB](http://www.mongodb.org/display/DOCS/Quickstart)
  3. clone repository `git clone https://github.com/pkyeck/tweet-feed-read.git`
  4. go into folder `cd tweet-feed-read`
  5. run `npm install` to install packages
  6. rename `config.example.js` to `config.js`
  7. insert your data into `config.js`
  8. start app `node index.js`
  9. visit `http://localhost:3000`

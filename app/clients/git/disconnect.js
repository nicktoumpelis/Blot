var fs = require("fs-extra");
var helper = require("helper");
var localPath = helper.localPath;
var Blog = require("blog");
var debug = require("debug")("client:git");

// Called when the user disconnects the client
// This may occur when the
module.exports = function disconnect (blogID, callback) {

  // TODO, this shit should be handled at the next layer up
  // we shouldn't worry about setting blog.client to ""
  Blog.get({ id: blogID }, function(err, blog) {

    if (err || !blog) {
      return callback(err || new Error("No blog"));
    }

    Blog.set(blogID, { client: "" }, function(err) {
      if (err) return callback(err);

      // Remove the bare git repo in /repos
      fs.remove(__dirname + "/data/" + blog.handle + ".git", function(err) {
        if (err) return callback(err);

        callback(null);

        // Remove the .git directory in the user's blog folder?
        // maybe don't do this... they might want it...
        // what if there was a repo in their folder beforehand?
        // fs.remove(localPath(blogID, "/.git"), function(err) {
        //   if (err) return callback(err);

        // });
      });
    });
  });
};
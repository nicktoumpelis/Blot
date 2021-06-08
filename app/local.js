var config = require("config");
var Express = require("express");
var vhost = require("vhost");
var blog = require("./blog");
var dashboard = require("./dashboard");
var cdn = require("./cdn");
const User = require("models/user");
const Blog = require("models/blog");
const child_process = require("child_process");

const NODE_VERSION = "v12.16.3";
const NPM_VERSION = "6.14.4";

// I was getting a warning message from npm when I 'cntrl-c' out 
// of the server without this.
process.on('SIGINT', () => {
    process.exit();
});

if (child_process.execSync("node -v").toString().trim() !== NODE_VERSION) {
  throw new Error(
    `Error: incorrect version of node installed. Please install and use node version: ${NODE_VERSION}`
  );
}

if (child_process.execSync("npm -v").toString().trim() !== NPM_VERSION) {
  throw new Error(
    `Error: incorrect version of npm installed. Please install and use npm version: ${NPM_VERSION}`
  );
}

if (child_process.execSync("redis-cli ping").toString().trim() !== "PONG") {
  throw new Error(
    `Error: redis server not running.  Please install and run a redis server`
  );
}

// Welcome to Blot. This is the Express application which listens on port 8080.
// NGINX listens on port 80 in front of Express app and proxies requests to
// port 8080. NGINX handles SSL termination, cached response delivery and
// compression. See ../config/nginx for more. Blot does the rest.
var Blot = Express();
const email = "example@example.com";

function establishTestUser(callback) {
  User.getByEmail(email, function (err, user) {
    if (user) return establishTestBlog(user, callback);

    User.create(email, "", {}, function (err, user) {
      if (err) return callback(err);
      establishTestBlog(user, callback);
    });
  });
}

function establishTestBlog(user, callback) {
  if (user.blogs.length > 0) return callback(null, user);

  Blog.create(user.uid, { handle: "example", forceSSL: false }, function (err) {
    if (err) return callback(err);
    callback(null, user);
  });
}

establishTestUser(function (err, user) {
  // Built and watch template directory
  require("./templates")({ watch: true }, function (err) {
    if (err) throw err;
    process.exit();
  });

  // Blot is composed of four sub applications.

  // The CDN
  // -------
  // Serves static files generated by Blot e.g.
  // thumbnails and cached images.
  Blot.use(vhost(config.host, cdn));

  Blot.use(require("dashboard/session"));

  Blot.use(function (req, res, next) {
    req.session.uid = user.uid;
    req.session.blogID = user.lastSession;
    next();
  });

  // The Dashboard
  // -------------
  // Serve the dashboard and public site (the brochure)
  // Webhooks from Dropbox and Stripe, git pushes are
  // served by these two applications. The dashboard can
  // only ever be served for request to the host
  Blot.use(vhost(config.host, dashboard));

  // The Blogs
  // ---------
  // Serves the customers's blogs. It should come first because it's the
  // most important. We don't know the hosts for all the blogs in
  // advance so all requests hit this middleware.
  blog.listen("8081");

  console.log();
  console.log(`Visit your site:`);
  console.log("http://localhost:8081");
  console.log();
  console.log(`Visit your dashboard:`);
  console.log("http://localhost:8080");
  console.log();

  Blot.listen(config.port, function () {});

  console.log('Started server successfully!')
});

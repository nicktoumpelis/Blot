var BodyParser = require("body-parser");
var Express = require("express");

var blockCrawlers = require("./blockCrawlers");
var checkToken = require("./checkToken");
var checkReset = require("./checkReset");
var checkEmail = require("./checkEmail");
var checkPassword = require("./checkPassword");
var errorHandler = require("./errorHandler");
var parse = BodyParser.urlencoded({ extended: false });
var csrf = require("csurf")();

var form = new Express.Router();

form.use(require("./rateLimit"));

// Used to give context to the user when not logged in.
// E.g. please log in to access the Services page
var DASHBOARD_PAGE_DESCRIPTION = {
  "/questions/ask": "ask a question",
  "/settings/services": "access services",
  "/settings/urls/redirects": "set up redirects",
  "/settings/services/404s": "view 404s",
  "/settings/services/permalinks": "set the link format",
  "/settings/links": "edit the links",
};

form.use(function (req, res, next) {
  // Send logged-in users to the dashboard unless we're using
  // a one-time log-in link
  if (req.session && req.session.uid && !req.query.token) {
    var then = req.query.then || (req.body && req.body.then) || "/dashboard";
    return res.redirect(then);
  }

  res.header("Cache-Control", "no-cache");
  res.locals.title = "Log in";
  res.locals.layout = "partials/layout-form";
  res.locals.from = req.query.from;
  res.locals.then = req.query.then;
  res.locals.then_description = DASHBOARD_PAGE_DESCRIPTION[req.query.then];

  return next();
});

form
  .route("/reset")

  .all(function (req, res, next) {
    next();
  })

  .get(csrf, function (req, res) {
    res.locals.csrf = req.csrfToken();
    res.locals.title = "Reset password";
    res.render("log-in/reset");
  })

  .post(parse, csrf, checkEmail, checkReset, errorHandler)

  .post(function (err, req, res, next) {
    res.locals.csrf = req.csrfToken();
    res.render("log-in/reset");
  });

form
  .route("/")

  .get(blockCrawlers, checkToken, function (req, res) {
    res.render("log-in");
  })

  .post(parse, checkEmail, checkReset, checkPassword, errorHandler)

  .post(function (err, req, res, next) {
    if (req.body && req.body.reset !== undefined)
      return res.redirect("/log-in/reset");
    res.render("log-in");
  });

module.exports = form;

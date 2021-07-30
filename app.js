var express = require("express"),
  app = express(),
  bodyParser = require("body-parser"),
  path = require("path"),
  mongoose = require("mongoose"),
  passport = require("passport"),
  LocalStrategy = require("passport-local"),
  flash = require("connect-flash"),
  expressValidator = require("express-validator"),
  passportLocalMongoose = require("passport-local-mongoose");

const nodemailer = require("nodemailer");

mongoose.connect("mongodb://localhost/rideshare", { useNewUrlParser: true });

/* Mongo Database Objects */
var userSchema = new mongoose.Schema({
  first: String,
  last: String,
  username: String,
  email: String,
  password: String,
  phone: String,
});

userSchema.plugin(passportLocalMongoose);
var User = mongoose.model("User", userSchema);

var rideSchema = new mongoose.Schema({
  driver: userSchema,
  origin: String,
  destination: String,
  price: Number,
  date: String,
  no_of_people: Number,
  vehicleregno: String,
  ridetime: String,
  passengers: [userSchema],
});

var Ride = mongoose.model("Ride", rideSchema);

// idk what these do but just use these
app.use(express.static(__dirname + "/public"));
app.use(express.static("views"));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(
  require("express-session")({
    secret: "Secret",
    resave: false,
    saveUninitialized: false,
  })
);

app.use(
  expressValidator({
    errorFormatter: function (param, msg, value) {
      var namespace = param.split("."),
        root = namespace.shift(),
        formParam = root;

      while (namespace.length) {
        formParam += "[" + namespace.shift() + "]";
      }
      return {
        param: formParam,
        msg: msg,
        value: value,
      };
    },
  })
);

app.use(passport.initialize());
app.use(passport.session());
app.set("view engine", "ejs");
app.use(flash());
app.use(function (req, res, next) {
  res.locals.messages = require("express-messages")(req, res);
  next();
});
passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

/* ~~~~~~~~~~~~~~~~~~~~~~~~~ ROUTES ~~~~~~~~~~~~~~~~~~~~~~ */
// RENDER THE LANDING PAGE
app.get("/", isLoggedInLanding, function (req, res) {
  res.render("landing");
});

// INDEX - show all rides
app.get("/rides", isLoggedIn, function (req, res) {
  Ride.find({}, function (err, allRides) {
    if (err) {
      console.log(err);
    } else {
      res.render("index", { rides: allRides, user: req.user });
    }
  });
});

// NEW - show form for new ride
app.get("/rides/new", isLoggedIn, function (req, res) {
  res.render("new");
});

// FIND
app.get("/rides/find", isLoggedIn, function (req, res) {
  res.render("find");
});

var foundRide = null;

app.post("/rides/find", isLoggedIn, function (req, res) {
  var origin = req.body.origin.split(",")[0];
  var destination = req.body.destination.split(",")[0];
  var date = req.body.date;

  Ride.find(
    { origin: origin, destination: destination, date: date },
    (err, foundRide) => {
      res.render("results", { rides: foundRide, user: req.user });
    }
  );
});

app.get("/results", isLoggedIn, function (req, res) {
  Ride.find({}, function (err, allRides) {
    if (err) {
      console.log(err);
    } else {
      res.render("results", {
        rides: allRides,
        ride: foundRide,
        user: req.user,
      });
    }
  });
});

// CREATE - puts new ride into database
app.post("/rides", function (req, res) {
  // get data from form and add to rides array
  var driver = req.user;
  var origin = req.body.origin.split(",")[0];
  var destination = req.body.destination.split(",")[0];
  var price = req.body.price;
  var date = req.body.date;
  var nopeople = req.body.nopeople;
  var vehicleregno = req.body.vehicleregno;
  var ridetime = req.body.ridetime;
  var newRide = {
    driver: driver,
    origin: origin,
    destination: destination,
    price: price,
    date: date,
    no_of_people: nopeople,
    vehicleregno: vehicleregno,
    ridetime: ridetime,
  };
  Ride.create(newRide, function (err, newlyCreated) {
    if (err) {
      console.log(err);
    } else {
      res.redirect("/confirm");
    }
  });
});

// SHOW - shows detail for one ride
app.get("/rides/:id", isLoggedIn, function (req, res) {
  Ride.findById(req.params.id, function (err, foundRide) {
    if (err) {
      console.log(err);
    } else {
      var status;
      console.log("run");
      console.log(foundRide + " Hello ");
      console.log(foundRide.passengers);
      if (foundRide.passengers.length == 0) {
        status = true;
      }
      foundRide.passengers.forEach(function (passenger) {
        if (passenger.username == req.user.username) {
          status = false;
          console.log(status);
        } else {
          status = true;
          console.log(status);
        }
      });
      res.render("show", { ride: foundRide, user: req.user, status: status });
    }
  });
});

// AUTH ROUTES - REGISTER
app.get("/register", function (req, res) {
  res.render("register");
});

app.post("/register", function (req, res) {
  var first = req.body.first;
  var last = req.body.last;
  var username = req.body.username;
  var password = req.body.password;
  var phone = req.body.phone;
  var email = req.body.email;
  req.checkBody("first", "first name field is required").notEmpty();
  req.checkBody("last", "first name field is required").notEmpty();
  req.checkBody("email", "Email field is required").notEmpty();
  req.checkBody("email", "Email is not valid").isEmail();
  req.checkBody("username", "Username field is required").notEmpty();
  req.checkBody("password", "Password field is required").notEmpty();
  req.checkBody("phone", "Phone field is required").notEmpty();
  var errors = req.validationErrors();
  if (errors) {
    res.render("register", {
      errors: errors,
    });
  } else {
    User.register(
      new User({
        first: first,
        last: last,
        username: username,
        phone: phone,
        email: email,
      }),
      password,
      function (err, user) {
        if (err) {
          console.log(err);
          console.log(err.message);
          res.render("register", {
            errors: err.message,
          });
        }
        passport.authenticate("local")(req, res, function () {
          res.redirect("/rides");
        });
      }
    );
  }
});

// AUTH ROUTES - SIGN IN
app.get("/login", function (req, res) {
  res.render("login");
});

//middleware inbetween request and callback
app.post(
  "/login",
  passport.authenticate("local", {
    failureRedirect: "/login",
    successRedirect: "/rides",
    failureFlash: "Invalid username or password",
  }),
  function (req, res) {}
);

// AUTH ROUTES - LOGOUT
app.get("/logout", function (req, res) {
  req.logout();
  res.redirect("/");
});

app.get("/profile", isLoggedIn, function (req, res) {
  Ride.find({}, function (err, allRides) {
    if (err) {
      console.log(err);
    } else {
      res.render("profile", { rides: allRides, user: req.user });
    }
  });
});

app.post("/rides/addpassenger", isLoggedIn, function (req, res) {
  Ride.update(
    { _id: req.body.id },
    { $push: { passengers: req.user } },
    function (err, result) {
      if (err) {
        console.log(err);
      }
      Ride.update({ $inc: { no_of_people: -1 } }, (error, res) => {
        if (error) {
          console.log(error + " updating no of people");
        } else {
          Ride.findById({ _id: req.body.id }, (err, rides) => {
            var to = rides.driver.email;
            var message =
              "I'm interested in your ride. My contact details are :";
            message += " My name  :" + req.user.first + req.user.last + ". ";
            message += "My Phone number is :" + req.user.phone + ". ";
            message += "My email address is :" + req.user.email;
            //console.log(message);
            var transporter = nodemailer.createTransport(
              {
                service: "gmail",
                auth: {
                  user: "YOUR_GMAIL_EMAIL_ID",
                  pass: "YOUR_GMAIL_PASSWORD",
                },
              },
              {
                // default values for sendMail method
                from: "YOUR_GMAIL_EMAIL_ID",
                headers: {
                  "My-Awesome-Header": "123",
                },
              }
            );
            transporter.sendMail(
              {
                to: to,
                subject: "Passenger has booked for the ride",
                text: message,
              },
              (err1, info) => {
                console.log("Email sent successfully");
              }
            );
          });
        }
      });
      //     console.log(result);
    }
  );
});

app.post("/rides/deleteRide", function (req, res) {
  Ride.findOneAndRemove({ _id: req.body.id }, function (error, doc, result) {
    if (!error) {
      Ride.find({}, function (err, allRides) {
        if (err) {
          console.log(err);
        } else {
          res.render("index", { rides: allRides, user: req.user });
        }
      });
    } else {
      console.log(error);
    }
    //console.log(doc)
    // console.log(doc.origin)
    // console.log(doc.passengers)

    doc.passengers.forEach(function (passenger) {
      console.log(passenger.email + "passenger");
      var to = passenger.email;
      var message =
        "I've cancelled Ride due to some reasons. Sorry for your inconvenience.";
      //console.log(message);
      var transporter = nodemailer.createTransport(
        {
          service: "gmail",
          auth: {
            user: "ritesh.dange72@gmail.com",
            pass: "9324551818",
          },
        },
        {
          // default values for sendMail method
          from: "ritesh.dange72@gmail.com",
          headers: {
            "My-Awesome-Header": "123",
          },
        }
      );
      transporter.sendMail(
        {
          to: to,
          subject: "Driver has cancelled the ride",
          text: message,
        },
        (err1, info) => {
          console.log("Email sent successfully" + " for cancelling");
        }
      );
    });
  });
});

app.get("/confirm", function (req, res) {
  res.render("confirm");
});

// ERROR PAGE
app.get("*", function (req, res) {
  res.send("IT SEEMS LIKE YOU LANDED IN THE WRONG PAGE!");
});

function isLoggedIn(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.redirect("/login");
}

function isLoggedInLanding(req, res, next) {
  if (req.isAuthenticated()) {
    res.redirect("/rides");
  } else {
    return next();
  }
}

app.listen(8000, function () {
  console.log("The Rideshare server has started!");
});

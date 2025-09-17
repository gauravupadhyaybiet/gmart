require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const path = require("path");
const methodOverride = require("method-override");
const ejsMate = require("ejs-mate");
const session = require("express-session");
const flash = require("connect-flash");
const passport = require("passport");
const LocalStrategy = require("passport-local");
const MongoStore = require("connect-mongo");
const Razorpay = require("razorpay");
const crypto = require("crypto");
const serverless = require("serverless-http");

// Models
const Product = require("./models/product.js");
const Category = require("./models/category.js");
const Cart = require("./models/cart.js");
const Review = require("./models/review.js");
const User = require("./models/user.js");

// Utils
const WrapAsync = require("./utils/wrapasync.js");
const ExpressError = require("./utils/expresserror.js");
const { productschema } = require("./schema.js");

// --- Database Connection ---
mongoose
  .connect(process.env.MONGO_DB)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch((err) => console.log("❌ MongoDB Error:", err));

const app = express();

// --- Views & Middleware ---
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");
app.engine("ejs", ejsMate);

app.use(express.static(path.join(__dirname, "public")));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride("_method"));

// --- Session & Flash ---
const store = MongoStore.create({
  mongoUrl: process.env.MONGO_DB,
  crypto: { secret: "mysupersecretcode" },
  touchAfter: 24 * 3600,
});

store.on("error", (err) => console.log("SESSION STORE ERROR:", err));

const sessionOptions = {
  store,
  secret: "mysupersecretcode",
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 24 * 7,
  },
};
app.use(session(sessionOptions));
app.use(flash());

// --- Passport Setup ---
app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

// --- Locals Middleware ---
app.use((req, res, next) => {
  res.locals.success = req.flash("success");
  res.locals.error = req.flash("error");
  res.locals.curruser = req.user;
  next();
});

// --- Middlewares ---
const isLoggedIn = (req, res, next) => {
  if (!req.isAuthenticated()) {
    req.session.redirecturl = req.originalUrl;
    req.flash("error", "You must be logged in first!");
    return res.redirect("/login");
  }
  next();
};

const saveUrl = (req, res, next) => {
  if (req.session.redirecturl) {
    res.locals.redirecturl = req.session.redirecturl;
  }
  next();
};

const isOwner = async (req, res, next) => {
  let { id } = req.params;
  let product = await Product.findById(id);
  if (!product.owner._id.equals(res.locals.curruser._id)) {
    req.flash("error", "You are not the owner of this product");
    return res.redirect(`/product/${product._id}/show`);
  }
  next();
};

const reviewAuthor = async (req, res, next) => {
  let { id, reviewid } = req.params;
  let review = await Review.findById(reviewid);
  if (!review.author.equals(res.locals.curruser._id)) {
    req.flash("error", "You are not the author of this review");
    return res.redirect(`/product/${id}/show`);
  }
  next();
};

const validateProduct = (req, res, next) => {
  try {
    let productData = req.body.product || req.body || {};

    // Normalize checkbox values
    productData.isFlashSale =
      productData.isFlashSale === "true" || productData.isFlashSale === "on";
    productData.isTrending =
      productData.isTrending === "true" || productData.isTrending === "on";

    // Convert numeric strings → numbers
    ["discount", "amount", "stock"].forEach((field) => {
      if (productData[field] !== undefined && productData[field] !== "")
        productData[field] = parseInt(productData[field]);
    });

    let { error } = productschema.validate(productData);
    if (error) {
      let errmsg = error.details.map((el) => el.message).join(",");
      throw new ExpressError(400, errmsg);
    } else {
      req.body.product = productData;
      next();
    }
  } catch (err) {
    next(err);
  }
};

// --- Routes ---
app.get("/", (req, res) => res.redirect("/allproducts"));

app.get("/allproducts", WrapAsync(async (req, res) => {
  let showproducts = await Product.find();
  res.render("allproduct.ejs", { showproducts });
}));

app.get("/products/:category", WrapAsync(async (req, res) => {
  const category = req.params.category;
  const products = await Product.find({ category });
  res.render("product.ejs", { products, category });
}));

app.get("/categories", WrapAsync(async (req, res) => {
  const categories = await Product.distinct("category");
  res.render("category.ejs", { categories });
}));

app.get("/addproduct", isLoggedIn, (req, res) => res.render("new.ejs"));

app.post("/addproduct", isLoggedIn, validateProduct, WrapAsync(async (req, res) => {
  const newproduct = new Product({ ...req.body.product, owner: req.user._id });
  await newproduct.save();
  req.flash("success", "New product created successfully");
  res.redirect("/allproducts");
}));

app.get("/product/:id/show", WrapAsync(async (req, res) => {
  let { id } = req.params;
  let showproduct = await Product.findById(id)
    .populate({ path: "reviews", populate: { path: "author" } })
    .populate("owner");
  if (!showproduct) {
    req.flash("error", "Product does not exist");
    return res.redirect("/allproducts");
  }
  res.render("show.ejs", { showproduct });
}));

app.get("/product/:id/edit", isLoggedIn, isOwner, WrapAsync(async (req, res) => {
  let { id } = req.params;
  let product = await Product.findById(id);
  res.render("edit.ejs", { product });
}));

app.post("/product/:id", isLoggedIn, isOwner, validateProduct, WrapAsync(async (req, res) => {
  let { id } = req.params;
  const updateproduct = await Product.findByIdAndUpdate(id, { ...req.body.product }, { runValidators: true, new: true });
  req.flash("success", "Product updated successfully");
  res.redirect(`/products/${updateproduct.category}`);
}));

app.delete("/deleteproduct/:id", isLoggedIn, isOwner, WrapAsync(async (req, res) => {
  let { id } = req.params;
  await Product.findByIdAndDelete(id);
  req.flash("success", "Product deleted");
  res.redirect("/allproducts");
}));

// --- Reviews ---
app.post("/product/:id/reviews", isLoggedIn, WrapAsync(async (req, res) => {
  let product = await Product.findById(req.params.id);
  let newreview = new Review(req.body.review);
  newreview.author = req.user._id;
  product.reviews.push(newreview);
  await newreview.save();
  await product.save();
  req.flash("success", "New review added");
  res.redirect(`/product/${product._id}/show`);
}));

app.delete("/product/:id/reviews/:reviewid", isLoggedIn, reviewAuthor, WrapAsync(async (req, res) => {
  let { id, reviewid } = req.params;
  await Product.findByIdAndUpdate(id, { $pull: { reviews: reviewid } });
  await Review.findByIdAndDelete(reviewid);
  req.flash("success", "Review deleted");
  res.redirect(`/product/${id}/show`);
}));

// --- Cart ---
app.post("/cart/add", WrapAsync(async (req, res) => {
  const { productId, quantity } = req.body;
  const existingCartItem = await Cart.findOne({ productId });
  if (existingCartItem) {
    existingCartItem.quantity += parseInt(quantity);
    await existingCartItem.save();
  } else {
    const newCartItem = new Cart({ productId, quantity });
    await newCartItem.save();
  }
  res.redirect("/cart");
}));

app.get("/cart", WrapAsync(async (req, res) => {
  const cartItems = await Cart.find().populate("productId");
  res.render("cart.ejs", { cartItems });
}));

app.delete("/cart/:id/delete", WrapAsync(async (req, res) => {
  let { id } = req.params;
  await Cart.findByIdAndDelete(id);
  res.redirect("/cart");
}));

// --- Razorpay ---
const razorpayinstance = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || "rzp_test_tf9CPdWCcLlH39",
  key_secret: process.env.RAZORPAY_KEY_SECRET || "2B6vzx4mF5JvHtATIv3xpGgA",
});

app.post("/order", async (req, res) => {
  try {
    const { amount } = req.body;
    const order = await razorpayinstance.orders.create({
      amount: amount * 100,
      currency: "INR",
      receipt: "receipt#1",
    });
    res.json(order);
  } catch (err) {
    res.status(500).send("Error creating order");
  }
});

app.post("/verifypayment", (req, res) => {
  const { order_id, payment_id, signature } = req.body;
  const secret = process.env.RAZORPAY_KEY_SECRET || "2B6vzx4mF5JvHtATIv3xpGgA";
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(order_id + "|" + payment_id);
  const generatedsignature = hmac.digest("hex");
  if (generatedsignature === signature) {
    res.send("Payment verified successfully");
  } else {
    res.status(400).send("Payment verification failed");
  }
});

// --- Auth ---
app.get("/signup", (req, res) => res.render("signup.ejs"));
app.post("/signup", WrapAsync(async (req, res, next) => {
  try {
    let { username, email, password } = req.body;
    let newuser = new User({ username, email });
    let registereduser = await User.register(newuser, password);
    req.login(registereduser, (err) => {
      if (err) return next(err);
      req.flash("success", "Welcome to G-Mart!");
      res.redirect("/allproducts");
    });
  } catch (e) {
    req.flash("error", e.message);
    res.redirect("/signup");
  }
}));

app.get("/login", (req, res) => res.render("login.ejs"));
app.post("/login", saveUrl, passport.authenticate("local", { failureRedirect: "/login", failureFlash: true }), (req, res) => {
  req.flash("success", "Welcome back to G-Mart!");
  const redirectUrl = res.locals.redirecturl || "/allproducts";
  res.redirect(redirectUrl);
});

app.get("/logout", (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err);
    req.flash("success", "You have been logged out");
    res.redirect("/allproducts");
  });
});

// --- Error Handling ---
app.all("*", (req, res, next) => next(new ExpressError(404, "Page not found")));
app.use((err, req, res, next) => {
  let { statuscode = 500, message = "Something went wrong" } = err;
  res.status(statuscode).render("error.ejs", { err });
});

// --- Run locally OR serverless ---
if (process.env.NODE_ENV !== "production") {
  app.listen(8080, () => console.log("✅ Server running on http://localhost:8080"));
}

module.exports = app;
module.exports.handler = serverless(app);


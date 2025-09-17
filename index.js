require('dotenv').config();

const express = require("express");
const app = express();
const mongoose = require("mongoose");

const path = require("path");
const Product = require("./models/product.js");
const Category = require("./models/category.js");
const Cart = require("./models/cart.js");
const methodOverride = require('method-override');
const review = require("./models/review.js");
const ejsMate = require("ejs-mate");
const session = require('express-session');
const flash = require('connect-flash');
const passport = require("passport");
const localstartegy = require("passport-local");
const User = require("./models/user.js");
const WrapAsync = require("./utils/wrapasync.js");
const ExpressError = require("./utils/expresserror.js");
const { productschema } = require("./schema.js");

const Razorpay = require("razorpay");
const crypto = require("crypto");
const product = require("./models/product.js");
const MongoStore = require("connect-mongo");




main()
  .then(() => {
    console.log("connection successful");
  })
  .catch((err) => console.log(err));

async function main() {
  await mongoose.connect(process.env.MONGO_DB);
}

app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");

app.use(express.static(path.join(__dirname, "public")));
app.use(express.urlencoded({ extended: true }));
app.use(methodOverride('_method'));
app.use(express.json());
app.engine('ejs', ejsMate);
const store = MongoStore.create({
  mongoUrl:  process.env.MONGO_DB,
  crypto: {
    secret: "mysupersecretcode"  // encrypt session data
  },
  touchAfter: 24 * 3600, // lazy update: only once per day if unchanged
});

store.on("error", (err) => {
  console.log("SESSION STORE ERROR", err);
});
const sessionOptions = {
  store,
  secret: "mysupersecretcode",
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,                // prevents client-side JS from accessing cookies
    maxAge: 1000 * 60 * 60 * 24 * 7 // 1 week
  },
};
app.use(session(sessionOptions));
app.use(flash());
app.use(passport.initialize());
app.use(passport.session());
// use static authenticate method of model in LocalStrategy
passport.use(new localstartegy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());
// Pass categories to the template


app.use((req, res, next) => {
  res.locals.success = req.flash("success");
  res.locals.error = req.flash('error');
  res.locals.curruser = req.user;
  next();
});
const isloggedin = (req, res, next) => {
  if (!req.isAuthenticated()) {
    req.session.redirecturl = req.originalUrl;
    req.flash("error", "you are not logged in");
    return res.redirect("/login");
  }
  next();

}
const saveurl = (req, res, next) => {
  if (req.session.redirecturl) {
    res.locals.redirecturl = req.session.redirecturl;
  }
  next();

}
const isowner = async (req, res, next) => {
  let { id } = req.params;
  let product = await Product.findById(id);
  if (!product.owner._id.equals(res.locals.curruser._id)) {
    req.flash("error", "you are not the owner of this product");
    return res.redirect(`/product/${product._id}/show`);


  }
  next();
}
const reviewauthor = async (req, res, next) => {
  let { id, reviewid } = req.params;
  let Review = await review.findById(reviewid);
  if (!Review.author.equals(res.locals.curruser._id)) {
    req.flash("error", "you are not the author of this review");
    return res.redirect(`/product/${id}/show`);


  }
  next();
}
const validateproduct = (req, res, next) => {
  try {
    // Handle both add (req.body) and update (req.body.product)
    let productData = req.body.product || req.body || {};

    // Normalize checkbox values
    productData.isFlashSale =
      productData.isFlashSale === "true" || productData.isFlashSale === "on";
    productData.isTrending =
      productData.isTrending === "true" || productData.isTrending === "on";
  
    // Convert numeric strings → numbers
    if (productData.discount !== undefined && productData.discount !== "")
      productData.discount = parseInt(productData.discount);

    if (productData.amount !== undefined && productData.amount !== "")
      productData.amount = parseInt(productData.amount);

    if (productData.stock !== undefined && productData.stock !== "")
      productData.stock = parseInt(productData.stock);

    // Joi validation
    let { error } = productschema.validate(productData);
    if (error) {
      let errmsg = error.details.map((el) => el.message).join(",");
      throw new ExpressError(400, errmsg);
    } else {
      // Always normalize to req.body.product
      req.body.product = productData;
      next();
    }
  } catch (err) {
    next(err);
  }
};




module.exports = validateproduct;
app.get("/allproducts", WrapAsync(async (req, res) => {

  let showproducts = await Product.find();
  console.log(showproducts);
  res.render("allproduct.ejs", { showproducts });

}));

/*app.get("/demouser",async(req,res)=>{
  let newuser = new User({
    email:"upadhyayrahul572@gmail.com",
    username:"rahul upadhyay"
  });
  let registereduser = await User.register(newuser,"newworld");
  console.log(registereduser);
  res.send(registereduser);
});*/



app.get('/products/:category', WrapAsync(async (req, res) => {
  const category = req.params.category;
  try {
    const products = await Product.find({ category: category });
    res.render('product.ejs', { products, category });
  } catch (error) {
    res.status(500).send('Error retrieving products');
  }
}));


// Route to display all categories (optional)
app.get('/categories', WrapAsync(async (req, res) => {
  try {
    const categories = await Product.distinct('category');
    console.log(req);
    res.render('category.ejs', { categories });
  } catch (error) {
    res.status(500).send('Error retrieving categories');
  }
}));



app.get("/addproduct", isloggedin, (req, res) => {
  res.render("new.ejs");
});

app.post(
  "/addproduct",
  isloggedin,
  validateproduct,
  WrapAsync(async (req, res) => {
    const newproduct = new Product({
      ...req.body.product,
      owner: req.user._id,
    });

    await newproduct.save();
    req.flash("success", "New product created successfully");
    res.redirect("/allproducts");
  })
);



app.get("/product/:id/show", WrapAsync(async (req, res) => {
  let { id } = req.params;
  let showproduct = await Product.findById(id).populate({
    path: "reviews", populate: {
      path: "author"
    }
  }).populate("owner");
  if (!showproduct) {
    req.flash("error", "product does not exist");
    res.redirect("/allproducts");
  }
  console.log(showproduct);
  res.render("show.ejs", { showproduct });
}));

app.get("/product/:id/edit", isloggedin, isowner, WrapAsync(async (req, res) => {
  let { id } = req.params;
  let product = await Product.findById(id);
  res.render("edit.ejs", { product });
}));

app.post(
  "/product/:id",
  isloggedin,
  isowner,
  validateproduct,
  WrapAsync(async (req, res) => {
    let { id } = req.params;

    const updateproduct = await Product.findByIdAndUpdate(
      id,
      { ...req.body.product },
      { runValidators: true, new: true }
    );

    req.flash("success", "Product has been updated successfully");
    res.redirect(`/products/${updateproduct.category}`);
  })
);



app.delete("/deleteproduct/:id", isloggedin, isowner, WrapAsync(async (req, res) => {
  let { id } = req.params;
  const deleteproduct = await Product.findByIdAndDelete(id);
  if (!deleteproduct) {
    req.flash("error", "Product not found");
    return res.redirect("/allproducts");
  }
  console.log(deleteproduct);
  req.flash("success", " product has deleted ");
  res.redirect("/allproducts");
}));
app.post("/product/:id/reviews", isloggedin, WrapAsync(async (req, res) => {
  let product = await Product.findById(req.params.id);
  let newreview = new review(req.body.review);
  newreview.author = req.user._id;

  product.reviews.push(newreview);
  console.log(newreview);
  await newreview.save();
  await product.save();
  console.log(newreview);
  req.flash("success", "new review had created");
  res.redirect(`/product/${product._id}/show`);



}));
app.delete("/product/:id/reviews/:reviewid", isloggedin, reviewauthor, WrapAsync(async (req, res) => {
  let { id, reviewid } = req.params;
  let product = await Product.findByIdAndUpdate(id, { $pull: { reviews: reviewid } });
  await review.findByIdAndDelete(reviewid);
  req.flash("success", "review had deleted");
  res.redirect(`/product/${product._id}/show`);
}));
// Route to add a product to the cart
app.post('/cart/add', async (req, res) => {
  const { productId, quantity } = req.body;

  // Check if the product already exists in the cart
  const existingCartItem = await Cart.findOne({ productId });

  if (existingCartItem) {
    // If it exists, update the quantity
    existingCartItem.quantity += parseInt(quantity);
    await existingCartItem.save();
  } else {
    // If it doesn't exist, create a new cart item
    const newCartItem = new Cart({ productId, quantity });
    await newCartItem.save();
  }

  res.redirect('/cart'); // Redirect to the cart page or wherever you want
});
app.get('/cart', async (req, res) => {
  try {
    const cartItems = await Cart.find().populate('productId');
    res.render('cart.ejs', { cartItems });
  } catch (error) {
    res.status(500).send('Error retrieving cart items');
  }
});
app.delete("/cart/:id/delete", async (req, res) => {
  let { id } = req.params;
  await Cart.findByIdAndDelete(id);
  res.redirect("/cart");

});
const createrazorpayinstace = () => {
  return new Razorpay({
    key_id: "rzp_test_tf9CPdWCcLlH39",
    key_secret: "2B6vzx4mF5JvHtATIv3xpGgA"

  });


}
const razorpayinstance = createrazorpayinstace();

app.post("/order", async (req, res) => {
  let { amount } = req.body;
  const options = {
    amount: amount * 100,
    currency: "INR",
    receipt: "receipt#1",

  };
  try {
    const order = await razorpayinstance.orders.create(options);
    res.json(order);
  } catch (error) {
    res.status(500).send('Error creating order');
  }



});
app.post("/verifypayment", (req, res) => {
  const { order_id, payment_id, signature } = req.body;
  const secret = "2B6vzx4mF5JvHtATIv3xpGgA";
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(order_id + "|" + payment_id);
  const generatedsignature = hmac.digest("hex");
  if (generatedsignature === signature) {
    res.send('Payment verified successfully');
  } else {
    res.status(400).send('Payment verification failed');
  }

});
app.get("/signup", (req, res) => {
  res.render("signup.ejs");
});
app.post("/signup", async (req, res) => {
  try {
    let { username, email, password } = req.body;
    let newuser = new User({ username, email });
    let registereduser = await User.register(newuser, password);
    req.login(registereduser, (err) => {
      if (err) {
        return next(err)
      }
      req.flash("success", "welcome to my website");
      res.redirect("/allproducts");
    });

  } catch (e) {

    req.flash("error", e.message);

    res.redirect("/signup");

  }

});
app.get("/login", (req, res) => {
  res.render("login.ejs");
});
app.post("/login", saveurl, passport.authenticate('local', { failureRedirect: "/login", failureFlash: true }), (req, res) => {
  req.flash("success", "welcome to g-mart");
  const redirectUrl = res.locals.redirecturl || "/allproducts";

  res.redirect(redirectUrl);

});
app.get("/logout", (req, res) => {
  req.logout((err) => {
    if (err) {
      return next(err);
    }
    req.flash("success", "you have been logged out");
    res.redirect("/allproducts");
  })
});

app.all("*", (req, res, next) => {
  next(new ExpressError(404, "page not found!"));
});
app.use((err, req, res, next) => {
  let { statuscode = 500, message = "something went wrong" } = err;
  res.status(statuscode).render("error.ejs", { err });

})





// Cart Management Routes

// Route to add a product to the cart


app.listen(8080, (req, res) => {
  console.log("server is running");
});

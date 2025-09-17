function validateproduct(req, res, next) {
  const { name, category, amount, description, stock, image, season } = req.body;

  if (!name || !category || !amount || !description || !stock || !image) {
    req.flash("error", "All required fields (name, category, amount, description, stock, image) must be filled");
    return res.redirect("back");
  }

  // Optional: check if amount/stock are valid numbers
  if (isNaN(amount) || amount < 0) {
    req.flash("error", "Amount must be a valid positive number");
    return res.redirect("back");
  }
  if (isNaN(stock) || stock < 0) {
    req.flash("error", "Stock must be a valid positive number");
    return res.redirect("back");
  }

  // Season is optional, so no need to force it
  next();
}

module.exports = validateproduct;


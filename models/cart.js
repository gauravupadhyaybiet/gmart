const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const review = require("./review.js");

const cartSchema = new Schema({
  productId: {
    type: Schema.Types.ObjectId,
    ref: "Product",
    required: true,
  },
  quantity: {
    type: Number,
    required: true,
    default: 1,
  },
});
cartSchema.post("findOneAndDelete",async(product)=>{
    if(product){
        await review.deleteMany({_id:{$in:product.reviews}})
    }
});

const Cart = mongoose.model("Cart", cartSchema);
module.exports = Cart;

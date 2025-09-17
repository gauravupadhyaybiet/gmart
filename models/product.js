const mongoose = require('mongoose');
const review = require("./review.js");

// Define the Product schema
const ProductSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    category: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true,
        trim: true
    },
    amount: {
        type: Number,
        required: true,
        min: 0
    },
    stock: {
        type: Number,
        required: true,
        min: 0
    },
    image: {
        type: String,
        required: true
    },
    reviews: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "review"
    }],
    owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    },
    // New fields for enhanced features
    isFlashSale: {
        type: Boolean,
        default: false
    },
    discount: {
        type: Number,
        default: 0,
        min: 0,
        max: 100
    },
    salePrice: {
        type: Number,
        min: 0
    },
    isTrending: {
        type: Boolean,
        default: false
    },
    season: {
        type: String,
        enum: ['spring', 'summer', 'fall', 'winter', null],
        default: null
    },

}, {
    timestamps: true
});

// Virtual for calculating sale price
ProductSchema.virtual('calculatedSalePrice').get(function() {
    if (this.isFlashSale && this.discount > 0) {
        return this.amount * (1 - this.discount / 100);
    }
    return this.amount;
});

// Method to increment view count
ProductSchema.methods.incrementViews = async function() {
    this.views += 1;
    return this.save();
};

// Pre-save middleware to calculate sale price
ProductSchema.pre('save', function(next) {
    if (this.isFlashSale && this.discount > 0) {
        this.salePrice = this.amount * (1 - this.discount / 100);
    }
    next();
});

ProductSchema.post("findOneAndDelete", async(product) => {
    if(product) {
        await review.deleteMany({_id: {$in: product.reviews}});
    }
});

// Export the Product model
module.exports = mongoose.model('Product', ProductSchema);
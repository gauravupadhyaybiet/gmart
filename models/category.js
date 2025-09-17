const mongoose = require("mongoose");

const CategorySchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    slug: {
        type: String,
        required: true,
        unique: true,
        lowercase: true
    },
    description: {
        type: String,
        trim: true
    },
    image: {
        type: String,
        required: true
    },
    icon: {
        type: String
    },
    season: {
        type: String,
        enum: ['spring', 'summer', 'fall', 'winter', null],
        default: null
    },
    isFeatured: {
        type: Boolean,
        default: false
    },
    parent: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category',
        default: null
    },
    order: {
        type: Number,
        default: 0
    },
    metadata: {
        type: Map,
        of: String
    }
}, {
    timestamps: true
});

// Create slug from name
CategorySchema.pre('save', function(next) {
    if (this.isModified('name')) {
        this.slug = this.name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)/g, '');
    }
    next();
});

// Virtual for subcategories
CategorySchema.virtual('subcategories', {
    ref: 'Category',
    localField: '_id',
    foreignField: 'parent'
});

// Method to get all products in this category and subcategories
CategorySchema.methods.getAllProducts = async function() {
    const subcategories = await this.model('Category').find({ parent: this._id });
    const subcategoryIds = subcategories.map(sub => sub._id);
    
    return this.model('Product').find({
        $or: [
            { category: this._id },
            { category: { $in: subcategoryIds } }
        ]
    });
};

module.exports = mongoose.model("Category", CategorySchema);
const Joi = require('joi');



const productschema = Joi.object({
    name: Joi.string().required(),
    category: Joi.string().required(),
    amount: Joi.number().required().min(0),
    description: Joi.string().required(),
    stock: Joi.number().required().min(0),
    image: Joi.string().required(),
    isFlashSale: Joi.boolean(),
    discount: Joi.number().min(0).max(100),
    isTrending: Joi.boolean(),
    season: Joi.string().valid('spring', 'summer', 'fall', 'winter', ''),
 
});

module.exports = { productschema };

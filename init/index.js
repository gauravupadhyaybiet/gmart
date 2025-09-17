const mongoose = require("mongoose");
const initdata = require("./init.js");
//const categorydata= require("./categorydata.js");
const product = require("../models/product.js");
//const category = require("../models/category.js");

main()
  .then(() => {
    console.log("connection successful");

  })
  .catch((err)=>console.log(err));
  

async function main(){ 
     await mongoose.connect('mongodb://127.0.0.1:27017/G-mart');
      

}
const initdb = async () =>{
    await product.deleteMany({});
    initdata.data2 = initdata.data2.map((obj)=>({...obj,owner:"67acb5ed88c1940b99553c57"}));

    
    

    await product.insertMany(initdata.data2);
    console.log("data has saved");
};
initdb();
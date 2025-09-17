//const Category = require("../models/category");

const sampleproduct = [
    {
        name: "Wireless Bluetooth Headphones",
        category:"Electronics",
        description: "High-quality wireless headphones with noise cancellation and long battery life.",
        amount: 89,
        
        stock: 150,
        image: "https://example.com/images/headphones.jpg",
        
    },
    {
        name: "Smartphone XYZ",
        category:"Electronics",
        description: "Latest model smartphone with a 6.5-inch display, 128GB storage, and 48MP camera.",
        amount: 699,
        
        stock: 75,
        image: "https://example.com/images/smartphone.jpg",
        

    },
    {
        name: "Gaming Laptop",
        category:"Computers",
        

        description: "Powerful gaming laptop with Intel i7 processor, 16GB RAM, and NVIDIA GTX 1660 graphics.",
        amount: 1299.99,
        
        stock: 30,
        image: "https://example.com/images/gaming-laptop.jpg",
        
    },

  
    {
        name: "Bluetooth Speaker",
        category:"Appliances",
        description: "Portable Bluetooth speaker with 360-degree sound and waterproof design.",
        amount: 49,
        
        
        stock: 100,
        image: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MTB8fG1vdW50YWlufGVufDB8fDB8fHww&auto=format&fit=crop&w=800&q=60",
    

    },
]

module.exports = { data2:sampleproduct };
var mongoose = require('mongoose');

mongoose.Promise = global.Promise;
//mongoose.connect('mongodb://localhost:27017/Todo-app');
//mongoose.connect('mongodb://heroku_70lkgw6f:krrk07v27ehdth4nu61gngosmp@ds151289.mlab.com:51289/heroku_70lkgw6f');

mongoose.connect(process.env.MONGODB_URI);

module.exports={mongoose};
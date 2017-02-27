const {ObjectID} = require("mongodb");
const jwt = require('jsonwebtoken');
const {User} = require('./../../model/user');

var testUsers = [
    { _id: new ObjectID(),verified: false, email: 'first@first.com', password: 'asd123' },
    { _id: new ObjectID(),verified: false, email: 'second@first.com', password: 'asd123' },
    { _id: new ObjectID(),verified: true, email: 'third@first.com', password: 'asd123' }];

const populateUsers = (done) => {
  User.remove({}).then(() => {
    var userOne = new User(testUsers[0]).save();
    var userTwo = new User(testUsers[1]).save();
    var userThree = new User(testUsers[2]).save();

    return Promise.all([userOne, userTwo,userThree])
  }).then(() => done());
};

module.exports = {
    populateUsers,testUsers
}
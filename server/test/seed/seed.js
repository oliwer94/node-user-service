const {ObjectID} = require("mongodb");
const jwt = require('jsonwebtoken');
const {User} = require('./../../model/user');

var testUsers = [
    { _id: new ObjectID(),verified: false, email: 'first@first.com', password: 'asd123', 'tokens': [{ access: 'auth', token: '' }] },
    { _id: new ObjectID(),verified: false, email: 'second@first.com', password: 'asd123', 'tokens': [{ access: 'auth', token: '' }] },
    { _id: new ObjectID(),verified: true, email: 'third@first.com', password: 'asd123', 'tokens': [{ access: 'auth', token: '' }] }];

console.log( process.env.JWT_SECRET);
testUsers[0].tokens[0].token = jwt.sign({ _id: testUsers[0]._id.toHexString(), access: testUsers[0].tokens.access }, process.env.JWT_SECRET).toString();
testUsers[1].tokens[0].token = jwt.sign({ _id: testUsers[1]._id.toHexString(), access: testUsers[1].tokens.access }, process.env.JWT_SECRET).toString();
testUsers[2].tokens[0].token = jwt.sign({ _id: testUsers[2]._id.toHexString(), access: testUsers[2].tokens.access }, process.env.JWT_SECRET).toString();

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
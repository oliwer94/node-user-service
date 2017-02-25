const {ObjectID} = require("mongodb");
const jwt = require('jsonwebtoken');
const {Todo} = require('./../../model/todo');
const {User} = require('./../../model/user');

var dummyUsers = [
    { _id: new ObjectID(),verified: false, email: 'first@first.com', password: 'asd123', 'tokens': [{ access: 'auth', token: '' }] },
    { _id: new ObjectID(),verified: false, email: 'second@first.com', password: 'asd123', 'tokens': [{ access: 'auth', token: '' }] },
    { _id: new ObjectID(),verified: false, email: 'third@first.com', password: 'asd123', 'tokens': [{ access: 'auth', token: '' }] }];

var dummyTodos = [
    { _id: new ObjectID(), text: 'first' ,_creator: dummyUsers[0]._id.toHexString()},
    { _id: new ObjectID(), text: 'first', completed: false,_creator:  dummyUsers[1]._id.toHexString()},
    { _id: new ObjectID(), text: 'first', completedAt: 333,_creator: dummyUsers[2]._id.toHexString() }];
console.log( process.env.JWT_SECRET);
dummyUsers[0].tokens[0].token = jwt.sign({ _id: dummyUsers[0]._id.toHexString(), access: dummyUsers[0].tokens.access }, process.env.JWT_SECRET).toString();
dummyUsers[1].tokens[0].token = jwt.sign({ _id: dummyUsers[1]._id.toHexString(), access: dummyUsers[1].tokens.access }, process.env.JWT_SECRET).toString();
dummyUsers[2].tokens[0].token = jwt.sign({ _id: dummyUsers[2]._id.toHexString(), access: dummyUsers[2].tokens.access }, process.env.JWT_SECRET).toString();


const populateTodos = (done) => {
 Todo.remove({}).then(() => {
        return Todo.insertMany(dummyTodos);
    }).then(() => done());
}

const populateUsers = (done) => {
  User.remove({}).then(() => {
    var userOne = new User(dummyUsers[0]).save();
    var userTwo = new User(dummyUsers[1]).save();
    var userThree = new User(dummyUsers[2]).save();

    return Promise.all([userOne, userTwo,userThree])
  }).then(() => done());
};

module.exports = {
    populateTodos,populateUsers,dummyTodos,dummyUsers
}
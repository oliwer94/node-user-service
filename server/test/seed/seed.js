/*jshint esversion: 6 */
const { ObjectID } = require("mongodb");
const jwt = require('jsonwebtoken');
const { User } = require('./../../model/user');
var user3id = new ObjectID();

var testUsers = [
  { _id: new ObjectID(), verified: true, email: 'first@first.com', password: 'asd123', country: 'Denmark', username: "valid1", friend_request_sent:["valid3"], friend_request_received:["valid3"] },
  { _id: new ObjectID(), verified: false, email: 'second@first.com', password: 'asd123', country: 'Denmark', username: "valid2" },
  { _id: user3id, verified: true, email: 'third@first.com', password: 'asd123', country: 'Denmark', username: "valid3", friends: ["valid4"], friend_request_sent:["valid1"],friend_request_received:["valid1"] },
  { _id: new ObjectID(), verified: true, email: 'fourth@first.com', password: 'asd123', country: 'Denmark', username: "valid4", friends: ["valid3"] }];

const populateUsers = (done) => {
  User.remove({}).then(() => {
    var userOne = new User(testUsers[0]).save();
    var userTwo = new User(testUsers[1]).save();
    var userThree = new User(testUsers[2]).save();
     var userFour = new User(testUsers[3]).save();

    return Promise.all([userOne, userTwo, userThree,userFour]);
  }).then(() => done());
};

module.exports = {
  populateUsers, testUsers, user3id
};
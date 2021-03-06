/*jshint esversion: 6 */

require('./config/config');

var express = require('express');
var bodyParser = require('body-parser');
const { ObjectID } = require('mongodb');
const _ = require('lodash');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const axios = require('axios');

var { mongoose } = require('./db/mongoose');
var { User } = require('./model/user');
var { transporter } = require('./email/email');
//var { auth } = require('./auth/authenthication');

var PORT = process.env.PORT;
var app = express();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());

const _addUserToCache = '/addUserToCache';
const _removeUserFromCache = '/removeUserFromCache';
const _getUserFromCache = '/getUserFromCache';
const _saveUserToDb = '/saveUserToDb';

var axiosPostCall = (url, action, body, callback) => {

    axios.post(url + action, body)
        .catch(function (error) {
            console.log(error);
        });
};

var auth = (req, res, next) => {
    
    var token = req.cookies.token || req.body.token || req.header('token');

    axios.post(process.env.AUTH_API_URL + '/authenticate',
        {
            token
        }).then((response) => {
            req.StatusCode = response.status;
            next();
        }).catch(function (error) 
        {
            console.log(error.message);
            if (error.message.indexOf("ECONNREFUSED") > -1) 
            {
                res.sendStatus(500);
            }
            else
             {
                res.sendStatus(error.response.status);
            }
        });
};

app.use(function (req, res, next) {
    res.header("Access-Control-Allow-Origin", process.env.CORS);//https://meyespace-frontend,herokuapp.com
    res.header("Access-Control-Allow-Credentials", "true");
    res.header('Access-Control-Allow-Methods', 'OPTIONS,GET,PUT,POST,DELETE');
    res.header("Access-Control-Allow-Headers", 'token,Authorization,Origin,X-Requested-With,Content-Type,Accept,content-type,application/json');
    next();
});

//loaderio stress test confirmation
app.get('/loaderio-30181893c284326698b1d75ee0ffedc3', (req, res) => {
    res.send("loaderio-30181893c284326698b1d75ee0ffedc3");
});

//CREATE USER
app.post('/register', (req, res) => {

    var body = _.pick(req.body, ['email', 'password', 'username', 'country']);
    var user = new User(body);
    user.verified = false;
    var token = jwt.sign({ _id: user._id.toHexString() + Date.now() }, process.env.JWT_SECRET).toString();

    user.save().then(() => {

        sendVerificationEmail(user.email, token);
        axiosPostCall(process.env.AUTH_API_URL, _addUserToCache, { token, "id": user._id });
        axiosPostCall(process.env.STAT_API_URL, _saveUserToDb, { "_userId": user._id, "country": user.country, "username": user.username });
        res.status(200).send(user);

    }).catch((e) => {
        res.status(400).send(e);
    });
});

//TODO: change FROM and TO to actual email addresses
function sendVerificationEmail(email, token) {
    // setup email data with unicode symbols

    let mailOptions = {
        from: 'Meyespace <noreply.meyespace@gmail.com>', // sender address
        to: `${email}`, // list of receivers
        subject: 'Welcome to Meyespace ✔', // Subject line
        text: `Welcome to Meyespace ${email.split("@")[0]}! In order to verify your account please visit the following link ${process.env.SITE_URL}/users/verify/${token}`, // plain text body
        html: `<b>Welcome to Meyespace  ${email.split("@")[0]}!</b> <p>In order to verify your account please visit the following link: </p><a href="${process.env.SITE_URL}/users/verify/${token}" > VERIFY ACCOUNT</a>`   // html body
    };

    //in test mode I do not send the message
    if (process.env.NODE_ENV == 'test') {
        return Promise.resolve();
    }
    else {
        // send mail with defined transport object
        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                return Promise.reject(error);
            }
            console.log('Message %s sent: %s', info.messageId, info.response);
            Promise.resolve();
        });
    }
}

app.get('/users/verify/:token', (req, res) => {

    var token = req.params.token;

    axios.post(process.env.AUTH_API_URL + '/getUserFromCache', {
        token
    }).then(function (response) {

        if (response.data._userId !== undefined) {
            User.findById(response.data._userId).then((user) => {
                user.verified = true;

                user.save().then((user) => {
                    res.status(200).send("User has been verified");
                    axiosPostCall(process.env.AUTH_API_URL, _removeUserFromCache, { token });
                });
            }).catch((e) => {
                res.sendStatus(404);
            });
        }
        else {
            res.sendStatus(401);
        }
    }).catch(function (error) {
        console.log(error);
    });
});

//login with model side token generation
app.post('/login', (req, res) => {

    var body = _.pick(req.body, ['email', 'password']);

    User.findByCredentials(body.email, body.password).then((user) => {

        var token = jwt.sign({ _id: user._id.toHexString() + Date.now() }, process.env.JWT_SECRET).toString();
        axiosPostCall(process.env.AUTH_API_URL, _addUserToCache, { token, "id": user._id });
        axiosPostCall(process.env.LIVEDATA_API_URL, "/friends", { "username": user.username, "friends": user.friends });
        var userId = user._doc._id.toHexString();
        //res.cookie('token', token, { expires: new Date(Date.now() + 600000) });

        res.status(200).send({ token, userId, "userName": user.username, "country": user.country });

    }).catch((e) => { res.sendStatus(400); });
});

app.get('/ping', (req, res) => {
    res.send("user service is up and running");
});

app.get('/getOnlineFriends/:id', auth, (req, res) => {
    User.findById(req.params.id).then
        ((user) => {
            axios.post(process.env.LIVEDATA_API_URL + "/getFriends", { "friends": user.friends })
                .then((response, request) => {
                    var body = _.pick(response.data, ['onlineFriends']);
                    var onlineFriends = body.onlineFriends;
                    res.status(200).send({ onlineFriends });
                })
                .catch(function (error) {
                    console.log(error);
                });
        }).catch((e) => { console.log(e); res.sendStatus(400); });
});

//Delete users/me/logout
app.get('/logout/:id', auth, (req, res) => {
    if (req.StatusCode === 200) {
        User.findById(req.params.id).then
            ((user) => {
                axiosPostCall(process.env.AUTH_API_URL, _removeUserFromCache, { "token": req.cookies.token });
                axiosPostCall(process.env.LIVEDATA_API_URL, "/offlinefriend", { "username": user.username, "friends": user.friends });
                res.status(200).send("OK");
            })
            .catch((e) => {
                console.log(e); res.sendStatus(400);
            });
    }
    else {
        res.sendStatus(req.StatusCode);
    }
});

//GET ALL USERS 
app.get('/users/:id/:name', auth, (req, res) => {
    if (req.StatusCode === 200) {
        var name = req.params.name;
        var userid = req.params.id;

        User.findById(userid).then
            ((user) => {

                User.find({ $and: [{ "username": { $regex: `.*${name}.*` } }, { verified: true }] }).then((users) => {

                    //var usernames = users.map(element => element.username);
                    var listOfUsers = [];
                    users.forEach(element => {

                        if (element.username !== user.username) {
                            var obj = {};
                            obj.username = element.username;
                            if (user.friends.indexOf(element.username) > -1) {
                                obj.type = "friend";
                            }
                            else if (user.friend_request_received.indexOf(element.username) > -1) {
                                obj.type = "received";
                            }
                            else if (user.friend_request_sent.indexOf(element.username) > -1) {
                                obj.type = "sent";
                            }
                            else {
                                obj.type = "stranger";
                            }
                            listOfUsers.push(obj);
                        }
                    });

                    res.send({ listOfUsers });
                }).catch((e) => { console.log(e); res.sendStatus(400); });

            })
    }
    else {
        res.sendStatus(req.StatusCode);
    }
});

var sendNotification = (notification, receiver) => {
    axiosPostCall(process.env.LIVEDATA_API_URL, "/notification", { notification, "username": receiver });
}

//Add friend
app.post('/addFriend/:id', auth, (req, res) => {
    if (req.StatusCode === 200) {
        var userid = req.params.id;
        var body = _.pick(req.body, ['username']);
        User.findById(userid).then((user) => {

            user.friend_request_sent.push(body.username);
            var idObj = user._id;
            delete user._id;

            User.findByIdAndUpdate(idObj, { $set: user }, { new: true }).then((newstat) => {
                User.find({ "username": body.username }).then((otheruser) => {
                    otheruser[0].friend_request_received.push(user.username);

                    var idObj = otheruser[0]._id;
                    delete otheruser[0]._id;

                    User.findByIdAndUpdate(idObj, { $set: otheruser[0] }, { new: true }).then((newstat) => {

                        sendNotification(`${user.username} has sent you a friend request.`, otheruser[0].username);

                        res.sendStatus(200);
                    });

                }).catch((e) => { console.log(e); res.sendStatus(400); });
            });
        });
    }
    else {
        res.sendStatus(req.StatusCode);
    }
});

app.post('/removeFriend/:id', auth, (req, res) => {
    if (req.StatusCode === 200) {
        var userid = req.params.id;
        var body = _.pick(req.body, ['username']);
        User.findById(userid).then((user) => {

            var index = user.friends.indexOf(body.username);
            user.friends.splice(index, 1);

            var idObj = user._id;
            delete user._id;

            User.findByIdAndUpdate(idObj, { $set: user }, { new: true }).then((newstat) => {
                User.find({ "username": body.username }).then((otherusers) => {
                    var otheruser = otherusers[0];
                    var index = otheruser.friends.indexOf(user.username);
                    otheruser.friends.splice(index, 1);

                    var idObj = otheruser._id;
                    delete otheruser._id;

                    User.findByIdAndUpdate(idObj, { $set: otheruser }, { new: true }).then((newstat) => {
                        axiosPostCall(process.env.LIVEDATA_API_URL, "/offlinefriend", { "username": user.username, "friends": otheruser.username });
                        axiosPostCall(process.env.LIVEDATA_API_URL, "/offlinefriend", { "username": otheruser.username, "friends": user.username });
                        res.sendStatus(200);
                    });

                }).catch((e) => { console.log(e); res.sendStatus(400); });
            });
        });
    }
    else {
        res.sendStatus(req.StatusCode);
    }
});

app.post('/rejectFriend/:id', auth, (req, res) => {
    if (req.StatusCode === 200) {
        var userid = req.params.id;
        var body = _.pick(req.body, ['username']);
        User.findById(userid).then((user) => {

            var index = user.friend_request_received.indexOf(body.username);
            user.friend_request_received.splice(index, 1);

            var idObj = user._id;
            delete user._id;

            User.findByIdAndUpdate(idObj, { $set: user }, { new: true }).then((newstat) => {
                User.find({ "username": body.username }).then((otherusers) => {
                    otheruser = otherusers[0];
                    var index = otheruser.friend_request_sent.indexOf(user.username);
                    otheruser.friend_request_sent.splice(index, 1);

                    var idObj = otheruser._id;
                    delete otheruser._id;

                    User.findByIdAndUpdate(idObj, { $set: otheruser }, { new: true }).then((newstat) => {

                        sendNotification(`${user.username} has declined your friend request.`, otheruser.username);
                        res.sendStatus(200);
                    });

                }).catch((e) => { console.log(e); res.sendStatus(400); });
            });
        });
    }
    else {
        res.sendStatus(req.StatusCode);
    }
});

app.post('/rewokeFriend/:id', auth, (req, res) => {
    if (req.StatusCode === 200) {
        var userid = req.params.id;
        var body = _.pick(req.body, ['username']);
        User.findById(userid).then((user) => {

            var index = user.friend_request_sent.indexOf(body.username);
            user.friend_request_sent.splice(index, 1);

            var idObj = user._id;
            delete user._id;

            User.findByIdAndUpdate(idObj, { $set: user }, { new: true }).then((newstat) => {
                User.find({ "username": body.username }).then((otherusers) => {
                    otheruser = otherusers[0];
                    var index = otheruser.friend_request_received.indexOf(user.username);
                    otheruser.friend_request_received.splice(index, 1);

                    var idObj = otheruser._id;
                    delete otheruser._id;

                    User.findByIdAndUpdate(idObj, { $set: otheruser }, { new: true }).then((newstat) => {

                        res.sendStatus(200);
                    });

                }).catch((e) => { console.log(e); res.sendStatus(400); });
            });
        });
    }
    else {
        res.sendStatus(req.StatusCode);
    }
});

app.post('/acceptFriend/:id', auth, (req, res) => {
    if (req.StatusCode === 200) {
        var userid = req.params.id;
        var body = _.pick(req.body, ['username']);
        User.findById(userid).then((user) => {

            var index = user.friend_request_received.indexOf(body.username);
            user.friend_request_received.splice(index, 1);

            user.friends.push(body.username);

            var idObj = user._id;
            delete user._id;

            User.findByIdAndUpdate(idObj, { $set: user }, { new: true }).then((newstat) => {
                User.find({ "username": body.username }).then((otherusers) => {
                    otheruser = otherusers[0];
                    var index = otheruser.friend_request_sent.indexOf(user.username);
                    otheruser.friend_request_sent.splice(index, 1);

                    otheruser.friends.push(user.username);

                    var idObj = otheruser._id;
                    delete otheruser._id;

                    User.findByIdAndUpdate(idObj, { $set: otheruser }, { new: true }).then((newstat) => {
                        sendNotification(`${user.username} has accepted your friend request.`, otheruser.username);
                        axiosPostCall(process.env.LIVEDATA_API_URL, "/friends", { "username": user.username, "friends": otheruser.username });
                        axiosPostCall(process.env.LIVEDATA_API_URL, "/friends", { "username": otheruser.username, "friends": user.username });
                        res.sendStatus(200);
                    });

                }).catch((e) => { console.log(e); res.sendStatus(400); });
            });
        });
    }
    else {
        res.sendStatus(req.StatusCode);
    }
});

app.get('/getFriends/:id', auth, (req, res) => {
    if (req.StatusCode === 200) {
        var userid = req.params.id;
        User.findById(userid).then((user) => {
            var friendList = user.friends;
            res.send({ friendList });
        }).catch((e) => { console.log(e); res.sendStatus(400); });
    }
    else {
        res.sendStatus(req.StatusCode);
    }
});

app.get('/getReceivedFriendRequests/:id', auth, (req, res) => {
    if (req.StatusCode === 200) {
        var userid = req.params.id;
        User.findById(userid).then((user) => {
            var receivedList = user.friend_request_received;
            res.send({ receivedList });
        }).catch((e) => { console.log(e); res.sendStatus(400); });
    }
    else {
        res.sendStatus(req.StatusCode);
    }
});

app.get('/getSentFriendRequests/:id', auth, (req, res) => {
    if (req.StatusCode === 200) {
        var userid = req.params.id;
        User.findById(userid).then((user) => {
            var sentList = user.friend_request_sent;
            res.send({ sentList });
        }).catch((e) => { console.log(e); res.sendStatus(400); });
    }
    else {
        res.sendStatus(req.StatusCode);
    }
});

//GET USER ME 
app.get('/me', auth, (req, res) => {
    if (req.StatusCode === 200) {
        User.findById(req.cookies._userId).then((user) => {
            res.send(user);
        }).catch((e) => { console.log(e); res.sendStatus(404); });
    }
    else {
        res.sendStatus(req.StatusCode);
    }
});

app.listen(PORT, () => {
    console.log("Started on port ", PORT);
});

module.exports = { app };

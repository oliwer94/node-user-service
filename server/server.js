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

var PORT = process.env.PORT;
var app = express();

app.use(bodyParser.json());
app.use(cookieParser());

var addUserToCache = (token, _userId) => {

    axios.post(process.env.AUTH_API_URL + '/addUserToCache', {
        token: token,
        id: _userId
    }).catch(function (error) {
        console.log(error);
    });
};

var removeUserFromCache = (token) => {

    axios.post(process.env.AUTH_API_URL + '/removeUserFromCache', {
        token: token
    }).catch(function (error) {
        console.log(error);
    });
};

var updateUserInCache = (token, _userId) => {

    axios.post(process.env.AUTH_API_URL + '/updateUserInCache', {
        token: token,
        id: _userId
    }).catch(function (error) {
        console.log(error);
    });
};

var getUserFromCache = (token) => {

    axios.post(process.env.AUTH_API_URL + '/getUserFromCache', {
        token: token
    }).then(function (response) {
        return response.body._userId;
    }).catch(function (error) {
        console.log(error);
    });
};

var auth = (req, res, next) => {

    axios.post(process.env.AUTH_API_URL + '/authenticate', {
        token: req.cookies.token
    }).then((response) => {
        req.StatusCode = response.status;
        next();
    }).catch(function (error) {
        console.log(error);
        req.StatusCode = error.response.status;
        next();
    });
};


//CREATE USER
app.post('/register', (req, res) => {

    var body = _.pick(req.body, ['email', 'password']);
    var user = new User(body);
    user.verified = false;
    var token = jwt.sign({ _id: user._id.toHexString() + Date.now() }, process.env.JWT_SECRET).toString();

    addUserToCache(token, user._id);


    user.save().then(() => {

        sendVerificationEmail(user.email, token);
        //res.header('x-auth', token).send(user);
        res.status(200).send(user);

        axios.post(process.env.STAT_API_URL + '/saveUserToDb', {
            _userId: user._id
        }).catch(function (error) {
            console.log(error);
        });

    }).catch((e) => {
        res.status(400).send(e);
    });
});

function sendVerificationEmail(email, token) {
    // setup email data with unicode symbols

    let mailOptions = {
        from: 'Oliwer <bananbaszo@gmail.com>', // sender address
        to: `oliwer94@gmail.com`,//`${email}`, // list of receivers
        subject: 'Hello ✔', // Subject line
        text: 'Hello world ?', // plain text body
        html: `<b>Hello world ?</b> <a href="${process.env.SITE_URL}/users/verify/${token}" > verify account</a>`   // html body
    };
    // send mail with defined transport object

    if (process.env.NODE_ENV == 'test') {
        //in test mode I do not send the message
        return Promise.resolve();
    }
    else {
        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                return Promise.reject(error);
                // return console.log(error);
            }
            console.log('Message %s sent: %s', info.messageId, info.response);
            Promise.resolve();
        });
    }
}

app.get('/users/verify/:id', (req, res) => {

    var token = req.params.id;
    var _userId = "";

    axios.post(process.env.AUTH_API_URL + '/getUserFromCache', {
        token: token
    }).then(function (response) {
        _userId = response.data._userId;
    }).then(() => {
        if (_userId !== undefined) {

            User.findById(_userId).then((user) => {

                user.verified = true;

                user.save().then((user) => {
                    res.status(200).send("User has been verified");
                    removeUserFromCache(token);
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

        addUserToCache(token, user._id);

        res.cookie('token', token);
        res.cookie('_userId', user._id);
        res.sendStatus(200);

    }).catch((e) => { res.sendStatus(400); });
});

//Delete users/me/logout
app.get('/me/logout', auth, (req, res) => {
    if (req.StatusCode === 200) {
        removeUserFromCache(req.cookies.token);

        res.sendStatus(200);
    }
    else {
        res.sendStatus(req.StatusCode);
    }
});

//GET ALL USERS 
app.get('/users', auth, (req, res) => {
    if (req.StatusCode === 200) {
        User.find().then((users) => {
            res.send({ users });
        },
            (e) => {
                res.sendStatus(400);
            }
        );
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
        });
    }
    else {
        res.sendStatus(req.StatusCode);
    }
});

app.listen(PORT, () => {
    console.log("Started on port ", PORT);
});

module.exports = { app };
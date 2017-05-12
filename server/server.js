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

    axios.post(process.env.AUTH_API_URL + '/authenticate', {
        token: req.cookies.token
    }).then((response) => {
        req.StatusCode = response.status;
        next();
    }).catch(function (error) {
        console.log(error.message);
        req.StatusCode = error.response.status;
        next();
    });
};

app.use(function (req, res, next) {
    res.header("Access-Control-Allow-Origin", process.env.CORS);//'https://meyespace-frontend.com'); //<-- you can change this with a specific url like http://localhost:4200
    res.header("Access-Control-Allow-Credentials", "true");
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
    res.header("Access-Control-Allow-Headers", 'Origin,X-Requested-With,Content-Type,Accept,content-type,application/json');
    next();
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
        axiosPostCall(process.env.STAT_API_URL, _saveUserToDb, { "_userId": user._id,"country":user.country });
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
        to: `oliwer94@gmail.com`,//`${email}`, // list of receivers
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
        var userId = user._doc._id.toHexString();
        // res.header("token", token);
        // res.header("_userId", user._id);
        // res.cookie('token', token,{ expires: new Date(Date.now() + 60000)}); ??
        // res.cookie('userId', userId,{ expires: new Date(Date.now() + 60000)}); ??
        // res.cookie('country', user._doc.country,{ expires: new Date(Date.now() + 60000)});
        // res.cookie('userName', user._doc.username,{ expires: new Date(Date.now() + 60000)});

        //res.sendStatus(200);
        res.status(200).send({ token,userId,"userName": user.username, "country": user.country });

    }).catch((e) => { res.sendStatus(400); });
});

app.get('/ping', (req, res) => {
    res.send("user service is up and running");
});

//Delete users/me/logout
app.get('/me/logout', auth, (req, res) => {
    if (req.StatusCode === 200) {
        axiosPostCall(process.env.AUTH_API_URL, _removeUserFromCache, { "token": req.cookies.token });
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

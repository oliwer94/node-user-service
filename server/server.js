require('./config/config');

var express = require('express');
var bodyParser = require('body-parser');
const {ObjectID} = require('mongodb');
const _ = require('lodash');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const axios = require('axios');

var {mongoose} = require('./db/mongoose');
var {User} = require('./model/user');
var {authenticate} = require('./middleware/authenticate');
var {transporter} = require('./email/email');

var PORT = process.env.PORT;
var app = express();

app.use(bodyParser.json());
app.use(cookieParser());


//CREATE USER
app.post('/register', (req, res) => {

    var body = _.pick(req.body, ['email', 'password']);
    var user = new User(body);
    user.verified = false;

    user.save().then(() => {
        return user.generateAuthToken();
    })
        .then((token) => {
            sendVerificationEmail(user.email, token);
            //res.header('x-auth', token).send(user);
            res.status(200).send(user);;
        }).catch((e) => {
            res.status(400).send(e);
        });
});

//GET ALL USERS 
app.get('/users', authenticate, (req, res) => {
    User.find().then((users) => {
        res.send({ users });
    },
        (e) => {
            res.sendStatus(400);
        }
    );
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

    User.findByToken(token).then((user) => {
        if (!user) {
            return Promise.reject();
        }
        user.verified = true;
        user.tokens.shift();

        user.save().then((user) => {
            res.status(200).send("User has been verified");
        });


    }).catch((e) => {
        res.sendStatus(401);
    });
});

//GET USER ME 
app.get('/me', authenticate, (req, res) => {
    res.send(req.user);
});

app.post('/login', (req, res) => {

    var body = _.pick(req.body, ['email', 'password']);

    User.findByCredentials(body.email, body.password).then((user) => {
        return user.generateAuthToken().then((token) => {
            res.cookie('token', token);
            res.sendStatus(200);

            axios.post(process.env.MAIN_API_URL + '/addUser', {
                token: token,
                id: user._id
            }).catch(function (error) {
                    console.log(error);
                });
        });
    })
        .catch((e) => { res.sendStatus(400); });
});

//Delte users/me/logout
app.get('/me/logout', authenticate, (req, res) => {

    req.user.removeToken(req.token).then(() => {
        res.status(200).send();
        axios.post(process.env.MAIN_API_URL + '/removeUser', {
            token: req.token,
            _id: req.user._id
        }).catch(function (error) {
                console.log(error);
            });

    }, () => { res.status(400).send(); });
});

app.listen(PORT, () => {
    console.log("Started on port ", PORT);
});

module.exports = { app };
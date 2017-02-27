require('./config/config');

var express = require('express');
var bodyParser = require('body-parser');
const {ObjectID} = require('mongodb');
const _ = require('lodash');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const axios = require('axios');
var cache = require('persistent-cache');

var {mongoose} = require('./db/mongoose');
var {User} = require('./model/user');
var {UserAuth} = require('./model/userAuth');
//var {authenticate} = require('./middleware/authenticate');
var {transporter} = require('./email/email');

var mycache = cache({
    //duration: 1000 * 3600 * 24 //one day
    duration: 1000 * 60 * 10 // 10 mins
});
var PORT = process.env.PORT;
var app = express();

app.use(bodyParser.json());
app.use(cookieParser());

var authenticate = (req, res, next) => {
    var token = req.cookies.token;
    var value = mycache.getSync(token);
    if (value !== undefined) {

        User.findById(value._userId).then((user) => {
            req.user = user;
            req.token = token;
            next();
        });
    }
    else {
        res.sendStatus(401);
    }
}

//CREATE USER
app.post('/register', (req, res) => {

    var body = _.pick(req.body, ['email', 'password']);
    var user = new User(body);
    user.verified = false;
    var token = jwt.sign({ _id: user._id.toHexString() + Date.now() }, process.env.JWT_SECRET).toString()
    mycache.put(token, { "_userId": user._id });


    user.save().then(() => {

        sendVerificationEmail(user.email, token);
        //res.header('x-auth', token).send(user);
        res.status(200).send(user);

        axios.post(process.env.MAIN_API_URL + '/saveUserToDb', {
            _userId: user._id
        }).catch(function (error) {
            console.log(error);
        });

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
    var value = mycache.getSync(token);

    if (value !== undefined) {

        User.findById(value._userId).then((user) => {

            user.verified = true;

            user.save().then((user) => {
                res.status(200).send("User has been verified");
                mycache.deleteSync(token);
            });
        }).catch((e) => {
            res.sendStatus(404);
        });
    }
    else {
        res.sendStatus(401);
    }

});

//GET USER ME 
app.get('/me', authenticate, (req, res) => {
    res.send(req.user);
});

//login with model side token generation
app.post('/login', (req, res) => {

    var body = _.pick(req.body, ['email', 'password']);

    User.findByCredentials(body.email, body.password).then((user) => {

        var token = jwt.sign({ _id: user._id.toHexString() + Date.now() }, process.env.JWT_SECRET).toString()
        mycache.put(token, { "_userId": user._id });
        res.cookie('token', token);
        res.sendStatus(200);

        axios.post(process.env.MAIN_API_URL + '/addUser', {
            token: token,
            id: user._id
        }).catch(function (error) {
            console.log(error);
        });
    }).catch((e) => { res.sendStatus(400); });
})

//Delete users/me/logout
app.get('/me/logout', authenticate, (req, res) => {

    mycache.deleteSync(req.token);
    res.status(200).send();
    axios.post(process.env.MAIN_API_URL + '/removeUser', {
        token: req.token,
        id: req.user._id

    }).catch(function (error) {
        console.log(error);
    });

});


app.listen(PORT, () => {
    console.log("Started on port ", PORT);
});

module.exports = { app };



// for saving the token in the db instead of caching it.
/*
//checking against user model (old)
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

//Delete users/me/logout
app.get('/me/logout', authenticate, (req, res) => {

    UserAuth.findOne({ "token":req.token, "_userId": req.user._id }).then((userAuth) => {

        userAuth.removeToken(req.token).then(() => {
      //  req.user.removeToken(req.token).then(() => {

          console.log('he has been logged out',mycache.getSync(req.token));
            res.status(200).send();
            axios.post(process.env.MAIN_API_URL + '/removeUser', {
                token: req.token,
                id: req.user._id

            }).catch(function (error) {
                console.log(error);
            });

        }, () => { res.status(400).send(); });
    }, () => { res.status(400).send(); });
});

//login with model side token generation
app.post('/login', (req, res) => {

    var body = _.pick(req.body, ['email', 'password']);

    User.findByCredentials(body.email, body.password).then((user) => {

        var userAuth = new UserAuth();
        userAuth._userId = user._id;
        // return user.generateAuthToken().then((token) => {
        return userAuth.generateAuthToken().then((token) => {
            mycache.put(token,{"_userId":user._id});
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
*/





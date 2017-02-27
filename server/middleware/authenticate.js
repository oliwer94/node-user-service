var {User} = require('./../model/user');
var {UserAuth} = require('./../model/userAuth');
const cookieParser = require('cookie-parser');


//Header
/*var authenticate = (req,res,next) =>
{
    var token = req.header('x-auth');

    User.findByToken(token).then((user) =>
    {
        if(!user)
        {
            return Promise.reject();
        }

        req.user = user;
        req.token = token;      
        next();
    }).catch((e) => {
        res.sendStatus(401);
    });

}*/


//// checking token against DB entry
var authenticate = (req, res, next) => {
    var token = req.cookies.token;
    if (token) {
        UserAuth.findByToken(token).then((userAuth) => {

            if (!userAuth) {
                throw Error;
            }
            User.findById(userAuth._userId).then((user) => {
                req.user = user;
                req.token = token;
                next();
            });
        }).catch((e) => {
            res.sendStatus(401);
        });
    }
    else {
        res.sendStatus(401);
    }
}

module.exports = {
    authenticate
}
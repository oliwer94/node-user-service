var {User} = require('./../model/user');
const cookieParser = require('cookie-parser');

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

var authenticate = (req, res, next) => {
    var token = req.cookies.token;
    if (token) {
        User.findByToken(token).then((user) => {
            req.user = user;
            req.token = token;     
            next();
        }).catch((e) => {
            res.sendStatus(401);
        });
    }
    else
    {
         res.sendStatus(401);
    }
}

module.exports = {
    authenticate
}
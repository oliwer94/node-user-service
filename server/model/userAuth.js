const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const _ = require('lodash');

var UserAuthSchema = new mongoose.Schema(
    {
        _userId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
            minlength: 1
        },
        token: {
            type: String,
            required: true,
            unique: true
        },
        createdAt:
        {
            type: Date,
            expires: 100,
            default: Date.now
        }
    }
);


UserAuthSchema.methods.toJSON = function () {
    var userAuth = this;
    var userAuthObject = userAuth.toObject();

    return _.pick(userAuth, ['_id', '_userId', 'token']);
};

UserAuthSchema.methods.generateAuthToken = function () {
    var userAuth = this;

    var token = jwt.sign({ _id: userAuth._id.toHexString() + (Math.random() * Math.random()) }, process.env.JWT_SECRET).toString();

    userAuth.token = token;

    return userAuth.save().then(() => {
        return token;
    }).catch((e) => console.log(e));
};


UserAuthSchema.methods.removeToken = function () {

    var userAuth = this;
    return UserAuth.findOneAndRemove({ "token": userAuth.token });
}

UserAuthSchema.statics.findByToken = function (token) {
    var UserAuth = this;
    var decoded;
    var asd;

    try {
        decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (e) { return Promise.reject() };

    return UserAuth.findOne({ token });
};

var UserAuth = mongoose.model("UserAuth", UserAuthSchema);

module.exports = { UserAuth };
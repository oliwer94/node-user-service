
const nodemailer = require('nodemailer');

// create reusable transporter object using the default SMTP transport
let transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.GMAIL_USERNAME,// 'bananbaszo@gmail.com',
        pass: process.env.GMAIL_PASSWORD//'bananbaszo94'
    }
});
module.exports = {
    transporter
};
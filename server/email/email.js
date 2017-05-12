/*jshint esversion: 6 */
const nodemailer = require('nodemailer');
const smtpTransport = require('nodemailer-smtp-transport');

// create reusable transporter object using the default SMTP transport
let transporter = nodemailer.createTransport(smtpTransport({
    service: 'gmail',
    auth: {
        user: process.env.GMAIL_USERNAME,// 'bananbaszo@gmail.com',  noreply.meyespace@gmail.com
        pass: process.env.GMAIL_PASSWORD//'bananbaszo94'
    }
}));
module.exports = {
    transporter
};
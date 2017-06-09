/*jshint esversion: 6 */
const expect = require('expect');
const request = require('supertest');
const { ObjectID } = require('mongodb');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const sinon = require('sinon');

var { app } = require('./../server');
const { User } = require('./../model/user');
const seed = require('./seed/seed');

var testUsers = seed.testUsers;

beforeEach((done) => {
    seed.populateUsers(done);
});

describe('POST /register', () => {

    it('should create a new user with hashed password', (done) => {
        var email = 'valid@valid.com';
        var password = 'vallidpw';
        var country = "Denmark";
        var username = "valid";

        request(app)
            .post('/register')
            .send({ email, password, country, username })
            .expect(200)
            .expect((res) => {
                expect(res.body.email).toBe(email);
            })
            .end((err) => {
                if (err) {
                    return done(err);
                }
                User.find({ email }).then((user) => {
                    expect(user.length).toBe(1);
                    expect(user[0].email).toBe(email);
                    expect(user[0].password).toNotBe(testUsers[0].password);
                    return done();
                }).catch((e) => done(e));
            });
    });

    it('should not create user with an existing email', (done) => {

        var email = testUsers[0].email;
        var password = 'vallidpw';
        var country = "Denmark";
        var username = "valid2";

        request(app)
            .post('/register')
            .send({ email, password, country, username })
            .expect(400)
            .end((err, res) => {
                if (err) {
                    return done(err);
                }

                User.find().then((user) => {
                    expect(user.length).toBe(4);
                    done();
                }).catch((e) => done(e));
            });
    });

    it('should not create user without an email', (done) => {

        var password = 'vallidpw';
        var country = "Denmark";
        var username = "valid";

        request(app)
            .post('/register')
            .send({ password, country, username })
            .expect(400)
            .end((err, res) => {
                if (err) {
                    return done(err);
                }

                User.find().then((user) => {
                    expect(user.length).toBe(4);
                    done();
                }).catch((e) => done(e));
            });
    });

    it('should not create user without a password', (done) => {

        var email = testUsers[0].email;
        var country = "Denmark";
        var username = "valid";

        request(app)
            .post('/register')
            .send({ email, country, username })
            .expect(400)
            .end((err, res) => {
                if (err) {
                    return done(err);
                }

                User.find().then((user) => {
                    expect(user.length).toBe(4);
                    done();
                }).catch((e) => done(e));
            });
    });

    it('should be unverified by default', (done) => {

        var email = 'valid@valid.com';
        var password = 'vallidpw';
        var country = "Denmark";
        var username = "valid";

        request(app)
            .post('/register')
            .send({ email, password, country, username })
            .expect(200)
            .expect((res) => {
                expect(res.body.email).toBe(email);
            })
            .end((err) => {
                if (err) {
                    return done(err);
                }
                User.find({ email }).then((user) => {
                    expect(user[0].verified).toBe(false);
                    return done();
                }).catch((e) => done(e));
            });
    });
});

describe('GET /login', () => {

    it('should return me as a user', (done) => {

        request(app)
            .post('/login')
            .send({ email: testUsers[2].email, password: testUsers[2].password })
            .expect(200)
            .expect((res) => {
                expect(res.body.token).toExist();
            })
            .end((err) => {
                if (err) {
                    return done(err);
                }
                User.findById(testUsers[2]._id.toHexString()).then((user) => {
                    expect(user.email).toBe(testUsers[2].email);
                    done();
                }).catch((e) => done(e));
            });
    });

    it('should return a 400 because wrong email', (done) => {

        request(app)
            .post('/login')
            .send({ email: testUsers[0].email + '4', password: testUsers[0].password })
            .expect(400)
            .expect((res) => {
                expect(res.body).toEqual({});
            })
            .end((err, res) => {
                if (err) {
                    return done(err);
                }
                return done();
            });
    });

    it('should return a 400 becasue wrong password', (done) => {

        request(app)
            .post('/login')
            .send({ email: testUsers[0].email, password: testUsers[0].password + '4' })
            .expect(400)
            .expect((res) => {
                expect(res.body).toEqual({});
            })
            .end((err, res) => {
                if (err) {
                    return done(err);
                }
                return done();
            });
    });

});

describe('GET /ping', () => {
    it('should get a return that the service is up and running', (done) => {
        request(app)
            .get('/ping')
            .expect(200)
            .expect((res) => {
                expect(res.text).toBe('user service is up and running');
            })
            .end((err) => {
                if (err) {
                    return done(err);
                }
                done(err);
            });
    });
});

describe('GET /users/:id/:name  search', () => {

    var token;
    beforeEach((done) => {
        request(app)
            .post('/login')
            .send({ email: testUsers[2].email, password: testUsers[2].password })
            .expect(200)
            .expect((res) => {
                expect(res.body.token).toExist();
                token = res.body.token;
            })
            .end((err) => {
                if (err) {
                    return done(err);
                }
                done();
            });
    });

    it('should return a result of the search', (done) => {
        request(app)
            .get(`/users/${testUsers[2]._id.toHexString()}/val`)
            .set('token', [token])
            .expect(200)
            .expect((res) => {
                expect(res.body.listOfUsers).toExist();
            })
            .end((err) => {
                if (err) {
                    return done(err);
                }
                done();
            });
    });
});

describe('POST friend(s) methods', () => {

    var token;
    beforeEach((done) => {
        request(app)
            .post('/login')
            .send({ email: testUsers[2].email, password: testUsers[2].password })
            .expect(200)
            .expect((res) => {
                expect(res.body.token).toExist();
                token = res.body.token;
            })
            .end((err) => {
                if (err) {
                    return done(err);
                }
                done();
            });
    });

    it('should return add friend', (done) => {
        request(app)
            .post(`/addFriend/${testUsers[2]._id.toHexString()}`)
            .set('token', [token])
            .send({ username: "valid1" })
            .expect(200)
            .end((err) => {
                if (err) {
                    return done(err);
                }
                User.findById(testUsers[2]._id.toHexString()).then((user) => {
                    expect(user.friend_request_sent.length).toBe(2);
                    done();
                }).catch((e) => done(e));
            });
    });
    it('should return remove friend', (done) => {
        request(app)
            .post(`/removeFriend/${testUsers[2]._id.toHexString()}`)
            .set('token', [token])
            .send({ username: "valid4" })
            .expect(200)
            .end((err) => {
                if (err) {
                    return done(err);
                }
                User.findById(testUsers[2]._id.toHexString()).then((user) => {
                    expect(user.friends.length).toBe(0);
                }).then(() => {
                    User.findById(testUsers[3]._id.toHexString()).then((user2) => {
                        expect(user2.friends.length).toBe(0);
                        done();
                    }).catch((e) => done(e));
                });
            });
    });
    it('should return revoke friend', (done) => {
        request(app)
            .post(`/rewokeFriend/${testUsers[2]._id.toHexString()}`)
            .set('token', [token])
            .send({ username: "valid1" })
            .expect(200)
            .end((err) => {
                if (err) {
                    return done(err);
                }
                User.findById(testUsers[2]._id.toHexString()).then((user) => {
                    expect(user.friend_request_sent.length).toBe(0);
                    done();
                }).catch((e) => done(e));
            });
    });
    it('should return reject friend', (done) => {
        request(app)
            .post(`/rejectFriend/${testUsers[2]._id.toHexString()}`)
            .set('token', [token])
            .send({ username: "valid1" })
            .expect(200)
            .end((err) => {
                if (err) {
                    return done(err);
                }
                User.findById(testUsers[2]._id.toHexString()).then((user) => {
                    expect(user.friend_request_received.length).toBe(0);
                }).then(() => {
                    User.findById(testUsers[3]._id.toHexString()).then((user2) => {
                        expect(user2.friend_request_sent.length).toBe(0);
                        done();
                    }).catch((e) => done(e));
                });
            });
    });
});
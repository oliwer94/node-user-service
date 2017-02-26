const expect = require('expect');
const request = require('supertest');
const {ObjectID} = require('mongodb');
const jwt = require('jsonwebtoken');

const {app} = require('./../server');
const {User} = require('./../model/user');
const seed = require('./seed/seed');

var testUsers = seed.testUsers;

beforeEach((done) => {
    seed.populateUsers(done);
});

describe('POST /register', () => {

    it('should create a new user with hashed password', (done) => {
        var email = 'valid@valid.com';
        var password = 'vallidpw';

        request(app)
            .post('/register')
            .send({ email, password })
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

        var email = testUsers[0].email;;
        var password = 'vallidpw';

        request(app)
            .post('/register')
            .send({ email, password })
            .expect(400)
            .end((err, res) => {
                if (err) {
                    return done(err);
                }

                User.find().then((user) => {
                    expect(user.length).toBe(3);
                    done();
                }).catch((e) => done(e));
            });
    });

    it('should not create user without an email', (done) => {

        var password = 'vallidpw';

        request(app)
            .post('/register')
            .send({ password })
            .expect(400)
            .end((err, res) => {
                if (err) {
                    return done(err);
                }

                User.find().then((user) => {
                    expect(user.length).toBe(3);
                    done();
                }).catch((e) => done(e));
            });
    });

    it('should not create user without a password', (done) => {

        var email = testUsers[0].email;

        request(app)
            .post('/register')
            .send({ email })
            .expect(400)
            .end((err, res) => {
                if (err) {
                    return done(err);
                }

                User.find().then((user) => {
                    expect(user.length).toBe(3);
                    done();
                }).catch((e) => done(e));
            });
    });

    it('should be unverified by default', (done) => {

        var email = 'valid@valid.com';
        var password = 'vallidpw';

        request(app)
            .post('/register')
            .send({ email, password })
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

describe('GET /users', () => {

    it('should return all user objects', (done) => {
            request(app)
                .get('/users')
                .set('Cookie', [`token=${testUsers[2].tokens[0].token}`])
                .expect(200)
                .expect((res) => {
                    User.find().then(() => {
                        expect(res.body.users.length).toBe(3);
                    });
                })
                .end(done);
        });
});

describe('GET /users/verify/:id', () => {

    it('should verify user object', (done) => {

        request(app)
            .get(`/users/verify/${testUsers[0].tokens[0].token}`)
            .expect(200)
            .expect((res) => {
                User.find().then(() => {
                    expect(res.text).toBe("User has been verified");
                });
            })
            .end((err) => {
                if (err) {
                    return done(err);
                }
                User.find({ email: testUsers[0].email }).then((user) => {
                    expect(user.length).toBe(1);
                    expect(user[0].verified).toBe(true);
                    return done();
                }).catch((e) => done(e));
            });
    });
});

describe('GET /me', () => {

    it('should return me as a user', (done) => {

        request(app)
            .get('/me')
            .set('Cookie', [`token=${testUsers[2].tokens[0].token}`])            
            .expect(200)
            .expect((res) => {
                expect(res.body.email).toBe(testUsers[2].email);
                expect(res.body._id).toBe(testUsers[2]._id.toHexString());
            })
            .end(done);
    });

    it('should return a 401', (done) => {

        request(app)
            .get('/me')
            .expect(401)
            .expect((res) => {
                expect(res.body).toEqual({});
            })
            .end(done);
    });
});

describe('GET /login', () => {

    it('should return me as a user', (done) => {

        request(app)
            .post('/login')
            .send({ email: testUsers[2].email, password: testUsers[2].password })
            .expect(200)
            .expect((res) => {
                expect(res.headers['set-cookie']).toExist();
            })
            .end((err, res) => {
                if (err) {
                    return done(err);
                }
                User.findById(testUsers[2]._id.toHexString()).then((user) => {
                    expect(user.tokens[1]).toInclude({ access: 'auth', token: res.headers['set-cookie'].toString().split(';')[0].substring(6)});
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

    it('should return a 400', (done) => {

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

describe('GET /me/logout', () => {

    it('/n should remove auth token on logout', (done) => {

        var base = { 'x-auth': testUsers[1].tokens[0].token };

        request(app)
            .get('/me/logout')
            .set('Cookie', [`token=${testUsers[2].tokens[0].token}`])       
            .end((err, res) => {
                if (err) {
                    return done(err);
                }
                User.findById(testUsers[2]._id.toHexString()).then((user) => {
                    expect(user.tokens).toEqual([]);
                    done();
                }).catch((e) => done(e));
            });
    });
});


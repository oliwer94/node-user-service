const expect = require('expect');
const request = require('supertest');
const {ObjectID} = require('mongodb');
const jwt = require('jsonwebtoken');

const {app} = require('./../server');
const {Todo} = require('./../model/todo');
const {User} = require('./../model/user');
const seed = require('./seed/seed');

var dummyTodos = seed.dummyTodos;
var dummyUsers = seed.dummyUsers;

beforeEach((done) => {
    seed.populateTodos(done);
});
beforeEach((done) => {
    seed.populateUsers(done);
});

describe('POST /todos', () => {

    it('should create a new todo', (done) => {
        var text = 'Test todo text';

        request(app)
            .post('/todos')
            .set('x-auth', dummyUsers[0].tokens[0].token)
            .send({ text })
            .expect(200)
            .expect((res) => {
                expect(res.body.text).toBe(text);
            })
            .end((err) => {
                if (err) {
                    return done(err);
                }

                Todo.find({ text }).then((todos) => {
                    expect(todos.length).toBe(1);
                    expect(todos[0].text).toBe(text);
                    return done();
                }).catch((e) => done(e));
            });
    });

    it('should not create with invalid data', (done) => {
        request(app)
            .post('/todos')
            .set('x-auth', dummyUsers[0].tokens[0].token)
            .send({})
            .expect(400)
            .end((err, res) => {
                if (err) {
                    return done(err);
                }

                Todo.find().then((todos) => {
                    expect(todos.length).toBe(3);
                    done();
                }).catch((e) => done(e));
            });
    });
});

describe('GET /todos:id', () => {

    it('should return specific todo object', (done) => {

        request(app)
            .get(`/todos/${dummyTodos[0]._id.toHexString()}`)
            .set('x-auth', dummyUsers[0].tokens[0].token)
            .expect(200)
            .expect((res) => {
                Todo.find().then(() => {
                    expect(res.body.todo.text).toBe(dummyTodos[0].text);
                });
            })
            .end(done);
    });

    it('should not a return specific todo created by other user', (done) => {

        request(app)
            .get(`/todos/${dummyTodos[1]._id.toHexString()}`)
            .set('x-auth', dummyUsers[0].tokens[0].token)
            .expect(404)
            .end(done);
    });


    it('should return 404 id not found', (done) => {

        request(app)
            .get(`/todos/${new ObjectID().toHexString()}`)
            .set('x-auth', dummyUsers[0].tokens[0].token)
            .expect(404)
            .end(done);
    });
    it('should return 400 wrong id', (done) => {

        request(app)
            .get(`/todos/asd`)
            .set('x-auth', dummyUsers[0].tokens[0].token)
            .expect(400)
            .end(done);
    });
});

describe('DELETE /todos/:id', () => {

    it('should remove todo objects', (done) => {

        var hexID = dummyTodos[1]._id.toHexString();

        request(app)
            .delete(`/todos/${hexID}`)
            .set('x-auth', dummyUsers[1].tokens[0].token)
            .expect(200)
            .expect((res) => {
                expect(res.body.todo._id).toBe(hexID);
            })
            .end((err, res) => {
                if (err)
                { return done(err); }

                Todo.find({ _id: hexID }).then((doc) => {
                    expect(doc.type).toBe(undefined);
                    done();
                }).catch((e) => done(e));
            });
    });
    it('should return 400 so other user cant delete eachothers todos', (done) => {

        var hexID = dummyTodos[1]._id.toHexString();
        request(app)
            .delete(`/todos/${hexID}`)
            .set('x-auth', dummyUsers[0].tokens[0].token)
            .expect(404)
            .end(done);
    });

    it('should return 400 is invalid', (done) => {

        request(app)
            .delete(`/todos/asd`)
            .set('x-auth', dummyUsers[1].tokens[0].token)
            .expect(400)
            .end(done);
    });
    it('should return 404 if objectID was not found', (done) => {

        request(app)
            .delete(`/todos/${new ObjectID()}`)
            .set('x-auth', dummyUsers[1].tokens[0].token)
            .expect(404)
            .end(done);
    });
});

describe('UPDATE /todos/:id', () => {

    it('should update todo objects', (done) => {

        var hexID = dummyTodos[1]._id.toHexString();
        var body = { text: "update to this", completed: true };

        request(app)
            .patch(`/todos/${hexID}`)
            .set('x-auth', dummyUsers[1].tokens[0].token)
            .send(body)
            .expect(200)
            .expect((res) => {
                expect(res.body.text).toBe(body.text);
            }).end((err, res) => {

                Todo.find({ text: body.text }).then((todos) => {
                    expect(todos.length).toBe(1);
                    expect(todos[0].text).toBe(body.text);
                    return done();
                }).catch((e) => done(e));
            });
    });

    it('should not update others todo object', (done) => {

        var hexID = dummyTodos[1]._id.toHexString();
        var body = { text: "update to this", completed: true };

        request(app)
            .patch(`/todos/${hexID}`)
            .set('x-auth', dummyUsers[0].tokens[0].token)
            .send(body)
            .expect(401)
            .end(done);
    });

    it('should 404 todo not found', (done) => {

        var hexID = new ObjectID().toHexString();
        var body = { text: "update to this", completed: true };

        request(app)
            .patch(`/todos/${hexID}`)
            .set('x-auth', dummyUsers[0].tokens[0].token)
            .send(body)
            .expect(404)
            .end(done);
    });

    it('should clear completedAt when todo is not completed', (done) => {

        var hexID = dummyTodos[2]._id.toHexString();
        var body = { completed: false };

        request(app)
            .patch(`/todos/${hexID}`)
            .set('x-auth', dummyUsers[2].tokens[0].token)
            .send(body)
            .expect(200)
            .end(() => {

                Todo.find({ _id: hexID }).then((todos) => {
                    expect(todos.length).toBe(1);
                    expect(todos[0].completedAt).toBe(null);
                    return done();
                }).catch((e) => done(e));
            });
    });
});

describe('POST /register', () => {

    it('should create a new user', (done) => {
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

                User.find({ email }).then((users) => {
                    expect(users.length).toBe(1);
                    expect(users[0].email).toBe(email);
                    expect(users.password).toNotBe(dummyUsers[0].password);
                    return done();
                }).catch((e) => done(e));
            });
    });

    it('should not create user with an existing email', (done) => {

        var email = dummyUsers[0].email;;
        var password = 'vallidpw';

        request(app)
            .post('/register')
            .send({ email, password })
            .expect(400)
            .end((err, res) => {
                if (err) {
                    return done(err);
                }

                Todo.find().then((todos) => {
                    expect(todos.length).toBe(3);
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

                Todo.find().then((todos) => {
                    expect(todos.length).toBe(3);
                    done();
                }).catch((e) => done(e));
            });
    });
    it('should not create user without a password', (done) => {

        var email = dummyUsers[0].email;

        request(app)
            .post('/register')
            .send({ email })
            .expect(400)
            .end((err, res) => {
                if (err) {
                    return done(err);
                }

                Todo.find().then((todos) => {
                    expect(todos.length).toBe(3);
                    done();
                }).catch((e) => done(e));
            });
    });

});

describe('GET /users', () => {

    it('should return all user objects', (done) => {

        request(app)
            .get('/users')
            .expect(200)
            .expect((res) => {
                User.find().then(() => {
                    expect(res.body.users.length).toBe(3);
                });
            })
            .end(done);
    });
});

describe('GET /me', () => {

    it('should return me as a user', (done) => {

        var base = { 'x-auth': dummyUsers[0].tokens[0].token };

        request(app)
            .get('/me')
            .set(base)
            .expect(200)
            .expect((res) => {
                expect(res.body.email).toBe(dummyUsers[0].email);
                expect(res.body._id).toBe(dummyUsers[0]._id.toHexString());
            })
            .end(done);
    });

    it('should return a 401', (done) => {

        var base = { 'x-auth': '' };

        request(app)
            .get('/me')
            .set(base)
            .expect(401)
            .expect((res) => {
                expect(res.body).toEqual({});
            })
            .end(done);
    });

    it('should hash the password', (done) => {

        var email = dummyUsers[0].email;
        var base = { 'x-auth': dummyUsers[0].tokens[0].token };
        
        request(app)
            .get('/me')
            .set(base)
            .expect(200)
            .end((err, res) => {
                if (err) {
                    return done(err);
                }

                User.find({ email }).then((user) => {
                    expect(user.password).toNotBe(dummyUsers[0].password);
                    done();
                }).catch((e) => done(e));
            });
    });

});

describe('GET /login', () => {


    it('should return me as a user', (done) => {

        request(app)
            .post('/login')
            .send({ email: dummyUsers[0].email, password: dummyUsers[0].password })
            .expect(200)
            .expect((res) => {
                expect(res.header['x-auth']).toExist();
            })
            .end((err, res) => {
                if (err) {
                    return done(err);
                }
                User.findById(dummyUsers[0]._id.toHexString()).then((user) => {
                    expect(user.tokens[1]).toInclude({ access: 'auth', token: res.header['x-auth'] });
                    done();
                }).catch((e) => done(e));
            });
    });


    it('should return a 400 because wrong email', (done) => {

        request(app)
            .post('/login')
            .send({ email: dummyUsers[0].email + '4', password: dummyUsers[0].password })
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
            .send({ email: dummyUsers[0].email, password: dummyUsers[0].password + '4' })
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

        var base = { 'x-auth': dummyUsers[1].tokens[0].token };

        request(app)
            .get('/me/logout')
            .set(base)
            .expect(200)
            .end((err, res) => {
                if (err) {
                    return done(err);
                }
                User.findById(dummyUsers[1]._id.toHexString()).then((user) => {
                    expect(user.tokens).toEqual([]);
                    done();
                }).catch((e) => done(e));
            });
    });
});


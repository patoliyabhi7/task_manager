const appError = require('./../utils/appError.js')
const catchAsync = require('./../utils/catchAsync.js')
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt')
const connection = require('../server.js');

exports.signup = catchAsync(async (req, res, next) => {
    const { name, email, password, confirmPassword, role } = req.body;
    if (!name || !email || !password || !confirmPassword || !role) {
        return next(new appError('Please provide all the details', 400));
    }
    if (password !== confirmPassword) {
        return next(new appError('Password and confirm password do not match', 400));
    }
    const pass = await bcrypt.hash(password, 12);
    let sql = `INSERT INTO users(name, email, password, role) VALUES('${name}', '${email}', '${pass}', '${role}')`;  // Note: Table name should be 'userss' as defined in 'usertable.js'
    connection.query(sql, (err, result) => {
        if (err) {
            return next(new appError(err, 400));
        }
        res.status(201).json({
            status: 'success',
            message: 'User created successfully'
        });
    });
});
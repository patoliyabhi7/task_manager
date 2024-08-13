const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const appError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');

const signToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN,
    });
};

const createSendToken = (user, statusCode, res) => {
    const token = signToken(user.id);
    const cookieOptions = {
        expires: new Date(
            Date.now() + process.env.JWT_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000
        ),
        secure: true,
        httpOnly: true,
    };
    res.cookie('jwt', token, cookieOptions);

    user.password = undefined;
    res.status(statusCode).json({
        status: 'success',
        token,
        data: {
            user,
        },
    });
};

exports.verifyJWT = async (req, res, next) => {
    try {
        let token;
        const db = req.db;

        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith("Bearer ")) {
            token = authHeader.split(" ")[1];
        } else if (req.cookies?.jwt) {
            token = req.cookies.jwt;
        }

        if (!token) {
            return res.status(401).json({ message: "User not logged in or Unauthorized request" });
        }

        const decodedToken = jwt.verify(token, process.env.JWT_SECRET);

        const [rows] = await db.query('SELECT * FROM users WHERE id = ?', [decodedToken.id]);

        if (rows.length === 0) {
            return res.status(404).json({ message: "User not found" });
        }

        const user = rows[0];

        delete user.password;

        req.user = user;
        next();
    } catch (error) {
        console.error(error);
        res.status(401).json({ message: "Invalid access token" });
    }
};

exports.signup = catchAsync(async (req, res, next) => {
    const { name, email, password, confirmPassword, role } = req.body;
    if (!name || !email || !password || !confirmPassword || !role) {
        return next(new appError('Please provide all the details', 400));
    }
    if (password !== confirmPassword) {
        return next(new appError('Password and confirm password do not match', 400));
    }

    const db = req.db;

    const query = 'SELECT * FROM users WHERE email = ?';
    db.query(query, [name, email, password, role], (err, results) => {
        if (err) {
            return res.status(500).json({ message: err });
        }

        if (results.length > 0) {
            return res.status(409).json({ message: 'Username or Email already exists' });
        }

        bcrypt.hash(password, 10, (err, hash) => {
            if (err) {
                return res.status(500).json({ message: 'Error hashing password' });
            }

            // Insert the new user into the database
            const insertQuery = 'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)';
            db.query(insertQuery, [name, email, hash, role], (err, result) => {
                if (err) {
                    return res.status(500).json({ message: err });
                }

                res.status(201).json({ message: 'User created successfully', userId: result.insertId });
            });
        });
    });
});

exports.login = catchAsync(async (req, res, next) => {
    const db = req.db;
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({
            status: 'Failed',
            message: 'Please enter email and password'
        });
    }

    const findUserQuery = 'SELECT * FROM users WHERE email = ?';
    const [rows] = await db.query(findUserQuery, [email]);

    if (rows.length === 0) {
        return res.status(404).json({
            status: 'Failed',
            message: 'User not found'
        });
    }

    const user = rows[0];

    const isPasswordCorrect = await bcrypt.compare(password, user.password);
    if (!isPasswordCorrect) {
        return res.status(401).json({
            status: 'Failed',
            message: 'Invalid email or password'
        });
    }

    createSendToken(user, 200, res);
});

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

exports.signup = (req, res) => {
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
};

exports.login = (req, res) => {
    // Example login logic
};

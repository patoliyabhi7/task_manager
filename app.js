const express = require('express');
const cookieParser = require('cookie-parser');
const mysql = require('mysql2/promise');
const userRouter = require('./routes/userRoutes');

const app = express();
app.use(express.json());
app.use(cookieParser());

// MySQL connection
mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'task_manager'
}).then((db) => {
    console.log('MySQL connected...');

    app.use((req, res, next) => {
        req.db = db;
        next();
    });

    app.get('/', (req, res) => {
        res.status(200).send("Welcome!!");
    });

    app.use('/api/v1/user', userRouter);

}).catch(err => {
    console.error('Database connection failed:', err.stack);
    process.exit(1); // Exit the process with failure
});

module.exports = app;

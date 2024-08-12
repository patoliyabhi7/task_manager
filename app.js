const express = require('express');
const cookieParser = require('cookie-parser');
const mysql = require('mysql2');
const userRouter = require('./routes/userRoutes');

const app = express();
app.use(express.json());
app.use(cookieParser());

// MySQL connection
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '', 
    database: 'task_manager'
});

db.connect(err => {
    if (err) {
        console.error('Database connection failed:', err.stack);
        return;
    }
    console.log('MySQL connected...');
});

app.use((req, res, next) => {
    req.db = db;
    next();
});

app.get('/', (req, res) => {
    res.status(200).send("Welcome!!");
});

app.use('/api/v1/user', userRouter);

module.exports = app;

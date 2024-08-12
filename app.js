const express = require('express');
const cookieParser = require('cookie-parser');
const userRouter = require('./routes/userRoutes.js');

const app = express();
app.use(express.json());
app.use(cookieParser())

app.get('/', (req,res)=>{
    res.status(200).send("Welcome!!")
})

app.use('/api/v1/user', userRouter)

module.exports = app;
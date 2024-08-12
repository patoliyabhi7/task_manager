const express = require('express');
const userController = require('./../controllers/userController.js')

const router = express.Router();

router.post('/signup', userController.signup)

module.exports = router;
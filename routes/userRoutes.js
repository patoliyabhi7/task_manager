const express = require('express');
const userController = require('../controllers/userController'); // Update the path if needed

const router = express.Router();

// Define user-related routes here
router.post('/signup', userController.signup);
router.post('/login', userController.login); // Example route

module.exports = router;

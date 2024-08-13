const express = require('express');
const userController = require('../controllers/userController'); 

const router = express.Router();

router.post('/signup', userController.signup);
router.post('/login', userController.login); 
router.post("/tasks", userController.verifyJWT, userController.createTask);
router.get("/tasks", userController.verifyJWT, userController.getTasks);
router.get("/tasks/:id", userController.verifyJWT, userController.getTaskById);
router.put("/tasks/:id", userController.verifyJWT, userController.updateTask);
router.delete("/tasks/:id", userController.verifyJWT, userController.deleteTask);

module.exports = router;

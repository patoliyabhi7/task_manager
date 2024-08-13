const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const appError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');
const cron = require('node-cron');
const sendEmail = require('./../utils/email');

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

exports.createTask = catchAsync(async (req, res, next) => {
    const db = req.db;
    if (!req.user.id) {
        return res.status(401).json({
            message: 'Unauthorized request'
        });
    }
    const { title, description, status, category, priority, deadline } = req.body;
    if (!title || !status || !category || !priority || !deadline) {
        return res.status(400).json({
            message: 'Please provide all the details'
        });
    }
    if(deadline < new Date()) {
        return res.status(400).json({
            message: 'Deadline must be of future date'
        });
    }
    if(status !== 'pending' && status !== 'in_progress' && status !== 'completed') {
        return res.status(400).json({
            message: 'Invalid status. Status must be either pending, in_progress or completed'
        });
    }
    if(priority !== 'low' && priority !== 'medium' && priority !== 'high') {
        return res.status(400).json({
            message: 'Invalid priority. Priority should be either low, medium or high'
        });
    }

    const query = 'INSERT INTO tasks (title, description, status, category, priority, deadline, user_id) VALUES (?, ?, ?, ?, ?, ?, ?)';
    const [result] = await db.query(query, [title, description, status, category, priority, deadline, req.user.id]);

    res.status(201).json({
        message: 'Task created successfully',
        task: { id: result.insertId, title, description, status, category, priority, deadline }
    });
});

exports.getTasks = catchAsync(async (req, res, next) => {
    const db = req.db;
    const filters = req.query;

    const { sort_by, order, page = 1, limit = 2 } = filters; // Default to page 1 and limit 10 if not provided

    let query = 'SELECT * FROM tasks WHERE user_id = ?';
    const queryParams = [req.user.id];

    const [rows] = await db.query(query, queryParams);

    const filteredTasks = rows.filter(user => {
        let isValid = true;
        for (const key in filters) {
            if (key !== 'sort_by' && key !== 'order' && key !== 'page' && key !== 'limit') {
                isValid = isValid && user[key] == filters[key];
            }
        }
        return isValid;
    });

    if (sort_by) {
        const validSortFields = ['deadline', 'priority', 'created_at'];
        if (validSortFields.includes(sort_by)) {
            const sortOrder = order && order.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
            filteredTasks.sort((a, b) => {
                if (sortOrder === 'ASC') {
                    return new Date(a[sort_by]) - new Date(b[sort_by]);
                } else {
                    return new Date(b[sort_by]) - new Date(a[sort_by]);
                }
            });
        }
    }

    // Pagination logic
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const paginatedTasks = filteredTasks.slice(startIndex, endIndex);

    res.status(200).json({
        message: 'Tasks fetched successfully',
        count: filteredTasks.length,
        page: parseInt(page),
        totalPages: Math.ceil(filteredTasks.length / limit),
        tasks: paginatedTasks
    });
});

exports.getTaskById = catchAsync(async (req, res, next) => {
    const db = req.db;
    const taskId = req.params.id;

    const query = 'SELECT * FROM tasks WHERE id = ?';
    const [rows] = await db.query(query, [taskId]);

    if (rows.length === 0) {
        return res.status(404).json({
            message: 'Task not found'
        });
    }

    res.status(200).json({
        message: 'Task fetched successfully',
        task: rows[0]
    });
});

exports.updateTask = catchAsync(async (req, res, next) => {
    const db = req.db;
    const userId = req.user.id;
    const userRole = req.user.role;
    const taskId = req.params.id;

    const [rows] = await db.query('SELECT * FROM tasks WHERE id = ?', [taskId]);

    if (rows.length === 0) {
        return res.status(404).json({
            message: 'Task not found'
        });
    }

    const task = rows[0];

    if (task.user_id !== userId && userRole !== 'admin') {
        return res.status(401).json({
            message: 'You are not authorized to update this task'
        });
    }

    const hstatus = req.body.status;
    const hpriority = req.body.priority;
    const hdeadline = req.body.deadline;

    const {
        title = task.title,
        description = task.description,
        status = task.status,
        category = task.category,
        priority = task.priority,
        deadline = task.deadline
    } = req.body;

    const query = 'UPDATE tasks SET title = ?, description = ?, status = ?, category = ?, priority = ?, deadline = ? WHERE id = ?';
    await db.query(query, [title, description, status, category, priority, deadline, taskId]);

    const query2 = 'INSERT INTO task_update_history (task_id, status, priority, deadline, changed_by) VALUES (?, ?, ?, ?, ?)';
    await db.query(query2, [taskId, hstatus, hpriority, hdeadline, userId]);

    res.status(200).json({
        message: 'Task updated successfully',
        task: { id: taskId, title, description, status, category, priority, deadline }
    });
});

exports.deleteTask = catchAsync(async (req, res, next) => {
    const db = req.db;
    const userId = req.user.id;
    const userRole = req.user.role;
    const taskId = req.params.id;

    const [rows] = await db.query('SELECT * FROM tasks WHERE id = ?', [taskId]);

    if (rows.length === 0) {
        return res.status(404).json({
            message: 'Task not found'
        });
    }

    const task = rows[0];

    if (task.user_id !== userId && userRole !== 'admin') {
        return res.status(401).json({
            message: 'You are not authorized to delete this task'
        });
    }

    await db.query('DELETE FROM tasks WHERE id = ?', [taskId]);

    res.status(204).json({
        message: 'Task deleted successfully'
    });
})

cron.schedule('* * * * * *', async (req,res,next) => {
    try {
        // console.log('Running a task every minute');
        const db = req.db;

        const [rows] = await db.query('SELECT * FROM tasks WHERE status IN ("pending", "in_progress")');
        console.log(rows);
        
        if (rows.length > 0) {
            for (const task of rows) {
                // await db.query('UPDATE tasks SET status = "overdue" WHERE id = ?', [task.id]);
                
                const [user] = await db.query('SELECT * FROM users WHERE id = ?', [task.user_id]);
                console.log(user);
            }
        }
    } catch (error) {
        console.error('Error running cron job:', error);
    }
});
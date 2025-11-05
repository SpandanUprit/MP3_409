const User = require('../models/user');
const Task = require('../models/task'); 

const sendResponse = (res, status, message, data = null) => {
    const response = { message };
    if (data) {
        response.data = data;
    }
    res.status(status).json(response);
};

exports.createUser = async (req, res) => {
    try {
        const { name, email } = req.body;
        if (!name || !email) {
            return sendResponse(res, 400, 'Name and email are required');
        }

        const newUser = new User(req.body);
        const savedUser = await newUser.save();
        sendResponse(res, 201, 'User created successfully', savedUser);

    } catch (err) {
        if (err.code === 11000) {
            return sendResponse(res, 400, 'Email already exists');
        }
        if (err.name === 'ValidationError') {
            return sendResponse(res, 400, err.message);
        }
        sendResponse(res, 500, 'Server error', err.message);
    }
};

exports.getUserById = async (req, res) => {
    try {
        const { id } = req.params;
        let query = User.findById(id);

        if (req.query.select) {
             query = query.select(JSON.parse(req.query.select));
        }

        const user = await query;

        if (!user) {
            return sendResponse(res, 404, 'User not found');
        }
        sendResponse(res, 200, 'OK', user);

    } catch (err) {
        if (err.name === 'CastError') {
            return sendResponse(res, 400, 'Invalid user ID format');
        }
        sendResponse(res, 500, 'Server error', err.message);
    }
};

exports.getAllUsers = async (req, res) => {
    try {
        let query = User.find();

        if (req.query.where) {
            query = query.where(JSON.parse(req.query.where));
        }

        if (req.query.sort) {
            query = query.sort(JSON.parse(req.query.sort));
        }

        if (req.query.select) {
            query = query.select(JSON.parse(req.query.select));
        }

        if (req.query.skip) {
            query = query.skip(parseInt(req.query.skip));
        }

        if (req.query.limit) {
            query = query.limit(parseInt(req.query.limit));
        }

        if (req.query.count === 'true') {
            const count = await query.countDocuments();
            return sendResponse(res, 200, 'OK (Count)', count);
        }

        const users = await query;
        sendResponse(res, 200, 'OK', users);

    } catch (err) {
        if (err instanceof SyntaxError) {
            return sendResponse(res, 400, 'Invalid JSON in query parameter');
        }
        sendResponse(res, 500, 'Server error', err.message);
    }
};

exports.updateUser = async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        const user = await User.findById(id);
        if (!user) {
            return sendResponse(res, 404, 'User not found');
        }

        if (updates.pendingTasks) {
            const oldTasks = user.pendingTasks;
            const newTasks = updates.pendingTasks;

            const tasksToAdd = newTasks.filter(t => !oldTasks.includes(t));
            const tasksToRemove = oldTasks.filter(t => !newTasks.includes(t));

            await Task.updateMany(
                { _id: { $in: tasksToRemove } },
                { assignedUser: "", assignedUserName: "unassigned" }
            );
            
            await Task.updateMany(
                { _id: { $in: tasksToAdd } },
                { assignedUser: user._id, assignedUserName: user.name }
            );
        }

        const updatedUser = await User.findByIdAndUpdate(id, updates, { new: true, runValidators: true });
        sendResponse(res, 200, 'User updated', updatedUser);

    } catch (err) {
        sendResponse(res, 500, 'Server error', err.message);
    }
};

exports.deleteUser = async (req, res) => {
    try {
        const { id } = req.params;
        const user = await User.findById(id);

        if (!user) {
            return sendResponse(res, 404, 'User not found');
        }

        if (user.pendingTasks && user.pendingTasks.length > 0) {
            await Task.updateMany(
                { _id: { $in: user.pendingTasks } },
                { assignedUser: "", assignedUserName: "unassigned" }
            );
        }

        await User.findByIdAndDelete(id);
        sendResponse(res, 204, 'User deleted');

    } catch (err) {
        sendResponse(res, 500, 'Server error', err.message);
    }
};

// ... Implement basic PUT and DELETE similarly ...
// exports.updateUser = async (req, res) => { ... }
// exports.deleteUser = async (req, res) => { ... }
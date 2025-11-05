const Task = require('../models/task');
const User = require('../models/user');

const sendResponse = (res, status, message, data = null) => {
    const response = { message };
    if (data !== null) {
        response.data = data;
    }
    res.status(status).json(response);
};

exports.createTask = async (req, res) => {
    try {
        const { name, deadline } = req.body;
        
        if (!name || !deadline) {
            return sendResponse(res, 400, 'Task name and deadline are required');
        }
        
        const newTask = new Task(req.body);

        if (newTask.assignedUser) {
            const user = await User.findById(newTask.assignedUser);
            
            if (!user) {
                newTask.assignedUser = "";
                newTask.assignedUserName = "unassigned";
            } else {
                newTask.assignedUserName = user.name;
                await User.updateOne(
                    { _id: user._id },
                    { $push: { pendingTasks: newTask._id } }
                );
            }
        }

        const savedTask = await newTask.save();
        sendResponse(res, 201, 'Task created successfully', savedTask);

    } catch (err) {
        if (err.name === 'ValidationError') {
            return sendResponse(res, 400, err.message);
        }
        sendResponse(res, 500, 'Server error while creating task', err.message);
    }
};

exports.getTaskById = async (req, res) => {
    try {
        const { id } = req.params;
        let query = Task.findById(id);

        if (req.query.select) {
            query = query.select(JSON.parse(req.query.select));
        }

        const task = await query;

        if (!task) {
            return sendResponse(res, 404, 'Task not found');
        }
        sendResponse(res, 200, 'Task retrieved successfully', task);

    } catch (err) {
        if (err.name === 'CastError') {
            return sendResponse(res, 400, 'Invalid Task ID format');
        }
        sendResponse(res, 500, 'Server error while retrieving task', err.message);
    }
};

exports.updateTask = async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        const task = await Task.findById(id);
        if (!task) {
            return sendResponse(res, 404, 'Task not found');
        }

        const oldUserId = task.assignedUser;
        const newUserId = updates.assignedUser;

        if (newUserId && oldUserId !== newUserId) {
            const newUser = await User.findById(newUserId);
            if (!newUser) {
                return sendResponse(res, 404, 'Assigned user not found');
            }
            
            await User.updateOne(
                { _id: newUserId },
                { $push: { pendingTasks: task._id } }
            );
            
            updates.assignedUserName = newUser.name;

            if (oldUserId) {
                await User.updateOne(
                    { _id: oldUserId },
                    { $pull: { pendingTasks: task._id } }
                );
            }
        } 
        else if (newUserId === "" && oldUserId) {
            await User.updateOne(
                { _id: oldUserId },
                { $pull: { pendingTasks: task._id } }
            );
            updates.assignedUserName = "unassigned";
        }

        const updatedTask = await Task.findByIdAndUpdate(id, updates, { 
            new: true,
            runValidators: true 
        });

        sendResponse(res, 200, 'Task updated successfully', updatedTask);

    } catch (err) {
        if (err.name === 'ValidationError') {
            return sendResponse(res, 400, err.message);
        }
        if (err.name === 'CastError') {
            return sendResponse(res, 400, 'Invalid Task ID format');
        }
        sendResponse(res, 500, 'Server error while updating task', err.message);
    }
};

exports.deleteTask = async (req, res) => {
    try {
        const { id } = req.params;
        
        const task = await Task.findById(id);
        if (!task) {
            return sendResponse(res, 404, 'Task not found');
        }

        if (task.assignedUser) {
            await User.updateOne(
                { _id: task.assignedUser },
                { $pull: { pendingTasks: task._id } }
            );
        }

        await Task.findByIdAndDelete(id);
        sendResponse(res, 204, 'Task deleted successfully');

    } catch (err) {
        if (err.name === 'CastError') {
            return sendResponse(res, 400, 'Invalid Task ID format');
        }
        sendResponse(res, 500, 'Server error while deleting task', err.message);
    }
};

exports.getAllTasks = async (req, res) => {
    try {
        let query = Task.find();

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
        } else {
            query = query.limit(100);
        }

        if (req.query.count === 'true') {
            const count = await query.countDocuments();
            return sendResponse(res, 200, 'OK (Count)', count);
        }

        const tasks = await query;
        sendResponse(res, 200, 'OK', tasks);

    } catch (err) {
        if (err instanceof SyntaxError) {
            return sendResponse(res, 400, 'Invalid JSON in query parameter');
        }
        sendResponse(res, 500, 'Server error', err.message);
    }
};
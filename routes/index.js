const userRoutes = require('./users');
const taskRoutes = require('./tasks');

module.exports = function(app, router) {

  app.use('/api/users', userRoutes);

  app.use('/api/tasks', taskRoutes);

};
const mysql = require('mysql');
const dotenv = require('dotenv');
const app = require('./app');

dotenv.config({ path: './.env' });

const connection = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'task_manager'
});
connection.connect((err) => {
  if (err) {
    console.error('Database connection failed: ' + err);
    return;
  }
  console.log('Connected to database.');
});
module.exports = connection;

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`App running on port ${port}`);
})
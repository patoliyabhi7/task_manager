const con = require('../server.js');

const sql = "CREATE TABLE if not exists users( id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(255) not null, email VARCHAR(255) not null unique, password VARCHAR(255) not null, role ENUM('admin','user') not null)";
con.query(sql, (err, result) => {
    if (err) {
        console.log(err);
    }
    console.log('User DB Created');
});
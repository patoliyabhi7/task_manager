const cron = require('node-cron');
const sendEmail = require('./../utils/email');

module.exports = (db) => {
    cron.schedule('0 * * * *', async () => {
        try {
            const [rows] = await db.query(`
                SELECT * FROM tasks 
                WHERE status IN ('pending', 'in_progress') 
                AND deadline <= DATE_ADD(NOW(), INTERVAL 2 DAY)
            `);

            if (rows.length > 0) {
                for (const task of rows) {
                    await db.query('UPDATE tasks SET status = "overdue" WHERE id = ?', [task.id]);

                    const [userMail] = await db.query('SELECT email FROM users WHERE id = ?', [task.user_id]);

                    await sendEmail({
                        email: userMail[0].email,
                        cc: "admin@gmail.com",
                        subject: 'Task Overdue',
                        message: `Task: ${task.title} with id ${task.id} is overdue.`
                    });
                }
            }
        } catch (error) {
            console.error('Error running cron job:', error);
        }
    });
};

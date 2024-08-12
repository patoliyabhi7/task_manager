const app = require('./app'); // Assuming your main file is named `app.js`

const PORT = process.env.PORT || 8000;

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

// Load environment variables from .env file in development
try {
    require('dotenv').config();
} catch (error) {
    console.log('dotenv not loaded, assuming environment variables are set');
}

module.exports = {
    getDbConnectionString: function () {
        const dbName = 'tutorScotland';

        // Try to use the new environment variable names first (for Vercel)
        const username = process.env.MONGODB_USERNAME || process.env.uname;
        const password = process.env.MONGODB_PASSWORD || process.env.pwd;

        if (!username || !password) {
            throw new Error('Database credentials not found in environment variables');
        }

        return `mongodb+srv://${username}:${password}@cluster0.ntuqn.mongodb.net/${dbName}?retryWrites=true&w=majority`;
    }
}

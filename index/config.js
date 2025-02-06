require('dotenv').config();

module.exports = {
    getDbConnectionString: function () {
        const dbName = 'tutorScotland';

        return `mongodb+srv://${process.env.uname}:${process.env.pwd}@cluster0.ntuqn.mongodb.net/${dbName}?retryWrites=true&w=majority`;
    }
}

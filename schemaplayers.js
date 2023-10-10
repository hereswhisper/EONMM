const mongoose = require('mongoose');

const playersSchema = new mongoose.Schema({
    sessionId: {
        type: String,
        required: false
    },
    uniqueId: {
        type: String,
        required: false
    },
    ip: {
        type: String,
        required: false
    },
    port: {
        type: String,
        required: false
    },
    
});

module.exports = mongoose.model('players', playersSchema);
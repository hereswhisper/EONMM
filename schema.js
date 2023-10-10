const mongoose = require('mongoose');

const gameServerSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    region: {
        type: String,
        required: true
    },
    playlist: {
        type: String,
        required: true
    },
    playerCount: {
        type: Number,
        required: true
    },
    IP: {
        type: String,
        required: true
    },
    Port: {
        type: String,
        required: true
    },
    status: {
        type: String,
        required: true
    }
});

module.exports = mongoose.model('gameservers', gameServerSchema);
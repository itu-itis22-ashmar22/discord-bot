// models/Activity.js
const mongoose = require('mongoose');

const activitySchema = new mongoose.Schema({
    UserID: {
        type: String,
        required: true
    },
    Username: {
        type: String,  // New field for username
        required: true
    },
    ChannelID: {
        type: String,
        required: true
    },
    JoinTime: {
        type: Number,
        required: true
    },
    LeftTime: {
        type: Number,
        default: null
    }
});

const Activity = mongoose.model('Activity', activitySchema);

module.exports = Activity;

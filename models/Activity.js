const mongoose = require('mongoose');

const activitySchema = new mongoose.Schema({
    UserID: {
        type: String,
        required: true
    },
    Username: {
        type: String,
        required: true
    },
    ChannelID: {
        type: String,
        required: true
    },
    ChannelName: {  // Add this new field to store the channel name
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
    },
    TimeSpent: {
        type: String,  // Store in HH:MM:SS format
        default: '00:00:00'
    },
    TotalTime: {
        type: String,  // Store in HH:MM:SS format
        default: '00:00:00'
    },
    Date: {
        type: String,  // Human-readable date (YYYY-MM-DD)
        required: true
    }
});

const Activity = mongoose.model('Activity', activitySchema);

module.exports = Activity;

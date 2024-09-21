const mongoose = require('mongoose');

// Function to dynamically return the model based on the username
function getActivityModel(username) {
    const modelName = `${username}_activities`;  // Model name based on the username

    // Check if the model is already compiled
    if (mongoose.models[modelName]) {
        return mongoose.models[modelName];  // Return the existing model
    }

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
        ChannelName: {
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
            type: String,
            default: '00:00:00'
        },
        TotalTime: {
            type: String,
            default: '00:00:00'
        },
        Date: {
            type: String,
            required: true
        }
    });

    // Return the new model if it's not already compiled
    return mongoose.model(modelName, activitySchema);
}

module.exports = getActivityModel;

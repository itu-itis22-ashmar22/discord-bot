const { Client, GatewayIntentBits, REST, Routes } = require('discord.js');
const mongoose = require('mongoose');
const chalk = require('chalk');
const figlet = require('figlet');
require('dotenv').config();

// Import Activity schema
const getActivityModel = require('./Activity');

// Create the Discord client
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildVoiceStates,
    ]
});

// Connect to MongoDB
mongoose.connect(process.env.DB_HOST, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
}).then(() => {
    console.log('Connected to MongoDB');
}).catch(err => {
    console.error('MongoDB connection error:', err);
});

// Register slash commands
const commands = [
    {
        name: 'messages',
        description: 'Check the number of messages you have sent',
    },
    {
        name: 'time',
        description: 'Check how much time you have spent in voice channels',
        options: [
            {
                name: 'user',
                description: 'The user to check',
                type: 6, // Type 6 is for USER in Discord's API
                required: false, // Make this optional
            },
            {
                name: 'channel',
                description: 'The voice channel to check',
                type: 7, // Type 7 is for CHANNEL in Discord's API
                required: false, // Make this optional
            }
        ]
    },
    {
        name: 'help',
        description: 'Get a list of available commands',
    },
];

const rest = new REST({ version: '10' }).setToken(process.env.BOT_TOKEN);

(async () => {
    try {
        console.log('Started refreshing application (/) commands.');

        await rest.put(
            Routes.applicationCommands(process.env.CLIENT_ID),
            { body: commands },
        );

        console.log('Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error(error);
    }
})();

// Unix time function
function Time() {
    return Math.floor(new Date().getTime() / 1000);
}

// Bot ready event
client.on('ready', async () => {
    console.log('─────────────────────────────────────────────');
    console.log(chalk.green(figlet.textSync('TimeSpent', { horizontalLayout: 'full' }) + ' ShiNxz#0001'));
    console.log('─────────────────────────────────────────────');
    console.log(chalk.red(`Bot started!\n---\n
        > Users: ${client.users.cache.size}\n
        > Channels: ${client.channels.cache.size}\n
        > Servers: ${client.guilds.cache.size}`));
    console.log('─────────────────────────────────────────────');
    client.user.setActivity('/commands', { type: 'LISTENING' });
});

// Slash command handler
client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand()) return;

    const { commandName } = interaction;
    const options = interaction.options;

    if (commandName === 'time') {
        let user = options.getUser('user') || interaction.user;
        let channel = options.getChannel('channel');

        let query = { UserID: user.id, LeftTime: { $gt: 1 } };
        if (channel) {
            query.ChannelID = channel.id;
        }

        try {
            const Activity = getActivityModel(user.username); // Get the dynamic model based on the username
            const activities = await Activity.find(query);
            
            if (activities.length > 0) {
                let total = 0;
                activities.forEach(activity => {
                    total += (activity.LeftTime - activity.JoinTime);
                });
                total = new Date(total * 1000).toISOString().substr(11, 8);
                interaction.reply(`${user.username} has spent ${total} in ${channel ? `#${channel.name}` : 'all channels'}.`);
            } else {
                interaction.reply(`${user.username} has spent 00:00:00 in ${channel ? `#${channel.name}` : 'all channels'}.`);
            }
        } catch (err) {
            console.error(err);
            interaction.reply('An error occurred while retrieving time data.');
        }
    }
});

// Helper function to convert seconds into HH:MM:SS format
function formatTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;

    return [
        hours.toString().padStart(2, '0'),
        minutes.toString().padStart(2, '0'),
        remainingSeconds.toString().padStart(2, '0')
    ].join(':');
}

// Function to get total accumulated time for a user in a specific channel
async function getTotalTimeForChannel(userID, channelID, Activity) {
    const activities = await Activity.find({ UserID: userID, ChannelID: channelID, LeftTime: { $gt: 1 } });

    let totalSeconds = 0;
    activities.forEach(activity => {
        const joinTime = activity.JoinTime;
        const leftTime = activity.LeftTime || Time();  // If still in the channel, consider the current time
        totalSeconds += (leftTime - joinTime);
    });

    return totalSeconds;
}

// Handle voice state updates
client.on('voiceStateUpdate', async (oldMember, newMember) => {
    const specificChannelID = "1285208699056685129";  // The specific channel ID you want to track
    const newUserChannel = newMember.channelId;
    const oldUserChannel = oldMember.channelId;

    if (newUserChannel === oldUserChannel) return;  // No change in channel

    // Only process activity for the specific channel
    if (newUserChannel !== specificChannelID && oldUserChannel !== specificChannelID) {
        return;  // Skip activity if it's not the specific channel
    }

    try {
        const userObject = await client.users.fetch(newMember.id);
        const currentDate = new Date().toISOString().split('T')[0];
        const username = userObject.username;  // Get the username dynamically
        const Activity = getActivityModel(username);  // Use the dynamic model

        if (oldUserChannel == null && newUserChannel != null) {
            // User joined a voice channel, create a new entry in the database
            if (newUserChannel === specificChannelID) {
                const channel = await client.channels.fetch(newUserChannel);  // Fetch channel information
                const newActivity = new Activity({
                    UserID: newMember.id,
                    Username: userObject.tag,
                    ChannelID: newUserChannel,
                ChannelName: channel.name,  // Store the name of the channel
                    JoinTime: Time(),
                    Date: currentDate
                });
                await newActivity.save();
            }
        } else if (newUserChannel == null) {
            // User left a voice channel, calculate the time spent in the specific channel
            if (oldUserChannel === specificChannelID) {
                const lastActivity = await Activity.findOne({ UserID: oldMember.id, ChannelID: oldUserChannel }).sort({ _id: -1 });
                if (lastActivity) {
                    const leftTime = Time();
                    const timeSpentInSeconds = leftTime - lastActivity.JoinTime;
                    const timeSpentFormatted = formatTime(timeSpentInSeconds);

                    lastActivity.LeftTime = leftTime;
                    lastActivity.TimeSpent = timeSpentFormatted;

                    // Calculate the total accumulated time for this user in the specific channel
                    const totalTimeInSeconds = await getTotalTimeForChannel(oldMember.id, oldUserChannel, Activity);
                    const totalTimeFormatted = formatTime(totalTimeInSeconds + timeSpentInSeconds);

                    lastActivity.TotalTime = totalTimeFormatted;

                    await lastActivity.save();

                    console.log(`Total time for user ${userObject.tag} in channel ${lastActivity.ChannelName} is now ${totalTimeFormatted}`);
                }
            }
        } else {
            // User switched from one voice channel to another
            if (newUserChannel === specificChannelID) {
                const channel = await client.channels.fetch(newUserChannel);  // Fetch channel information
                const newActivity = new Activity({
                    UserID: newMember.id,
                    Username: userObject.tag,
                    ChannelID: newUserChannel,
                ChannelName: channel.name,  // Store the name of the channel
                    JoinTime: Time(),
                    Date: currentDate
                });
                await newActivity.save();
            }

            if (oldUserChannel === specificChannelID) {
                const lastActivity = await Activity.findOne({ UserID: oldMember.id, ChannelID: oldUserChannel }).sort({ _id: -1 });
                if (lastActivity) {
                    const leftTime = Time();
                    const timeSpentInSeconds = leftTime - lastActivity.JoinTime;
                    const timeSpentFormatted = formatTime(timeSpentInSeconds);
                    lastActivity.LeftTime = leftTime;
                    lastActivity.TimeSpent = timeSpentFormatted;

                    const totalTimeInSeconds = await getTotalTimeForChannel(oldMember.id, oldUserChannel, Activity);
                    const totalTimeFormatted = formatTime(totalTimeInSeconds + timeSpentInSeconds);

                    lastActivity.TotalTime = totalTimeFormatted;

                    await lastActivity.save();

                    console.log(`Total time for user ${userObject.tag} in channel ${lastActivity.ChannelName} is now ${totalTimeFormatted}`);
                }
            }
        }
    } catch (err) {
        console.error('Error updating voice activity in the database:', err);
    }
});

// Unix time function to get the current timestamp in seconds
function Time() {
    return Math.floor(new Date().getTime() / 1000);  // Unix timestamp in seconds
}

client.login(process.env.BOT_TOKEN);

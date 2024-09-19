const { Client, GatewayIntentBits, REST, Routes } = require('discord.js');
const mongoose = require('mongoose');
const chalk = require('chalk');
const figlet = require('figlet');
require('dotenv').config();

// Import Activity schema
const Activity = require('./models/Activity');

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

// Handle voice state updates
client.on('voiceStateUpdate', async (oldMember, newMember) => {
    const newUserChannel = newMember.channelId;
    const oldUserChannel = oldMember.channelId;

    if (newUserChannel === oldUserChannel) return;

    try {
        if (oldUserChannel == null && newUserChannel != null) {
            const newActivity = new Activity({
                UserID: newMember.id,
                ChannelID: newUserChannel,
                JoinTime: Time()
            });
            await newActivity.save();
        } else if (newUserChannel == null) {
            const lastActivity = await Activity.findOne({ UserID: oldMember.id, ChannelID: oldUserChannel }).sort({ _id: -1 });
            if (lastActivity) {
                lastActivity.LeftTime = Time();
                await lastActivity.save();
            }
        } else {
            const newActivity = new Activity({
                UserID: newMember.id,
                ChannelID: newUserChannel,
                JoinTime: Time()
            });
            await newActivity.save();

            const lastActivity = await Activity.findOne({ UserID: oldMember.id, ChannelID: oldUserChannel }).sort({ _id: -1 });
            if (lastActivity) {
                lastActivity.LeftTime = Time();
                await lastActivity.save();
            }
        }
    } catch (err) {
        console.error('Error updating voice activity:', err);
    }
});

client.login(process.env.BOT_TOKEN);

const { Client, GatewayIntentBits, REST, Routes } = require('discord.js');
const mysql = require("mysql2");
const chalk = require("chalk");
const figlet = require("figlet");
require('dotenv').config();

// Create the Discord client
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildVoiceStates,
    ]
});

// Database Connection
var conn = mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'your_mysql_password_here',
    database: process.env.DB_DATABASE || 'discord_voice_time'
});

conn.connect((err) => {
    if (err) {
        console.error('Database connection failed:', err.stack);
        return;
    }
    console.log('Connected to MySQL database.');
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
client.on('ready', () => {
    console.log('─────────────────────────────────────────────');
    console.log(chalk.green(figlet.textSync('TimeSpent', { horizontalLayout: 'full' }) + ' ShiNxz#0001'));
    console.log('─────────────────────────────────────────────');
    console.log(chalk.red(`Bot started!\n---\n
        > Users: ${client.users.cache.size}\n
        > Channels: ${client.channels.cache.size}\n
        > Servers: ${client.guilds.cache.size}`));
    console.log('─────────────────────────────────────────────');
    client.user.setActivity('/commands', { type: 'LISTENING' });

    // Check Databases and create tables if needed
    conn.query("SHOW TABLES LIKE 'Msgs'", (err, rows) => {
        if (err) throw err;
        if (rows.length < 1) {
            conn.query("CREATE TABLE Msgs (UserID varchar(30) NOT NULL, Msgs int(11) DEFAULT 1) ENGINE=InnoDB DEFAULT CHARSET=latin1;", (err) => {
                if (err) throw err;
                console.log("- Msgs Database Built.");
            });
        } else {
            console.log("- Msgs Database Exists.");
        }
    });

    conn.query("SHOW TABLES LIKE 'Activity'", (err, rows) => {
        if (err) throw err;
        if (rows.length < 1) {
            conn.query("CREATE TABLE Activity (ID int(11) NOT NULL, UserID varchar(30) NOT NULL, ChannelID varchar(25) NOT NULL, JoinTime int(11) NOT NULL, LeftTime int(11) DEFAULT NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;", (err) => {
                if (err) throw err;
                conn.query("ALTER TABLE Activity ADD PRIMARY KEY (ID);", (err) => {
                    if (err) throw err;
                    conn.query("ALTER TABLE Activity MODIFY ID int(11) NOT NULL AUTO_INCREMENT;", (err) => {
                        if (err) throw err;
                        console.log("- Activity Database Built.");
                    });
                });
            });
        } else {
            console.log("- Activity Database Exists.");
        }
    });
});

// Slash command handler
client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand()) return;

    const { commandName } = interaction;
    const options = interaction.options;

    if (commandName === 'time') {
        // Get the specified user or default to the interaction user
        let user = options.getUser('user') || interaction.user;

        // Get the specified channel or leave undefined (to check all channels)
        let channel = options.getChannel('channel');

        // Construct the SQL query based on whether a channel is specified
        let query = `SELECT * FROM Activity WHERE UserID = '${user.id}' AND LeftTime > 1`;
        if (channel) {
            query += ` AND ChannelID = '${channel.id}'`; // Only check the specified channel
        }

        conn.query(query, (err, rows) => {
            if (err) throw err;
            if (rows.length > 0) {
                let total = 0;
                rows.forEach(row => {
                    total = total + (row.LeftTime - row.JoinTime);
                });
                total = new Date(total * 1000).toISOString().substr(11, 8);
                interaction.reply(`${user.username} has spent ${total} in ${channel ? `#${channel.name}` : 'all channels'}.`);
            } else {
                interaction.reply(`${user.username} has spent 00:00:00 in ${channel ? `#${channel.name}` : 'all channels'}.`);
            }
        });
    }
});

// Handle voice state updates
client.on('voiceStateUpdate', async (oldMember, newMember) => {
    console.log('Voice state updated!'); 
    const newUserChannel = newMember.channelId;
    const oldUserChannel = oldMember.channelId;

    if (newUserChannel === oldUserChannel) return;

    if (oldUserChannel != newUserChannel) {
        if (oldUserChannel == null) {
            conn.query(`INSERT INTO Activity (UserID, ChannelID, JoinTime) VALUES ('${newMember.id}', '${newUserChannel}', '${Time()}');`, (err) => {
                if (err) throw err;
            });
        } else if (newUserChannel == null) {
            conn.query(`SELECT ID FROM Activity WHERE UserID = '${oldMember.id}' AND ChannelID = '${oldUserChannel}' ORDER BY ID DESC`, (err, rows) => {
                if (err) throw err;
                if (rows.length > 0) {
                    conn.query(`UPDATE Activity SET LeftTime = '${Time()}' WHERE ID = ${rows[0].ID}`, (err) => {
                        if (err) throw err;
                    });
                }
            });
        } else {
            conn.query(`INSERT INTO Activity (UserID, ChannelID, JoinTime) VALUES ('${newMember.id}', '${newUserChannel}', '${Time()}');`, (err) => {
                if (err) throw err;
            });
            conn.query(`SELECT ID FROM Activity WHERE UserID = '${oldMember.id}' AND ChannelID = '${oldUserChannel}' ORDER BY ID DESC`, (err, rows) => {
                if (err) throw err;
                if (rows.length > 0) {
                    conn.query(`UPDATE Activity SET LeftTime = '${Time()}' WHERE ID = ${rows[0].ID}`, (err) => {
                        if (err) throw err;
                    });
                }
            });
        }
    }
});

client.login(process.env.BOT_TOKEN);

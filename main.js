const { token } = require('./config.json');
const { Client, Events, GatewayIntentBits, SlashCommandBuilder, IntentsBitField, GuildChannelManager, AttachmentBuilder, EmbedBuilder } = require('discord.js');


const packageJSON = require("./package.json");

const client = new Client({ intents: [
    GatewayIntentBits.Guilds, 
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildEmojisAndStickers
]});

client.once(Events.ClientReady, c=> {
    console.log(`Logged in as ${c.user.tag}`);
});

//Command prefix for PoliteBot
const cmdprefix = "!pb ";

//ending suffix for text channel to be valid (politebot allowed to post there)
const postsuffix = "pb";

//Function to return an array of all channel IDs whose name ends with "pb". Checks the server of message param
function getAllValidChIDs(msgIN){
    const guild = msgIN.guild;
    const channelsRaw = guild.channels;

    const allChanIDs = Array.from(channelsRaw.cache.keys());

    var validChanIDs = [];
    chanObj = client.channels.cache.get(allChanIDs[0]);

    for (x of allChanIDs){
        chanObj = client.channels.cache.get(x);
        if (chanObj.name.endsWith(postsuffix)) validChanIDs.push(x);
    }

    return validChanIDs;
}

//Function to get a channel object by channel ID#. Checks the server of message param
function getChannelByID(msgIN, chanID){
    const guild = msgIN.guild;
    return guild.channels.cache.get(chanID);
}

//Function to check if a channel exists by ID. Checks the server of message param
function doesChannelExist(msgIN, channelId) {
    const guild = msgIN.guild;
    return !!guild.channels.cache.get(channelId);
}

//Function to return a random discord default emoji
function getRandomDefaultEmoji() {
    // Generate a random code point within the emoji range (0x1F600 to 0x1F64F)
    const randomCodePoint = Math.floor(Math.random() * (0x1F64F - 0x1F600 + 1)) + 0x1F600;
    // Convert the code point to a JavaScript string
    const emoji = String.fromCodePoint(randomCodePoint);
    return emoji;
  }


////MESSAGE SENT EVENT
client.on('messageCreate', message =>{
    //If the message does not start with the command prefix OR if the msg was sent by the bot then ignore it
    if(!message.content.startsWith(cmdprefix) || message.author.bot) {
        return;
    }

    //message format will be "!pb command". The command can be multiple words
    const command = message.content.slice(cmdprefix.length);

    //COMMANDS
    //help
    if(command === 'help'){
        let outstr = "Here is a list of all my commands:\n!pb getAllValidChannelIDs - Returns a list of all valid channels I can repost to! I am only able to repost to channels that end with 'pb'!\n!pb [insert artist name here] - As long as the message has at least one image attachment, this will open a menu where you can determine which channels I repost to! If you dont know the artist name, then use \"?\" as artist name.If you want to delete one of my reposts, navigate to the post and react to the ❌ emoji.\n";
        message.reply(outstr);
        return;
    }

    //pingpong with latency
    if(command === 'ping'){
        const timeTaken = Date.now() - message.createdTimestamp;
        message.reply(`Pong! This message had a latency of ${timeTaken}ms.`);
        console.log('i ponged!');
        return;
    }

    //Tells user all the valid channels the bot can repost to (aka all the valid channels that end with pb)
    if(command === 'getAllValidChannelIDs'){
        const chanarr = getAllValidChIDs(message);
        const guild = message.guild;

        message.reply(`Valid channels in ${guild.name}: ${chanarr.join(', ')}` );
        return;
    }

    //If the command is not any recognized command, then the bot will assume the user is trying to repost an image with the "command" as the image source.
    //If the "command" is "?" then the bot will acknowledge the source as "unknown artist"
    //For every image, the bot will create a menu with random emojis that the user can react with to repost the image to other valid channels
    if(command !== undefined){ 
        //get source & poster
        var artistSource = "unknown artist"
        if(command !== '?'){
            artistSource = command;
        }
        const poster = message.author.id;

        //error: No attachments
        if (message.attachments.size === 0){
            message.channel.send(`<@${poster}>\nerror: Please attach image(s) when posting.`);
            return;
        }

        //get valid channels and create array of random discord default emojis. Then create menu and assign each random emoji to a valid channel
        const validChannelIDs = getAllValidChIDs(message);
        const emojiarr = Array.from({ length: validChannelIDs.length }, () => getRandomDefaultEmoji());

        var outmsg = `IMAGE\n<@${poster}>\nSource: ${artistSource}\nPlease select all the channels you would like me to repost this to: \n`;
        for(let i = 0; i < Math.min(validChannelIDs.length, emojiarr.length); i++){
            let channelout = getChannelByID(message, validChannelIDs[i]);
            outmsg += `${emojiarr[i]} : ${channelout} \n`;
        }

        //For every attachment:
        //Determine if the attachment is an image - if not, respond with error message and continue to next attach
        //Send menu message and react with emojis. Unfortunately have to do it this way because discord bots can only react one emoji at a time
        message.attachments.forEach((attach) => {
            const fileExtension = attach.name.split('.').pop().toLowerCase();
            if (!['jpg', 'jpeg', 'png', 'gif', 'bmp', 'jfif'].includes(fileExtension)) {
                message.channel.send(`error: Attachment${attach.name} is not an image.`);
            } 

            message.channel.send({content: outmsg, files: [attach.url]}).then(sentMsg => {
            for(let i = 0; i < emojiarr.length; i++){
                sentMsg.react(emojiarr[i]);
            }
            });
        })

        //delete original user post
        message.delete();
        return;
    }
})

/////EMOJI REACTION ADD EVENT
client.on('messageReactionAdd', (reaction_orig, user) => {
    //ignore reactions from bots
    if (user.bot) {
        return
    }; 
    const msg = reaction_orig.message;

    //Whenever someone reacts to a bot message:
    if (msg.author.bot){
        const validChannelIDs = getAllValidChIDs(msg)

        //If the message is a menu post:
        if(msg.content.startsWith('IMAGE') || msg.content.startsWith('TWITTER')){
            
            //get the reaction emoji and the image
            const emojireact = reaction_orig.emoji;
            const attach = msg.attachments.first();
            const mentionedUser = msg.mentions.users.first();

            //split message by line - if a line includes the emoji then grab the channelid from that line. If the line includes 'Source:', then get the source name
            const msgLineArr = msg.content.split(/\r\n|\r|\n/);
            var chanIDToPostTo = "";
            var sourceName = "";
            for(let i = 0; i < msgLineArr.length; i++){
                if(msgLineArr[i].includes(emojireact)){
                    const channelIDPattern = /<#(\d+)>/;
                    const matches = msgLineArr[i].match(channelIDPattern);
                    if(matches){
                        chanIDToPostTo = matches[1];
                    }
                }
                if(msgLineArr[i].includes('Source: ')){
                    sourceName = msgLineArr[i].substring(8);
                }
            }

            //If the emoji was not in the post then just return
            if(chanIDToPostTo === "") return;

            //use getchannelbyid to find channel to post to
            const chanToPostTo = getChannelByID(msg, chanIDToPostTo);

            //error: if for some reason a user tries to repost an image to a deleted channel, give error message and return
            if(doesChannelExist(msg, chanToPostTo)){
                msg.channel.send("error: The channel you are trying to repost to no longer exists.")
                return;
            }

            //Repost with source + image
            outmsg = `Source: ${sourceName}\nPosted by: ${mentionedUser}`
            chanToPostTo.send({content: outmsg,  files: [attach.url]}).then(sentMsg => {
                    sentMsg.react('❌');
            });
        }

        //If someone reacts to the red x on a posted image, the bot will delete it
        if(msg.author.bot && reaction_orig.emoji.name === '❌'){
            msg.delete();
        }
    }
  })

//login
client.login(token);
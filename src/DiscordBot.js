const { Client, Intents, MessageEmbed, MessageActionRow, MessageButton, Permissions } = require("discord.js");
const config = require("../config.json");

class DiscordBot {
	// Discord API client
	#client;
	// Minecraft server controller
	#server;
	// The discord messages that users use to control the bot
	#serverControlMessages = [];

	constructor() {
		this.#client = new Client({ intents: [Intents.FLAGS.GUILDS] });

		// JS requires usage of lambda to access class method from event for some reason.
		this.#client.once("ready", async () => await this.#retrieveServerControlMessages());
		this.#client.on("interactionCreate", async interaction => await this.#clientInteraction(interaction));
	}

	setMinecraftServer(minecraftServer) {
		this.#server = minecraftServer;
	}

	login() {
		this.#client.login(config.TOKEN);
	}

	// Gets all of the server control messages sent by the bot to the discord and stores them in the list
	async #retrieveServerControlMessages() {
		let guild = await this.#client.guilds.fetch(config.GUILD_ID);
		let channels = await guild.channels.fetch();
		for(let channel of channels.values()) {
			// This could be a voice channel or the bot may not have permission to read messages in this channel
			if(channel.type != "GUILD_TEXT" || !channel.permissionsFor(guild.me).has([Permissions.FLAGS.VIEW_CHANNEL, Permissions.FLAGS.READ_MESSAGE_HISTORY]))
				continue;
			
			let messages = await channel.messages.fetch({limit: 100}); // 100 is upper limit enforced by discord
			// We only want the server control messages
			this.#serverControlMessages.push(...messages.filter(msg => msg.author.id == this.#client.user.id && msg.embeds.length == 1 && msg.embeds[0].author.name == (config.MINECRAFT_SERVER_NAME + " server control")).values());
		}

		// Server status could have changed while we were offline so update the control messages
		await this.onServerStatusUpdate();
	
		console.log("Ready!");
	}

	// Returns the embed for the server control message
	async #buildControlMessage(guildIconURL) {
		let serverControlEmbed = new MessageEmbed({"color": "AQUA"});
		serverControlEmbed.setAuthor({"name": config.MINECRAFT_SERVER_NAME + " server control", "iconURL": guildIconURL});
		serverControlEmbed.setFooter({"text": "Use the buttons below to control the server. Please don't spam - we don't want to get rate limited."});
		serverControlEmbed.addField("Server IP", this.#server.address);
		serverControlEmbed.addField("Current Server Status", this.#server.serverStatus);
		serverControlEmbed.addField("Players Online", this.#server.playerCount);
		let messageData = {"embeds": [serverControlEmbed], "components": []};
	
		let messageActionRow = new MessageActionRow();
		this.#buildButtonArray().forEach(btn => messageActionRow.addComponents(btn));
		// Only add the row to the message components if it has stuff. Otherwise the discord API will error out.
		if(messageActionRow.components.length > 0)
			messageData["components"].push(messageActionRow);
	
		return messageData
	}
	
	#buildButtonArray() {
		let buttons = [];
	
		switch(this.#server.serverStatus) {
			case "Offline":
				buttons.push(new MessageButton({"customId": "#start", "label": "Start Server", "style": "SUCCESS"}));
			break;
			
			case "Starting ...":
				buttons.push(new MessageButton({"customId": "#stop", "label": "Stop Server", "style": "DANGER"}));
			break;
	
			case "Online":
				buttons.push(new MessageButton({"customId": "#stop", "label": "Stop Server", "style": "DANGER"}));
				buttons.push(new MessageButton({"customId": "#restart", "label": "Restart Server", "style": "PRIMARY"}));
			break;
		}
		
		return buttons;
	}

	async #clientInteraction(interaction) {
		if(interaction.isApplicationCommand() && interaction.commandName == "sendmessage") {
			if(interaction.user.id != config.DEV_ID) {
				await interaction.reply({"content": "You do not have permission to use this!", "ephemeral": true});
				return;
			}

			if(!interaction.channel.permissionsFor(interaction.guild.me).has([Permissions.FLAGS.SEND_MESSAGES, Permissions.FLAGS.EMBED_LINKS])) {
				await interaction.reply({"content": "I do not have permission to send messages!", "ephemeral": true});
				return;
			}

			await interaction.deferReply();
			let messageData = await this.#buildControlMessage(interaction.guild.iconURL());
			this.#serverControlMessages.push(await interaction.channel.send(messageData));
			await interaction.deleteReply();
		}
		else if(interaction.isButton()) {
			await interaction.deferReply();
			// Interaction ID will be '#start', '#stop' or '#restart'
			await this.#server.executeServerAction(interaction.customId);
			await interaction.deleteReply();
		}
	}

	// When the minecraft server status updates, we update the discord message
	async onServerStatusUpdate() {
		if(this.#serverControlMessages.length > 0) {
			let messageData = await this.#buildControlMessage(this.#serverControlMessages[0].guild.iconURL());
			for(let msg of this.#serverControlMessages) {
				if(msg.channel.permissionsFor(msg.guild.me).has([Permissions.FLAGS.SEND_MESSAGES, Permissions.FLAGS.EMBED_LINKS]))
					msg.edit(messageData);
			}
		}
	}
}

exports.DiscordBot = DiscordBot;
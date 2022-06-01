const { SlashCommandBuilder } = require("@discordjs/builders");
const { REST } = require("@discordjs/rest");
const { Routes } = require("discord-api-types/v9");
const config = require("../config.json");

const rest = new REST({ "version": "9" }).setToken(config.TOKEN);

const commands = [
	new SlashCommandBuilder().setName("sendmessage").setDescription("Sends the server control message to the current channel.").setDefaultPermission(false).toJSON()
];

async function main() {
	// Register the slash command
	await rest.put(Routes.applicationGuildCommands(config.CLIENT_ID, config.GUILD_ID), {"body": commands});
}
main();
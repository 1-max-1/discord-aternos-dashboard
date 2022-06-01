const { SlashCommandBuilder } = require("@discordjs/builders");
const { REST } = require("@discordjs/rest");
const { Routes } = require("discord-api-types/v9");
const config = require("../config.json");

const rest = new REST({ version: "9" }).setToken(config.TOKEN);

const commands = [
	new SlashCommandBuilder().setName("sendmessage").setDescription("Sends the server control message to the current channel.").setDefaultPermission(false).toJSON()
];

const commandPermissions = {
	"permissions": [{
		"id": config.DEV_ID,
		"type": 2, // 2 is USER, 1 is ROLE
		"permission": true
	}]
};

async function main() {
	// Register the slash command
	await rest.put(Routes.applicationGuildCommands(config.CLIENT_ID, config.GUILD_ID), {"body": commands});

	// Get the ID of the slash command
	let commandData = await rest.get(Routes.applicationGuildCommands(config.CLIENT_ID, config.GUILD_ID));

	// Update slash command so only I can use it
	await rest.put(Routes.applicationCommandPermissions(config.CLIENT_ID, config.GUILD_ID, commandData[0]["id"]), {"body": commandPermissions});
}
main();
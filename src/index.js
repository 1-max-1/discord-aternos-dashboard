const { AternosServer } = require("./AternosServer.js");
const { DiscordBot } = require("./DiscordBot.js");

async function main() {
	let bot = new DiscordBot();
	let server = new AternosServer(() => bot.onServerStatusUpdate());
	bot.setMinecraftServer(server);
	await server.initialize();
	bot.login();
}

main();
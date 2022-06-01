const puppeteer = require("puppeteer-extra");

const StealthPlugin = require("puppeteer-extra-plugin-stealth");
puppeteer.use(StealthPlugin()); // Avoid cloudflare detection

const AdblockerPlugin = require("puppeteer-extra-plugin-adblocker");
puppeteer.use(AdblockerPlugin({ blockTrackers: true }));

const config = require("../config.json");

class AternosServer {
	// The puppeteer page (points to aternos server dashboard)
	#serverPage;
	// Called whenever server status or online players changes
	#serverStatusUpdateCallback;

	// The text of the aternos server status label
	serverStatus;
	// Players online
	playerCount;
	// IP and port
	address;

	constructor(statusUpdateCallback) {
		this.#serverStatusUpdateCallback = statusUpdateCallback;
	}

	async initialize() {
		let browser = await puppeteer.launch({ headless: true });
		this.#serverPage = await browser.newPage();

		// Navigate to login page and login
		await this.#serverPage.goto("https://aternos.org/go/");
		await this.#serverPage.type("#user", config.ATERNOS_USERNAME);
		await this.#serverPage.type("#password", config.ATERNOS_PASSWORD);
		await Promise.all([this.#serverPage.waitForNavigation(), this.#serverPage.click("#login")]);

		// We will now be in the server list page so need to navigte to the server details page
		await Promise.all([this.#serverPage.waitForNavigation(), this.#serverPage.click("div.server-body")]);

		// Adblock notice now appears so need to dismiss it
		await this.#serverPage.waitForSelector("i.far.fa-sad-tear");
		await this.#serverPage.click("i.far.fa-sad-tear");
		await this.#serverPage.waitForSelector("i.far.fa-sad-tear", {"hidden": true});

		await this.#storeServerStatus();
		await this.#getServerIPAndPort();

		// This mutation observer will trigger this exposed function whenerv the server status or player count changes
		await this.#serverPage.exposeFunction("onServerStatusChange", (newStatus, playerCount) => this.#onServerStatusChange(newStatus, playerCount));
		await this.#serverPage.evaluate(() => {
			const observer = new MutationObserver((_, __) => {
				let newStatus = document.querySelector("span.statuslabel-label").textContent.trim();
				let playerCount = document.querySelector("div.live-status-box-value.js-players").textContent.trim();
				window.onServerStatusChange(newStatus, playerCount); // The function exposed by puppeteer
			});
			observer.observe(document.querySelector("span.statuslabel-label"), {"childList": true});
			observer.observe(document.querySelector("div.live-status-box-value.js-players"), {"childList": true});
		});
	}

	async #storeServerStatus() {
		let statusLabel = await this.#serverPage.waitForSelector("span.statuslabel-label")
		this.serverStatus = await statusLabel.evaluate(el => el.textContent.trim());
		let playerCountLabel = await this.#serverPage.waitForSelector("div.live-status-box-value.js-players")
		this.playerCount = await playerCountLabel.evaluate(el => el.textContent.trim());
	}

	async #getServerIPAndPort() {
		// showIP() is a javascript function defined in the source code of the aternos website
		// It opens a dialog showing the server IP and port
		await this.#serverPage.evaluate(() => showIP());

		// Element text looks something like: "IP: myserver.aternos.mePort: 39764Dyn IP: ridgehead.aternos.host:39764Okay Help"
		let text = await this.#serverPage.evaluate(() => document.querySelector("div.alert-body").textContent);
		let ip = text.split("IP: ")[1].split("Port:")[0];
		let port = text.split("Port: ")[1].substring(0, 5); // Port number is 5 characters long
		this.address = `${ip}:${port}`;

		// Now close the dialog so we can click other buttons
		await this.#serverPage.click("div.alert-buttons > a.btn.btn-green");
	}

	#onServerStatusChange(newStatus, playerCount) {
		this.serverStatus = newStatus;
		this.playerCount = playerCount;
		(this.#serverStatusUpdateCallback)();
	}

	#validateAction(action) {
		return (action == "#start" && this.serverStatus == "Offline") || (action == "#restart" && this.serverStatus == "Online") || (action == "#stop" && (this.serverStatus == "Online" || this.serverStatus == "Starting ..."));
	}

	// action should be "#start", "#stop" or "#restart"
	async executeServerAction(action) {
		if(!this.#validateAction(action)) return;

		// The aternos page has buttons with ID's of 'start', 'stop' and 'restart'
		await this.#serverPage.click(action);

		// After starting the server a modal popup opens asking to alow notifications. We need to close this so we can click other things.
		if(action == "#start") {
			await this.#serverPage.waitForSelector("div.alert > main > div.alert-body > div.alert-buttons.btn-group > a.btn.btn-red", {"visible": true});
			await this.#serverPage.click("div.alert > main > div.alert-body > div.alert-buttons.btn-group > a.btn.btn-red");
		}
	}
}

exports.AternosServer = AternosServer;
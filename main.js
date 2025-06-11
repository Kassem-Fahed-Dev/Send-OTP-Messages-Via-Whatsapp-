const express = require("express");
const { Client, LocalAuth } = require("whatsapp-web.js");
const qr2 = require("qrcode");
require("dotenv").config();

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.set("view engine", "ejs");
app.set("views", "pages");

let tokenQr = null;
let isClientReady = false;

// Initialize WhatsApp client
const session = new Client({
	authStrategy: new LocalAuth({
		dataPath: "session",
		clientId: "primary",
	}),
	puppeteer: {
		headless: true,
		args: ["--no-sandbox", "--disable-setuid-sandbox"],
	}
});

session.on("qr", (qr) => {
	tokenQr = qr;
	console.log("📱 QR Code received");
});

session.on("ready", () => {
	tokenQr = false;
	isClientReady = true;
	console.log("✅ WhatsApp client is ready");
});

session.on("authenticated", () => {
	console.log("🔐 Authenticated");
});

session.on("auth_failure", msg => {
	console.error("❌ Auth failure:", msg);
});

session.on("disconnected", reason => {
	console.warn("⚠️ Disconnected:", reason);
	isClientReady = false;
});

session.initialize();

app.get("/", (req, res) => {
	res.send("Hello World");
});

app.get("/whatsapp/login", async (req, res) => {
	if (tokenQr === null) return res.send("Please try again shortly...");
	if (tokenQr === false) return res.send("✅ WhatsApp is already logged in");

	qr2.toDataURL(tokenQr, (err, src) => {
		if (err) return res.status(500).send("Error generating QR code");
		return res.render("qr", { img: src });
	});
});

app.post("/whatsapp/sendmessage/", async (req, res) => {
	try {
		if (req.headers["x-password"] !== process.env.WHATSAPP_API_PASSWORD) {
			throw new Error("Invalid password");
		}
		if (!req.body.message) throw new Error("Message is required");
		if (!req.body.phone) throw new Error("Phone number is required");
		if (!isClientReady) throw new Error("Client not ready yet. Please wait...");

		const number = req.body.phone.replace(/[^0-9]/g, "");
		await session.sendMessage(`${number}@c.us`, req.body.message);

		res.json({ ok: true, message: "✅ Message sent successfully" });
	} catch (error) {
		console.error("❌ Error:", error.message);
		res.status(500).json({ ok: false, message: error.message });
	}
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
	console.log(`🚀 Server is running on port ${PORT}`);
});

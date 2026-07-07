const { google } = require("googleapis");
require("dotenv").config();

async function test() {
    const oauth2Client = new google.auth.OAuth2(
        process.env.CLIENT_ID,
        process.env.CLIENT_SECRET,
        "https://developers.google.com/oauthplayground"
    );

    oauth2Client.setCredentials({
        refresh_token: process.env.REFRESH_TOKEN,
    });

    try {
        const token = await oauth2Client.getAccessToken();
        console.log("Access Token:", token.token);
    } catch (err) {
        console.error(err.response?.data || err);
    }
}

test();
const fs = require("fs");
const phantom = require("phantomjscore");
const express = require("express");
const cookieParser = require("cookie-parser");
const bodyParser = require("body-parser")
const mysql = require("mysql");
const nconf = require("nconf");
const util = require("./api/util");
const payout = require("./payout");
const Recaptcha = require("express-recaptcha");
const https = require('https');
const http = require('http');
const app = express();

let server = null;

app.use(express.static("./frontend"));
app.use(cookieParser());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.disable("x-powered-by");

nconf.argv().file("config.json");
PAY_PER_CLICK = nconf.get("payPerClick");
COOLDOWN = nconf.get("cooldown");

LOG_FILE = nconf.get("log");

const PORT = nconf.get("port");
const DB_USERNAME = nconf.get("database:username");
const DB_PASSWORD = nconf.get("database:password");
const PASSPHRASE = nconf.argv().get("pass");
const SECOND_PASS = nconf.argv().get("secPass");

if (!PASSPHRASE) {
    console.log("Please enter the faucet's passphrase");
    process.exit(1);
}

recaptcha = new Recaptcha(nconf.get("recaptcha:siteKey"), nconf.get("recaptcha:secretKey"));

const PUB_KEY = phantom.crypto.getKeys(PASSPHRASE).publicKey;
FAUCET_ADDR = phantom.crypto.getAddress(PUB_KEY);

//Init MySQL
const pool = mysql.createPool({
    connectionLimit : 100,
    host: "phntmorg.c3xqaag2rezx.eu-central-1.rds.amazonaws.com",
    user: DB_USERNAME,
    password: DB_PASSWORD,
    database: "ArkFaucet",
    debug:  false
});

getConnection = () => {
    return new Promise((resolve, reject) => {
        pool.getConnection((err, connection) => {
            if(err)
                reject(err);
            
            resolve(connection);
        });
    }).catch((err) => console.log(err));
};

const startServer = () => {
    const routes = require("./api/routes/routes");
    routes(app);

    app.all("/*", (req, res, next) => {
        res.header("Access-Control-Allow-Origin", "*");
        res.header("Access-Control-Allow-Methods", "GET,PUT,POST,DELETE,OPTIONS");
        res.header("Access-Control-Allow-Headers", "Content-type,Accept,X-Auth-Token");
        if(req.method == "OPTIONS")
            res.status(200).end();
        else
            next();
    });

    let faucetApp = async () => {
        console.log(fs.readFileSync("art.txt", "utf8"));
        console.log(`Faucet server started on port ${PORT}`);

        const info = await util.getFaucetAccountInfo();

        console.log("=====");
        console.log(`Address: ${info.address}`);
        console.log(`Balance: ${info.balance} XNC`);
        console.log(`Pay Per Click: ${PAY_PER_CLICK} XNC`);
        console.log(`Cooldown: ${COOLDOWN} seconds`);
        console.log("=====");

        //Start payout scheduler
        const MINIMUM_THRESHOLD = nconf.get("payMinimum");
        const FREQUENCY = nconf.get("paySchedule");
        const TX_FEE = nconf.get("txFee");

        payout.startScheduler(MINIMUM_THRESHOLD, TX_FEE, FREQUENCY, PASSPHRASE, SECOND_PASS);
    };

    if (nconf.get('ssl:active')) {
        https.createServer({
            key: fs.readFileSync(nconf.get('ssl:key')),
            cert: fs.readFileSync(nconf.get('ssl:cert')),
            ca: fs.readFileSync(nconf.get('ssl:ca'))
        }, app).listen(nconf.get('sslPort'), faucetApp);

        http.createServer((req, res) => {
            res.writeHead(301, {
                "Location": "https://" + req.headers['host'] + req.url
            });

            res.end();
        }).listen(PORT, () => {
            console.log('Redirection to SSL activated');
        });
    } else {
        http.createServer(app).listen(PORT, faucetApp);
    }
};

startServer();
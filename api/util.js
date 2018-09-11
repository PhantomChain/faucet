"use strict";
const BigNumber = require("bignumber.js");
const fs = require("fs");
const phantom = require("phantomjscore");
const querystring = require('querystring');
const request = require('request');

const addrRegex = /^P[a-z0-9A-Z]{33}$/;

const phantomApi = (endpoint, params, callback, method) => {
    if (typeof method === 'undefined') {
        method = 'GET';
    }

    let options = {
        method: method,
        uri: 'http://34.226.219.174:4100/' + endpoint,
        headers: {
            "Content-Type": "application/json",
            "os": "linux3.2.0-4-amd64",
            "version": "0.3.0",
            "port": 1,
            "nethash": "e62ee59508e610421d7d39567cca36479397fa3c63b1d2e9458e08dee9eb6481"
        },
        rejectUnauthorized: false,
        requestCert: true
    };

    if (method !== 'GET') {
        options.json = params;
    } else {
        options.uri += '?' + querystring.stringify(params);
        options.json = true;
    }

    request(options, (error, response, body) => {
        callback(error, response.body);
    });
};

exports.sendTransaction = (signedTransactions, callback) => {
    return phantomApi('peer/transactions', {
        transactions: signedTransactions
    }, callback, 'POST');
};

exports.getBalance = (address, callback) => {
    return phantomApi('api/accounts', {
        address: address
    }, callback);
};

exports.getFaucetAccountInfo = () => {
    return new Promise((resolve, reject) => {
        this.getBalance(FAUCET_ADDR, (err, resp) => {
            if(!err)
            {
                const info = {
                    address: FAUCET_ADDR,
                    balance: resp.account.balance / 100000000,
                };

                resolve(info);
            }
            else
                reject(err);
        });
    });
};

exports.reject = (res, status, msg) => {
    console.log(`Rejected: ${status} - ${msg}`);

    const resp = {
        success: false,
        message: msg
    };

    res.status(status);
    res.send(resp);
}

exports.isAddress = (addr) => {
    return addrRegex.test(addr);
};

exports.log = (msg, doAsync) => {
    console.log(msg);

    if(doAsync)
        fs.appendFile(LOG_FILE, msg);
    else
        fs.appendFileSync(LOG_FILE, msg);
};
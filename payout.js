const repo = require("./api/repos/faucetRepo");
const moment = require("moment");
const BigNumber = require("bignumber.js");
const scheduler = require("node-schedule");
const util = require("./api/util");
const phantom = require('phantomjscore');

const doPayout = async (threshold, fee, passphrase, secondPassphrase) => {
    util.log("==Payout Begin==");
    util.log("DateTime: " + moment().toISOString());
    util.log("Getting pending balances...");

    const balances = await repo.getOverthresholdBalances(threshold);
    if(balances.length === 0) {
        console.log('No pending balances to payout');

        return;
    }

    const options = { secondPassphrase: secondPassphrase };

    const addrs = balances.map((bal) => bal.address);
    const txs = balances.map((bal) => {
        const txFee = new BigNumber(fee).times(100000000);
        let payout = new BigNumber(bal.pending).times(100000000); //convert to arktoshis
        payout = payout.minus(txFee);
        let tx = false;

        try {
            tx = phantom.transaction.createTransaction(bal.address, payout.toNumber(), null, passphrase);
        } catch (e) {
            console.log(`Error while sending to address ${bal.address}`);
        }

        return tx;
    });

    repo.deleteUnpaidBalances(addrs);

    util.log("Paying now...");
    let i = 0;

    function queuePayments() {
        util.log(`Sending tx bundle 1/${txs.length}`);
        util.sendTransaction(txs, (error, response) => {
            if (response.success) {
                util.log(`Sent out ${response.transactionIds.length} txs: ` +
                         JSON.stringify(response.transactionIds));
            }

            util.log("==Payout Complete==");
        });
    }

    queuePayments();
};

exports.startScheduler = (threshold, fee, cronJob, passphrase, secondPassphrase) => {
    console.log(`Automatic payouts scheduled: ${cronJob}`);

    const paySchedule = scheduler.scheduleJob(cronJob, () => {
        doPayout(threshold, fee, passphrase, secondPassphrase);
    });
};

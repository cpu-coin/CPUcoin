const build = require('./util/build');
const deploy = require('./util/deploy');
const path = require('path');
const fs = require('fs');

const assert = require('assert');
const colors = require('colors');
const util = require('util');


// Set false temporarily to disable all tests except the one under development, and to enable compile/deploy log messages.
const RUN_ALL_TESTS = true;     // This should be always checked in set to true!


// =====================================================================================================================
// === This executes the entire test suite.
// =====================================================================================================================

const log = false;      // Set true to log details.
const nullLogger = {
    log: function () {
    }
};

// Helper values for reference to ETH test accounts.
let owner;
let account1, account2, account3, account4, account5, account6, account7, account8, account9;
let CpuCoin = null;

// Build the source contracts, logging build output.
const contractFullPath = './contracts/CpuCoin.sol';
build(contractFullPath, console);

const constructorArgs = [];

// If the compile/deploy is failing, set this true to figure out why (but is noisy)
const logDeployAndCompileErrors = !RUN_ALL_TESTS;

const deployLogger = logDeployAndCompileErrors ? console : nullLogger;
beforeEach(async () => {
    // Deploy the source contracts fresh before each test (without rebuild, no deploy output logging).
    const deployment = await deploy(contractFullPath, false, constructorArgs, deployLogger).catch(deployLogger);
    if (deployment !== undefined) {
        owner = deployment.accounts[0];
        account1 = deployment.accounts[1];
        account2 = deployment.accounts[2];
        account3 = deployment.accounts[3];
        account4 = deployment.accounts[4];
        account5 = deployment.accounts[5];
        account6 = deployment.accounts[6];
        account7 = deployment.accounts[7];
        account8 = deployment.accounts[8];
        account9 = deployment.accounts[9];

        CpuCoin = deployment.contract;
        if (log) console.log(colors.green('==> CpuCoin deployed to ' + CpuCoin.options.address));
    }
});


// =====================================================================================================================
// === Utility methods, for use by individual tests.
// =====================================================================================================================

function runThisTest(runIt) {
    return runIt || RUN_ALL_TESTS;
}

function logNamedValue(name, thing) {
    console.log(name + ": " + util.inspect(thing, false, null, true /* enable colors */))
}

// Log an object's inner details to the console
function logValue(thing) {
    logNamedValue('Result', thing);
}

// Tells you which of the built-in accounts a given account is.
function whichAccountIs(test) {
    for (let i = 0; i < 10; i++) {
        if (accounts[i] === test) {
            console.log(('Account is account' + i).replace('account0', 'owner'));
            return;
        }
        console.log('Account \'' + test + '\' is not one of the 10 given test accounts!');
    }
}


// =====================================================================================================================
// === Test definitions for the test suite
// =====================================================================================================================

if (!RUN_ALL_TESTS)
    console.log(colors.blue('Not all tests were be run! Please set RUN_ALL_TESTS = true first to run every test.'));

describe('CpuCoin', () => {
    const ONE_MILLION = 1000000;
    const ONE_BILLION = 1000 * ONE_MILLION;
    const TOTAL_SUPPLY = 5 * ONE_BILLION;
    const WEI_DECIMALS = 18;
    const WEI = 10 ** WEI_DECIMALS;
    const WEI_ZEROES = '000000000000000000';

    const THOUSAND_YEARS_DAYS = 365243;       // See https://www.timeanddate.com/date/durationresult.html?m1=1&d1=1&y1=2000&m2=1&d2=1&y2=3000
    const TEN_YEARS_DAYS = Math.floor(THOUSAND_YEARS_DAYS / 100);
    const SECONDS_PER_DAY = 24 * 60 * 60;     // 86400 seconds in a day
    const JAN_1_2000_SECONDS = 946684800;     // Saturday, January 1, 2000 0:00:00 (GMT) (see https://www.epochconverter.com/)
    const JAN_1_2000_DAYS = JAN_1_2000_SECONDS / SECONDS_PER_DAY;
    const JAN_1_3000_DAYS = JAN_1_2000_DAYS + THOUSAND_YEARS_DAYS;

    const TODAY_SECONDS = new Date().getTime() / 1000;
    const TODAY_DAYS = Math.floor(TODAY_SECONDS / SECONDS_PER_DAY);

    // Gas amounts
    const GRANTGAS = 200000;        // was 140000, then 155000. Increased after splitting vesting out of grant.
    const UNIFORMGRANTGAS = 160000;
    const XFEROWNERGAS = 100000;
    const REVOKEONGAS = 170000;
    const VESTASOFGAS = 30000;

    // Create our test results checker object
    const result = new require('./util/test-result')();


    // ================================================================================
    // === Internal utilities
    // ================================================================================

    const checkAreEqual = result.checkValuesAreEqual;
    const checkAreNotEqual = result.checkValuesAreNotEqual;

    // Rounds irrational numbers to a whole token by truncation (rounding down), which matches the behavior of
    // Solidity integer math (especially division). This accommodates rounding up of very tiny decimals short of
    // a whole token without rounding up.
    function round(amountIn) {
        let amount = amountIn;
        amount = amount / WEI;
        let result = Math.floor(Math.floor(amount * 10 + 1) / 10);
        result = tokensToWei(result);
        if (log) console.log('  round: ' + amountIn + ' -> ' + result);
        return result;
    }

    // Equality check with minimal wiggle room for JS's limited floating point precision
    function checkAreEqualR(val1, val2) {
        return checkAreEqual(round(val1), round(val2));
    }

    function cleanLeadingZeroes(str) {
        assert(str !== undefined && str !== null);
        if (typeof str === 'number')
            return str;
        str = str.toString();
        let pos = 0;
        while (str.charAt(pos) === '0' && pos < str.length - 1)
            pos++;
        return str.substring(pos);
    }

    function tokensToWei(wholeTokensIn) {
        let wholeTokens = Math.floor(wholeTokensIn);
        let result = wholeTokens == 0 ? 0 : wholeTokens + WEI_ZEROES;
        if (log) console.log('  tokensToWei: ' + wholeTokensIn + ' -> ' + result);
        return result;
    }

    function weiToTokens(weiAmount) {
        let result = 0;
        let strResult = weiAmount.toString();
        if (strResult.length <= WEI_DECIMALS)
            result = 0;
        else {
            strResult = strResult.substring(0, result.length - WEI_DECIMALS);       // Lop off 18 zeroes from long string value
            if (log) console.log('   strResult', strResult);
            if (strResult.length === 0)
                result = 0;
            else
                result = parseInt(strResult);
        }
        if (log) console.log('  weiToTokens: ' + weiAmount + ' -> ' + result);
        return result;
    }

    let unexpectedErrors = 0;

    function catcher(error) {
        unexpectedErrors++;
        console.log('Unexpected error', error);
    }

    const DEFAULT_ERROR = 'revert';
    let expectedFails = 0;

    // Wrap your async call with this if you expect it to fail. Enables you to implement a test where
    // not failing is the unexpected case. The result will be true if the incoming send method result failed.
    async function expectFail(resultPromise, expectedMessage) {
        // // Handle boolean success/fail input.M
        // if (resultPromise === true || resultPromise === false) {
        //     if (!!expectedMessage)
        //         console.log(colors.yellow('Warning: Expected message '+expectedMessage+' not applicable to boolean result.'))
        //     return (!resultPromise);
        // }

        // Otherwise, handle Promise success/fail input.
        if (!expectedMessage)
            expectedMessage = DEFAULT_ERROR;

        let outcome = false;
        try {
            let unexpectedSuccess = await resultPromise;
            if (unexpectedSuccess)
                throw 'Expected method to fail but it was successful!';
            const errorMsg = (!expectedMessage ? '' : ('Expected ' + expectedMessage + ': ')) + 'No exception was thrown! (incorrect)';
            result.fail(errorMsg);
            outcome = false;
        } catch (error) {
            if (typeof error === 'string')
                throw error;
            const failedAsExpected = error.message.indexOf(expectedMessage) >= 0;
            if (failedAsExpected) {
                expectedFails++;
            } else {
                const errorMsg = "Expected '" + expectedMessage + "' exception but got '" + error.message + "' instead! (incorrect)";
                result.fail(errorMsg);
            }
            outcome = failedAsExpected;
        }
        return outcome;
    }

    async function subtest(caption, fn) {
        // Display sub-tests within tests in the build output.
        console.log(colors.grey('    - subtest ' + caption));
        await fn();
    }


    // ================================================================================
    // === Test basic attributes of the CpuCoin token
    // ================================================================================
    it('0. verify successful compilation/deploymement of CpuCoin', () => {
        checkAreNotEqual(CpuCoin, null, "CpuCoin is null. Did compile fail? Did deploy fail? Was there a problem with the constructor? Try setting RUN_ALL_TESTS = false.");
    });

    if (runThisTest())
        it('1. verified deployment of the CpuCoin contract by confirming it has a contract address', () => {
            if (!CpuCoin) return;
            checkAreNotEqual(CpuCoin.options.address, null);
        });

    if (runThisTest())
        it('2. verified CpuCoin has symbol CPU', async () => {
            if (!CpuCoin) return;
            result.set(await CpuCoin.methods.symbol().call());
            result.checkIsEqual('CPU');
        });

    if (runThisTest())
        it('3. verified CpuCoin has 18 decimals', async () => {
            if (!CpuCoin) return;
            result.set(await CpuCoin.methods.decimals().call());
            result.checkIsEqual(WEI_DECIMALS);
        });

    if (runThisTest())
        it('4. verified CpuCoin owner account and total supply initially have 5 billion tokens', async () => {
            if (!CpuCoin) return;
            result.set(await CpuCoin.methods.balanceOf(owner).call());
            result.checkIsEqual(tokensToWei(TOTAL_SUPPLY));
            result.set(await CpuCoin.methods.totalSupply().call());
            result.checkIsEqual(tokensToWei(TOTAL_SUPPLY));
        });

    if (runThisTest())
        it('5. verified CpuCoin non-owner account initially has zero tokens', async () => {
            if (!CpuCoin) return;
            result.set(await CpuCoin.methods.balanceOf(account1).call());
            result.checkIsEqual(0);
        });


    // ================================================================================
    // === Test ownership functionality
    // ================================================================================
    if (runThisTest())
        it('6. verified only owner account effectively owns the contract', async () => {
            if (!CpuCoin) return;

            await subtest('owner of contract', async () => {
                result.set(await CpuCoin.methods.owner().call());
                result.checkIsEqual(owner);
            }).catch(catcher);

            await subtest('6a. account0 is owner, others are not.', async () => {
                result.set(await CpuCoin.methods.isOwner().call());
                result.checkIsTrue();
                result.set(await CpuCoin.methods.isOwner().call({from: account1}));
                result.checkIsFalse();
                result.set(await CpuCoin.methods.isOwner().call({from: account2}));
                result.checkIsFalse();
            }).catch(catcher);
        });

    if (runThisTest())
        it('7. verified owner account can change ownership to another account', async () => {
            if (!CpuCoin) return;

            await subtest('transfer of contract ownership to account 1', async () => {
                result.set(await CpuCoin.methods.registerAccount().send({from: account1}));
                result.checkTransactionOk();
                result.set(await CpuCoin.methods.transferOwnership(account1).send({from: owner, gas: XFEROWNERGAS}));
                result.checkTransactionOk();
                result.set(await CpuCoin.methods.owner().call());
                result.checkIsEqual(account1);
            }).catch(catcher);

            // Transferred ownership: In this test from here on, owner is now account1.

            await subtest('7a. account1 is now owner, others are not.', async () => {
                result.set(await CpuCoin.methods.isOwner().call());
                result.checkIsFalse();
                result.set(await CpuCoin.methods.isOwner().call({from: account1}));
                result.checkIsTrue();
                result.set(await CpuCoin.methods.isOwner().call({from: account2}));
                result.checkIsFalse();
            }).catch(catcher);
        });

    if (runThisTest())
        it('8. verified non-owners cannot change ownership', async () => {
            if (!CpuCoin) return;

            await subtest('8a. transfer ownership from non-owner account1', async () => {
                result.set(await CpuCoin.methods.registerAccount().send({from: account2}));
                result.checkTransactionOk();
                result.set(await expectFail(CpuCoin.methods.transferOwnership(account2).send({
                    from: account1,
                    gas: XFEROWNERGAS
                })).catch(catcher));
                result.checkDidFail();
            }).catch(catcher);

            // Ownership NOT transferred: In this test from here on, owner is still original owner.

            await subtest('8b. transfer ownership from non-owner account2', async () => {
                result.set(await expectFail(CpuCoin.methods.transferOwnership(owner).send({
                    from: account2,
                    gas: XFEROWNERGAS
                })).catch(catcher));
                result.checkDidFail();
            }).catch(catcher);

            // Ownership NOT transferred: In this test from here on, owner is still original owner.
        });

    if (runThisTest())
        it('9. verified ownership can\'t be renounced', async () => {
            if (!CpuCoin) return;
            result.set(await expectFail(CpuCoin.methods.renounceOwnership().send({from: owner})).catch(catcher));
            result.checkDidFail();
            result.set(await expectFail(CpuCoin.methods.renounceOwnership().send({from: account1})).catch(catcher));
            result.checkDidFail();
        });


    // ================================================================================
    // === Test ERC20 basics
    // ================================================================================
    if (runThisTest())
        it('10. verified ERC20 transfer()', async () => {
            if (!CpuCoin) return;

            await subtest('10a. transfer owner->account1, then verify balances', async () => {
                result.set(await CpuCoin.methods.transfer(account1, tokensToWei(10000)).send({from: owner}));
                result.checkTransactionOk();
                // .
                result.set(await CpuCoin.methods.balanceOf(owner).call());
                result.checkIsEqual(tokensToWei(TOTAL_SUPPLY - 10000));
                result.set(await CpuCoin.methods.balanceOf(account1).call());
                result.checkIsEqual(tokensToWei(10000));
            }).catch(catcher);

            await subtest('10b. make transfer account1->account2, then verify balances', async () => {
                result.set(await CpuCoin.methods.transfer(account2, tokensToWei(1000)).send({from: account1}));
                result.checkTransactionOk();
                // Verify new balances.
                result.set(await CpuCoin.methods.balanceOf(account1).call());
                result.checkIsEqual(tokensToWei(9000));
                result.set(await CpuCoin.methods.balanceOf(account2).call());
                result.checkIsEqual(tokensToWei(1000));
            }).catch(catcher);

            await subtest('10c. trying to transfer more tokens than the balance will fail', async () => {
                result.set(await expectFail(CpuCoin.methods.transfer(account2, tokensToWei(999999)).send({from: account1})).catch(catcher));
                result.checkDidFail();
                // Verify nothing changed.
                result.set(await CpuCoin.methods.balanceOf(account1).call());
                result.checkIsEqual(tokensToWei(9000));
                result.set(await CpuCoin.methods.balanceOf(account2).call());
                result.checkIsEqual(tokensToWei(1000));
            }).catch(catcher);

            await subtest('10d. smaller transfer succeeds after first failed transfer', async () => {
                result.set(await CpuCoin.methods.transfer(account2, tokensToWei(9000)).send({from: account1}));
                result.checkTransactionOk();
                // Verify new balances.
                result.set(await CpuCoin.methods.balanceOf(account1).call());
                result.checkIsEqual(0);
                result.set(await CpuCoin.methods.balanceOf(account2).call());
                result.checkIsEqual(tokensToWei(10000));
            }).catch(catcher);
        });

    // --------------------------------------------------------------------------------
    // Use the 'approve/transfer' method to transfer funds.
    async function approveThenTransferFunds(from, to, amount) {
        // In the 'from' account, approve 'to' to be able to take funds.
        result.set(await CpuCoin.methods.approve(to, amount).send({from: from}));
        result.checkTransactionOk('approveThenTransferFunds(): approve failed');
        // Transfer approved funds 'from' -> 'to'.
        result.set(await CpuCoin.methods.transferFrom(from, to, amount).send({from: to}));
        result.checkTransactionOk('approveThenTransferFunds(): transferFrom failed');
    }

    if (runThisTest())
        it('11. verified ERC20 transfer/approve method', async () => {
            if (!CpuCoin) return;

            await subtest('11a. transfer owner->account1, then verify balances', async () => {
                await approveThenTransferFunds(owner, account1, tokensToWei(10000));
                // Verify new balances.
                result.set(await CpuCoin.methods.balanceOf(owner).call());
                result.checkIsEqual(tokensToWei(TOTAL_SUPPLY - 10000));
                result.set(await CpuCoin.methods.balanceOf(account1).call());
                result.checkIsEqual(tokensToWei(10000));
                // Verify allowances
                result.set(await CpuCoin.methods.allowance(owner, account1).call());
                result.checkIsEqual(0);
                result.set(await CpuCoin.methods.allowance(account1, owner).call());
                result.checkIsEqual(0);
            }).catch(catcher);

            await subtest('11b. make transfer account1->account2, then verify balances', async () => {
                await approveThenTransferFunds(account1, account2, tokensToWei(1000));
                // Verify new balances.
                result.set(await CpuCoin.methods.balanceOf(account1).call());
                result.checkIsEqual(tokensToWei(9000));
                result.set(await CpuCoin.methods.balanceOf(account2).call());
                result.checkIsEqual(tokensToWei(1000));
                // Verify allowances
                result.set(await CpuCoin.methods.allowance(account1, account2).call());
                result.checkIsEqual(0);
                result.set(await CpuCoin.methods.allowance(account2, account1).call());
                result.checkIsEqual(0);
            }).catch(catcher);

            await subtest('11c. trying to transfer more tokens than the balance will fail', async () => {
                result.set(await expectFail(approveThenTransferFunds(account1, account2, tokensToWei(999999))).catch(catcher));
                result.checkDidFail();
                // Revoke the failed approval
                await CpuCoin.methods.approve(account2, 0).send({from: account1});
                // Verify nothing changed.
                result.set(await CpuCoin.methods.balanceOf(account1).call());
                result.checkIsEqual(tokensToWei(9000));
                result.set(await CpuCoin.methods.balanceOf(account2).call());
                result.checkIsEqual(tokensToWei(1000));
                // Verify allowances
                result.set(await CpuCoin.methods.allowance(account1, account2).call());
                result.checkIsEqual(0);
                result.set(await CpuCoin.methods.allowance(account2, account1).call());
                result.checkIsEqual(0);
            }).catch(catcher);

            await subtest('11d. smaller transfer succeeds after prior failed transfer', async () => {
                await approveThenTransferFunds(account1, account2, tokensToWei(9000));
                // Verify new balances.
                result.set(await CpuCoin.methods.balanceOf(account1).call());
                result.checkIsEqual(0);
                result.set(await CpuCoin.methods.balanceOf(account2).call());
                result.checkIsEqual(tokensToWei(10000));
                // Verify allowances
                result.set(await CpuCoin.methods.allowance(account1, account1).call());
                result.checkIsEqual(0);
                result.set(await CpuCoin.methods.allowance(account2, account1).call());
                result.checkIsEqual(0);
            }).catch(catcher);
        });

    // --------------------------------------------------------------------------------
    if (runThisTest())
        it('12. verified transferFrom() fails without prior approval', async () => {
            if (!CpuCoin) return;

            await subtest('12a. account1 can\'t transfer from owner to account2', async () => {
                result.set(await expectFail(CpuCoin.methods.transferFrom(owner, account2, tokensToWei(5 * ONE_MILLION)).send({from: account1})).catch(catcher));
                result.checkDidFail();
            }).catch(catcher);

            await subtest('12b. owner can\'t transfer from account1 to account2', async () => {
                result.set(await expectFail(CpuCoin.methods.transferFrom(account1, account2, tokensToWei(5 * ONE_MILLION)).send({from: owner})).catch(catcher));
                result.checkDidFail();
            }).catch(catcher);

            await subtest('12c. owner can\'t transfer from owner to account1', async () => {
                result.set(await expectFail(CpuCoin.methods.transferFrom(owner, account1, tokensToWei(5 * ONE_MILLION)).send({from: owner})).catch(catcher));
                result.checkDidFail();
            }).catch(catcher);

            await subtest('12d. owner can\'t transfer from owner to owner', async () => {
                result.set(await expectFail(CpuCoin.methods.transferFrom(owner, owner, tokensToWei(5 * ONE_MILLION)).send({from: owner})).catch(catcher));
                result.checkDidFail();
            }).catch(catcher);
        });

    // --------------------------------------------------------------------------------
    if (runThisTest())
        it('13. burn tokens', async () => {
            if (!CpuCoin) return;

            await subtest('13a. check initial total supply', async () => {
                result.set(await CpuCoin.methods.totalSupply().call());
                result.checkIsEqual(tokensToWei(TOTAL_SUPPLY));
            }).catch(catcher);

            let remainingSupply = TOTAL_SUPPLY;

            await subtest('13b. non-owner can burn own tokens.', async () => {
                // Transfer 100M to account 1
                result.set(await CpuCoin.methods.transfer(account1, tokensToWei(100 * ONE_MILLION)).send({from: owner}));
                result.checkTransactionOk();
                result.set(await CpuCoin.methods.balanceOf(account1).call());
                result.checkIsEqual(tokensToWei(100 * ONE_MILLION));
                // Try to burn 50M from account 1
                result.set(await CpuCoin.methods.burn(tokensToWei(40 * ONE_MILLION)).send({from: account1}));
                result.checkTransactionOk();
                // Confirm tokens are gone
                result.set(await CpuCoin.methods.balanceOf(account1).call());
                result.checkIsEqual(tokensToWei(100 * ONE_MILLION - 40 * ONE_MILLION));
                // Check impact on total supply
                remainingSupply -= 40 * ONE_MILLION;
                result.set(await CpuCoin.methods.totalSupply().call());
                result.checkIsEqual(tokensToWei(remainingSupply));
            }).catch(catcher);

            // At this point, 100M tokens have left owner wallet.

            await subtest('13c. owner can burn own tokens', async () => {
                result.set(await CpuCoin.methods.totalSupply().call());
                result.checkIsEqual(tokensToWei(remainingSupply));
                // Try to burn 50M from owner
                result.set(await CpuCoin.methods.burn(tokensToWei(50 * ONE_MILLION)).send({from: owner}));
                result.checkTransactionOk();
                // Confirm tokens are gone
                result.set(await CpuCoin.methods.balanceOf(owner).call());
                result.checkIsEqual(tokensToWei(TOTAL_SUPPLY - 100 * ONE_MILLION - 50 * ONE_MILLION));
                // Check impact on total supply
                remainingSupply -= 50 * ONE_MILLION;
                result.set(await CpuCoin.methods.totalSupply().call());
                result.checkIsEqual(tokensToWei(remainingSupply));
            }).catch(catcher);
        });


    // ================================================================================
    // === Test grants and vesting
    // ================================================================================

    const VALID_PAST_START_DAY = JAN_1_2000_DAYS + TEN_YEARS_DAYS;      // Use 2010 as start date for tests.

    Object.size = function (obj) {
        var size = 0, key;
        for (key in obj) {
            if (obj.hasOwnProperty(key)) size++;
        }
        return size;
    };

    if (runThisTest())
        it('20. test today()', async () => {
            if (!CpuCoin) return;

            await subtest('20a. theck today() computation', async () => {
                result.set(await CpuCoin.methods.today().call());
                result.checkIsEqual(TODAY_DAYS);
            }).catch(catcher);
        });

    // --------------------------------------------------------------------------------

    async function testGrantVestingTokens(owner, account, grantParams, vestingSchedule) {
        result.set(await CpuCoin.methods.grantVestingTokens(
            account, ...grantParams, ...vestingSchedule).send({from: owner, gas: GRANTGAS}));
        result.checkTransactionOk();

        return true;    // Success if didn't throw
    }

    // Helper function for issuing a grant and verifying the balance.
    async function testGrantVestingTokens_balances(owner, account, [totalAmount, vestingAmount, startDay], [duration, cliffDuration, interval, isRevocable]) {
        // Verify token balances (tokens moved) and new grant size.
        const ownerBalanceBefore = await CpuCoin.methods.balanceOf(owner).call();
        const accountBalanceBefore = await CpuCoin.methods.balanceOf(account).call();
        if (log) logNamedValue('-> accountBalanceBefore', accountBalanceBefore);

        await testGrantVestingTokens(owner, account,
            [totalAmount, vestingAmount, startDay],
            [duration, cliffDuration, interval, isRevocable]);
        result.checkTransactionOk();

        // Verify token balances (vested portion should have moved out of owner into account) and new grant size.
        const ownerBalance = await CpuCoin.methods.balanceOf(owner).call();
        if (log) logNamedValue('-> ownerBalance', ownerBalance);
        if (log) logNamedValue('-> ownerBalanceBefore', ownerBalanceBefore);
        if (log) logNamedValue('-> totalAmount', totalAmount);
        checkAreEqualR(weiToTokens(ownerBalance), weiToTokens(ownerBalanceBefore) - weiToTokens(totalAmount), 'owner wallet should have decreased by grant size');
        let accountBalance = await CpuCoin.methods.balanceOf(account).call();
        if (log) logNamedValue('-> accountBalance', accountBalance);
        if (log) logNamedValue('->    totalAmount', totalAmount);
        checkAreEqual(weiToTokens(accountBalance), weiToTokens(accountBalanceBefore) + weiToTokens(totalAmount), 'grantee shows the ' + totalAmount + ' tokens having been granted.');

        // Check vesting is gone
        accountBalance = await CpuCoin.methods.vestingAsOf(Math.floor(startDay)).call({from: account, gas: VESTASOFGAS});
        checkAreEqual(accountBalance[0], 0, 'grantee tokens vested');
        checkAreEqual(accountBalance[1], vestingAmount, 'grantee tokens not vested');
        checkAreEqual(accountBalance[2], vestingAmount, 'grantee total granted tokens');
        checkAreEqual(accountBalance[3], startDay, 'grant startDay');
        checkAreEqual(accountBalance[4], duration, 'grant duration');
        checkAreEqual(accountBalance[5], cliffDuration, 'grant cliff duration');
        checkAreEqual(accountBalance[6], interval, 'grant interval');
        checkAreEqual(accountBalance[7], true, 'grant isActive');
        checkAreEqual(accountBalance[8], false, 'grant wasRevoked');

        return true;    // Success if didn't throw
    }

    // Helper function to verify the vesting schedule day by day over many days
    async function testVestingScheduleDayByDay(account, [totalAmount, vestingAmount, startDay], [duration, cliffDuration, interval, isRevocable = false]) {
        // Verify unvested balance day by day, starting 2 days before day 0, and ending 2 days after the last day.
        const dayIncrement = (interval % 3 === 0) ? interval / 3 : interval / 2;
        for (let elapsedDays = -dayIncrement; elapsedDays <= (duration + dayIncrement); elapsedDays += dayIncrement) {
            const onDay = startDay + elapsedDays;

            // Test using the account holder direct access method
            result.set(await CpuCoin.methods.vestingAsOf(Math.floor(onDay)).call({from: account, gas: VESTASOFGAS}));
            checkResult('vestingAsOf() ');

            // Test using the grant administrator access method
            result.set(await CpuCoin.methods.vestingForAccountAsOf(account, Math.floor(onDay)).call({from: account}));
            checkResult('vestingForAccountAsOf() ');

            function checkResult(msg) {
                const effectiveElapsedDays = Math.floor(elapsedDays / interval) * interval;
                const expectedVested = vestingAmount * (
                    elapsedDays < cliffDuration ? 0
                        : elapsedDays >= duration ? 1.0
                        : effectiveElapsedDays / duration
                );
                const expectedNotVested = vestingAmount - expectedVested;
                const [actualVestedAmount, actualNotVestedAmount, actualvestingAmount] =
                    [result.value()[0], result.value()[1], result.value()[2]];

                if (log) console.log(colors.grey(msg + '      on day ' + elapsedDays + '/' + duration + ', expected [' + round(expectedNotVested) + ', ' + vestingAmount + '] got => [' + round(actualNotVestedAmount) + ', ' + actualvestingAmount + ']'));
                checkAreEqualR(actualVestedAmount, vestingAmount - expectedNotVested, msg + 'tokens vested is incorrect');
                checkAreEqualR(actualNotVestedAmount, expectedNotVested, msg + 'tokens not vested is incorrect');
                checkAreEqualR(actualvestingAmount, vestingAmount, msg + 'reported grant size is incorrect');
                checkAreEqual(result.value()[3], startDay, msg + 'grant startDay value is incorrect');
                checkAreEqual(result.value()[4], duration, msg + 'grant duration value is incorrect');
                checkAreEqual(result.value()[5], cliffDuration, msg + 'grant cliff duration value is incorrect');
                checkAreEqual(result.value()[6], interval, msg + 'grant interval value is incorrect');
                checkAreEqual(result.value()[7], true, msg + 'grant isActive value is incorrect');
                checkAreEqual(result.value()[8], false, msg + 'grant wasRevoked value is incorrect');
            }
        }
        return true;    // Success if didn't throw
    }

    async function testVestingSchedule(owner, account, grantParams, vestingSchedule) {
        await testGrantVestingTokens_balances(owner, account, grantParams, vestingSchedule).catch(catcher);
        await testVestingScheduleDayByDay(account, grantParams, vestingSchedule).catch(catcher);
        return true;    // Success if didn't throw
    }

    async function testAccountHasNoGrant(account, wasRevoked, onDay) {
        result.set(await CpuCoin.methods.vestingAsOf(onDay).call({from: account, gas: VESTASOFGAS}));
        checkAreEqual(result.value()[0], 0);    // vestedAmount should be 0

        checkAreEqual(result.value()[7], false, 'grant isActive');
        checkAreEqual(result.value()[8], wasRevoked, 'grant wasRevoked');

        return true;    // Success if didn't throw
    }

    // --------------------------------------------------------------------------------
    if (runThisTest())
        it('21. test grantVestingTokens() success cases', async () => {
            if (!CpuCoin) return;

            await subtest('21a. verified simple grant to account1 (12,0,3)', async () => {
                result.set(await testVestingSchedule(owner, account1,
                    [tokensToWei(1001), tokensToWei(1000), VALID_PAST_START_DAY],
                    [12, 0, 3, false]).catch(catcher));
                result.checkTransactionOk();
            }).catch(catcher);

            await subtest('21b. verified simple grant to account2 (12,0,4)', async () => {
                result.set(await testVestingSchedule(owner, account2,
                    [tokensToWei(1001), tokensToWei(1000), VALID_PAST_START_DAY],
                    [12, 0, 4, false]).catch(catcher));
                result.checkTransactionOk();
            }).catch(catcher);

            await subtest('21c. verified grant to account5 (100,25,5)', async () => {
                result.set(await testVestingSchedule(owner, accounts[5],
                    [tokensToWei(ONE_MILLION), tokensToWei(ONE_MILLION), VALID_PAST_START_DAY],
                    [100, 25, 5, false]).catch(catcher));
                result.checkTransactionOk();
            }).catch(catcher);

            // Mix things up by changing the contract owner before continuing to issue more grants.
            // This confirms that a new owner can issue grants just the same (given enough funds).
            result.set(await CpuCoin.methods.registerAccount().send({from: account9}));
            result.checkTransactionOk();
            result.set(await CpuCoin.methods.safeTransfer(account9, tokensToWei(100 * ONE_MILLION)).send({from: owner}));
            result.checkTransactionOk();
            result.set(await CpuCoin.methods.transferOwnership(account9).send({from: owner, gas: XFEROWNERGAS}));
            result.checkTransactionOk();

            // Transferred ownership: In this test from here on, owner is now account9.

            await subtest('21d. verified grant to account6 (180,90,30)', async () => {
                result.set(await testVestingSchedule(account9, account6,
                    [tokensToWei(2 * ONE_MILLION), tokensToWei(ONE_MILLION), VALID_PAST_START_DAY + 365],
                    [180, 90, 30, false]).catch(catcher));
                result.checkTransactionOk();
            }).catch(catcher);

            await subtest('21e. verified grant to account7 (360*5,360,90)', async () => {
                result.set(await testVestingSchedule(account9, account7,
                    [tokensToWei(10 * ONE_MILLION), tokensToWei(8 * ONE_MILLION), VALID_PAST_START_DAY + 88],
                    [360 * 5, 360, 90, false]).catch(catcher));
                result.checkTransactionOk();
            }).catch(catcher);

            await subtest('21f. verified grant to account8 (365*3,365,73)', async () => {
                result.set(await testVestingSchedule(account9, account8,
                    [tokensToWei(.25 * ONE_MILLION), tokensToWei(.25 * ONE_MILLION), VALID_PAST_START_DAY + 88],
                    [365 * 3, 365, 73, false]).catch(catcher));
                result.checkTransactionOk();
            }).catch(catcher);

        }).timeout(10000);   // Takes a while to run because of the day-by-day checks.

    // --------------------------------------------------------------------------------
    if (runThisTest())
        it('22. test grantVestingTokens() failure cases (double-grant, phantom grant)', async () => {
            if (!CpuCoin) return;

            await subtest('22a. verified no initial grant exists', async () => {
                // Verify initially checking a grant before one was issued works, but returns 0
                result.set(await (testAccountHasNoGrant(owner, false, VALID_PAST_START_DAY)).catch(catcher));
                result.checkIsTrue();
                result.set(await (testAccountHasNoGrant(account1, false, VALID_PAST_START_DAY)).catch(catcher));
                result.checkIsTrue();
                result.set(await (testAccountHasNoGrant(account2, false, VALID_PAST_START_DAY)).catch(catcher));
                result.checkIsTrue();
                // Check again
                result.set(await (testAccountHasNoGrant(owner, false, VALID_PAST_START_DAY)).catch(catcher));
                result.checkIsTrue();
                result.set(await (testAccountHasNoGrant(account1, false, VALID_PAST_START_DAY)).catch(catcher));
                result.checkIsTrue();
                result.set(await (testAccountHasNoGrant(account2, false, VALID_PAST_START_DAY)).catch(catcher));
                result.checkIsTrue();
            }).catch(catcher);

            await subtest('22a. verify additional grant to same account fails', async () => {
                // Make first grant (will succeed)
                result.set(await testGrantVestingTokens_balances(owner, account1,
                    [tokensToWei(2000), tokensToWei(1000), VALID_PAST_START_DAY],
                    [12, 0, 3, false]));
                result.checkTransactionOk();

                // Make a subsequent grant (will fail because one already exists)
                await expectFail(testGrantVestingTokens(owner, account1,
                    [tokensToWei(2000), tokensToWei(1000), VALID_PAST_START_DAY],
                    [12, 0, 3, false])).catch(catcher);
                result.checkDidFail();
            }).catch(catcher);
        });

    // --------------------------------------------------------------------------------
    if (runThisTest())
        it('23. test grantVestingTokens() failure cases (account limits, ownership transfer)', async () => {
            if (!CpuCoin) return;

            await subtest('23a. verified only owner can grant', async () => {
                result.set(await expectFail(testGrantVestingTokens_balances(account9, account1,
                    [tokensToWei(2000), tokensToWei(1000), VALID_PAST_START_DAY],
                    [12, 0, 3, false])).catch(catcher));
            }).catch(catcher);
            result.checkDidFail();

            // Fund account 9 so it can issue grants, then make it owner.
            const newOwner = account9;
            await CpuCoin.methods.registerAccount().send({from: newOwner});
            await CpuCoin.methods.safeTransfer(newOwner, tokensToWei(100 * ONE_MILLION)).send({from: owner});
            await CpuCoin.methods.transferOwnership(newOwner).send({from: owner, gas: XFEROWNERGAS});

            // Transferred ownership: In this test from here on, owner is now account9.

            await subtest('23b. verified old owner can no longer grant', async () => {
                result.set(await expectFail(testGrantVestingTokens_balances(owner, account1,
                    [tokensToWei(2000), tokensToWei(1000), VALID_PAST_START_DAY],
                    [12, 0, 3], false)).catch(catcher));
            }).catch(catcher);
            result.checkDidFail();

            await subtest('23c. verified can\'t transfer more than what\'s held', async () => {
                result.set(await expectFail(testGrantVestingTokens_balances(newOwner, account1,
                    [tokensToWei(100 * ONE_MILLION + 1), tokensToWei(100 * ONE_MILLION + 1), VALID_PAST_START_DAY],
                    [100, 25, 5, false])).catch(catcher));
            }).catch(catcher);
            result.checkDidFail();

            await subtest('23d. verified can grant all tokens held', async () => {
                result.set(await testGrantVestingTokens_balances(newOwner, account1,
                    [tokensToWei(100 * ONE_MILLION), tokensToWei(100 * ONE_MILLION), VALID_PAST_START_DAY],
                    [100, 25, 5, false]).catch(catcher));
            }).catch(catcher);
            result.checkTransactionOk();

            await subtest('23e. verified cannot create grant where vestingAmount > totalAmount', async () => {
                result.set(await expectFail(testGrantVestingTokens_balances(newOwner, account1,
                    [tokensToWei(100 * ONE_MILLION), tokensToWei(200 * ONE_MILLION), VALID_PAST_START_DAY],
                    [100, 25, 5, false])).catch(catcher));
            }).catch(catcher);
            result.checkDidFail();
        });

    if (runThisTest())
        it('24. test usage of granted tokens (contract use of today\'s date)', async () => {
            if (!CpuCoin) return;

            await subtest('24a. verified granted tokens outside of vesting can be transferred before vesting begins', async () => {
                // Make a grant in account1 starting today, with no given tokens.
                await testGrantVestingTokens_balances(owner, account1,
                    [tokensToWei(1000), tokensToWei(1000), TODAY_DAYS],
                    [12, 0, 3, false]).catch(catcher);

                // Make sure a transfer to account2 fails.
                result.set(await expectFail(CpuCoin.methods.transfer(account2, tokensToWei(1)).send({from: account1})).catch(catcher));
                result.checkDidFail();
            }).catch(catcher);

            await subtest('24a. verified no tokens can be transferred with an unvested grant', async () => {
                // Make a grant in account3 starting today, with no tokens.
                await testGrantVestingTokens_balances(owner, account3,
                    [tokensToWei(1001), tokensToWei(1000), TODAY_DAYS],
                    [12, 0, 3, false]).catch(catcher);

                // Make sure a small transfer to account4 succeeds.
                result.set(await CpuCoin.methods.transfer(account4, tokensToWei(1)).send({from: account3}));
                result.checkTransactionOk('Transfer of 1 token from grant was supposed to work');

                // Make sure a too-large transfer fails.
                result.set(await expectFail(CpuCoin.methods.transfer(account4, tokensToWei(2)).send({from: account3})).catch(catcher));
                result.checkDidFail();
            }).catch(catcher);
        });


    // ================================================================================
    // === Test grant revocation
    // ================================================================================

    async function testRevokeVestingSchedule(owner, account, [totalAmount, vestingAmount, startDay], [duration, cliffDuration, interval, isRevocable], revokeOnDay) {
        const ownerBalanceBefore = await CpuCoin.methods.balanceOf(owner).call();
        const accountBalanceBefore = await CpuCoin.methods.balanceOf(account).call();

        // First, make a test grant.
        await testGrantVestingTokens_balances(
            owner, account, [totalAmount, vestingAmount, startDay], [duration, cliffDuration, interval, isRevocable]);

        // Check how much would be vested at given revocation day
        result.set(await CpuCoin.methods.vestingAsOf(revokeOnDay).call({from: account, gas: VESTASOFGAS}));
        const vestedAsOfDay = result.value()[0];
        const notVestedAsOfDay = result.value()[1];

        const ownerBalanceAfterGrant = await CpuCoin.methods.balanceOf(owner).call();
        const accountBalanceAfterGrant = await CpuCoin.methods.balanceOf(account).call();
        checkAreEqualR(weiToTokens(ownerBalanceAfterGrant), weiToTokens(ownerBalanceBefore) - weiToTokens(totalAmount), 'grantor tokens should have decreased by full grant amount ' + totalAmount);
        checkAreEqualR(weiToTokens(accountBalanceAfterGrant), weiToTokens(accountBalanceBefore) + weiToTokens(totalAmount), 'grantee tokens should have increased by full grant amount ' + totalAmount);
        checkAreEqualR(result.value()[2], vestingAmount, 'grant vesting size should be ' + vestingAmount);

        const tokensKeptAtRevocation = totalAmount - notVestedAsOfDay;

        // Now, revoke the grant.
        result.set(await CpuCoin.methods.revokeGrant(account, revokeOnDay).send({from: owner, gas: REVOKEONGAS}));
        result.checkTransactionOk('revokeGrant() failed');

        // Verify token balances (tokens should NOT have moved)
        const ownerBalanceAfterRevocation = await CpuCoin.methods.balanceOf(owner).call();
        const accountBalanceRevocation = await CpuCoin.methods.balanceOf(account).call();
        checkAreEqualR(weiToTokens(ownerBalanceAfterRevocation), weiToTokens(ownerBalanceBefore) - weiToTokens(tokensKeptAtRevocation), 'grantor tokens should have decreased by ' + tokensKeptAtRevocation);
        checkAreEqualR(weiToTokens(accountBalanceRevocation), weiToTokens(accountBalanceBefore) + weiToTokens(tokensKeptAtRevocation), 'grantee supply should have increased by ' + tokensKeptAtRevocation);
        testAccountHasNoGrant(account, true, revokeOnDay).catch(catcher);

        // Verify all allowance was consumed (and no allowance was in th wrong place).
        result.set(await CpuCoin.methods.allowance(owner, account).call());
        result.checkIsEqual(0, 'There should be no leftover allowance in the correct direction');
        result.set(await CpuCoin.methods.allowance(account, owner).call());
        result.checkIsEqual(0, 'There should be no leftover allowance in the incorrect direction (can\'t hurt to be sure');
    }

    if (runThisTest())
        it('25. test date ranges and grant duration()', async () => {
            if (!CpuCoin) return;

            await subtest('25a. First, verify this schedule is allowed on a normal date', async () => {
                // This should work.
                result.set(await testGrantVestingTokens_balances(owner, account1,
                    [tokensToWei(100 * ONE_MILLION), tokensToWei(50 * ONE_MILLION), TODAY_DAYS],
                    [TEN_YEARS_DAYS, 0, 1, true]));
                result.checkTransactionOk();

                // Now, revoke the grant before the next tests.
                result.set(await CpuCoin.methods.revokeGrant(account1, TODAY_DAYS).send({from: owner, gas: REVOKEONGAS}));
                result.checkTransactionOk('revokeGrant() failed');
            }).catch(catcher);

            await subtest('25b. verified not allowed to create grants longer than 10 years', async () => {
                result.set(await expectFail(testGrantVestingTokens_balances(owner, account1,
                    [tokensToWei(100 * ONE_MILLION), tokensToWei(50 * ONE_MILLION), VALID_PAST_START_DAY],
                    [TEN_YEARS_DAYS + 1, 0, 1, true])).catch(catcher));
                result.checkDidFail();
            }).catch(catcher);

            await subtest('25c. verified not allowed to create grants before Jan 1, 2000', async () => {
                result.set(await expectFail(testGrantVestingTokens_balances(owner, account1,
                    [tokensToWei(100 * ONE_MILLION), tokensToWei(50 * ONE_MILLION), JAN_1_2000_DAYS - 1],
                    [100, 0, 1, true])).catch(catcher));
                result.checkDidFail();
            }).catch(catcher);

            await subtest('25d. verified not allowed to create grants on/after Jan 1, 2100', async () => {
                result.set(await expectFail(testGrantVestingTokens_balances(owner, account1,
                    [tokensToWei(100 * ONE_MILLION), tokensToWei(50 * ONE_MILLION), JAN_1_3000_DAYS],
                    [100, 0, 1, true])).catch(catcher));
                result.checkDidFail();
            }).catch(catcher);
        }).timeout(5000);   // Takes a while to run because of the granting and revoking.

    if (runThisTest())
        it('26. test revokeGrant()', async () => {
            if (!CpuCoin) return;

            await subtest('26a. verified revoke after simple grant to account1 (360,90,30)', async () => {
                await testRevokeVestingSchedule(owner, account1,
                    [tokensToWei(1001), tokensToWei(1000), TODAY_DAYS],
                    [360, 90, 30, true],
                    TODAY_DAYS);
            }).catch(catcher);

            await subtest('26b. should be able to re-attempt another grant to account1 after it not longer has a grant', async () => {
                await testGrantVestingTokens(owner, account1,
                    [tokensToWei(1001), tokensToWei(1000), TODAY_DAYS],
                    [360, 90, 30, true],
                    TODAY_DAYS);
                result.checkTransactionOk();

                // Now, revoke the grant before the next tests.
                result.set(await CpuCoin.methods.revokeGrant(account1, TODAY_DAYS).send({from: owner, gas: REVOKEONGAS}));
                result.checkTransactionOk('revokeGrant() failed');
            }).catch(catcher);

            await subtest('26c. verified can revoke grant issued before today ON today', async () => {
                await testRevokeVestingSchedule(owner, account1,
                    [tokensToWei(1001), tokensToWei(1000), TODAY_DAYS - 10],
                    [360, 90, 30, true],
                    TODAY_DAYS);
            }).catch(catcher);

            await subtest('26d. verified cannot revoke grant issued before today BEFORE today', async () => {
                await expectFail(testRevokeVestingSchedule(owner, account1,
                    [tokensToWei(1001), tokensToWei(1000), TODAY_DAYS - 10],
                    [360, 90, 30, true],
                    TODAY_DAYS - 1)).catch(catcher);

                // Now, revoke the grant before the next tests.
                result.set(await CpuCoin.methods.revokeGrant(account1, TODAY_DAYS).send({from: owner, gas: REVOKEONGAS}));
                result.checkTransactionOk('revokeGrant() failed');
            }).catch(catcher);

            await subtest('26e. verified partially vested grant (early)', async () => {
                await testRevokeVestingSchedule(owner, account1,
                    [tokensToWei(1001), tokensToWei(1000), TODAY_DAYS - 111],
                    [360, 90, 30, true],
                    TODAY_DAYS);
            }).catch(catcher);

            await subtest('26f. verified partially vested grant (mid)', async () => {
                await testRevokeVestingSchedule(owner, account1,
                    [tokensToWei(1001), tokensToWei(1000), TODAY_DAYS - 273],
                    [360, 90, 30, true],
                    TODAY_DAYS);
            }).catch(catcher);

            await subtest('26g. verified partially vested grant (late)', async () => {
                await testRevokeVestingSchedule(owner, account1,
                    [tokensToWei(1001), tokensToWei(1000), TODAY_DAYS - 359],
                    [360, 90, 30, true],
                    TODAY_DAYS);
            }).catch(catcher);

            await subtest('26h. verified partially vested grant (after vested)', async () => {
                await expectFail(testRevokeVestingSchedule(owner, account1,
                    [tokensToWei(1001), tokensToWei(1000), TODAY_DAYS - 400],
                    [360, 90, 30, true],
                    TODAY_DAYS), 'no effect').catch(catcher);
            }).catch(catcher);
        }).timeout(5000);   // Takes a while to run because of the granting and revoking.

    if (runThisTest())
        it('27. Test onlyGrantorOrSelf() modifier of vestingForAccountAsOf()', async () => {
            if (!CpuCoin) return;

            const numReturnValues = 9;
            const resultSize = numReturnValues * 2;   /* Because indexed and named value is returned for each */

            // It should work that any account can call vestingAsOf(), which returns self-vesting
            result.set(await CpuCoin.methods.vestingAsOf(Math.floor(TODAY_DAYS)).call({from: owner, gas: VESTASOFGAS}));
            checkAreEqual(Object.size(result.value()), resultSize, 'Expected result to be the result tuple');
            result.set(await CpuCoin.methods.vestingAsOf(Math.floor(TODAY_DAYS)).call({from: account1, gas: VESTASOFGAS}));
            checkAreEqual(Object.size(result.value()), resultSize, 'Expected result to be the result tuple');

            // It should work that owner can call vestingForAccountAsOf() for account1 (because owner is grantor)
            result.set(await CpuCoin.methods.vestingForAccountAsOf(account1, Math.floor(TODAY_DAYS)).call({from: owner}));
            checkAreEqual(Object.size(result.value()), resultSize, 'Expected result to be the result tuple');
            // It should also work that account1 can call vestingForAccountAsOf() for self
            result.set(await CpuCoin.methods.vestingForAccountAsOf(account1, Math.floor(TODAY_DAYS)).call({from: account1}));
            checkAreEqual(Object.size(result.value()), resultSize, 'Expected result to be the result tuple');

            // However, account2 should be prevented from looking at account1.
            result.set(await expectFail(CpuCoin.methods.vestingForAccountAsOf(account1, Math.floor(TODAY_DAYS)).call({from: account2})).catch(catcher));
            result.checkDidFail();
        });


    // ================================================================================
    // === Test roles behavior (adding/revoking/transferring).
    // ================================================================================
    async function testRoleBehavior(testNumber, roleName, isRoleMethod, addRoleMethod, addRoleParams, removeRoleMethod) {
        result.set(await CpuCoin.methods.isOwner().call({from: owner}));
        result.checkIsTrue('Expected original owner to be owner');
        result.set(await CpuCoin.methods[isRoleMethod](owner).call({from: owner}));
        result.checkIsTrue('Expected original owner to have role ' + roleName);

        await subtest(testNumber + 'a. transfer contract ownership to account 1', async () => {
            result.set(await CpuCoin.methods.registerAccount().send({from: account1}));
            result.checkTransactionOk();
            result.set(await CpuCoin.methods.transferOwnership(account1).send({from: owner, gas: XFEROWNERGAS}));
            result.checkTransactionOk('should have been able to transfer ownership');
            result.set(await CpuCoin.methods.owner().call({from: owner}));
            result.checkIsEqual(account1);
        }).catch(catcher);

        // Transferred ownership: In this test from here on, owner is now account1.

        await subtest(testNumber + 'b. Check that original owner is no longer owner and no longer has role ' + roleName, async () => {
            result.set(await CpuCoin.methods.isOwner().call({from: owner}));
            result.checkIsFalse("after transfer, original owner should no longer be owner");
            result.set(await CpuCoin.methods[isRoleMethod](owner).call({from: owner}));
            result.checkIsFalse("after transfer, original owner should no longer have role " + roleName);
        });

        await subtest(testNumber + 'c. Check that new owner is now both owner and has role ' + roleName, async () => {
            result.set(await CpuCoin.methods.isOwner().call({from: account1}));
            result.checkIsTrue("after transfer, account1 should be owner");
            result.set(await CpuCoin.methods[isRoleMethod](account1).call({from: account1}));
            result.checkIsTrue("after transfer, account1 should have role " + roleName);
        }).catch(catcher);

        await subtest(testNumber + 'd. test remove role ' + roleName + ' from owner account1, leaving no other account having role (specifically allowed!)', async () => {
            result.set(await CpuCoin.methods[removeRoleMethod](account1).send({from: account1}));
            result.checkTransactionOk('account1 as new owner should have been able to remove self as having role ' + roleName);
            result.set(await CpuCoin.methods[isRoleMethod](owner).call({from: owner}));
            result.checkIsFalse("original owner should not have role " + roleName);
            result.set(await CpuCoin.methods[isRoleMethod](account1).call({from: account1}));
            result.checkIsFalse("account1 should not have role " + roleName + " either");
        }).catch(catcher);

        await subtest(testNumber + 'e. test addRoleMethod() success cases', async () => {
            result.set(await CpuCoin.methods[addRoleMethod](account5, ...addRoleParams).send({from: account1}));
            result.checkTransactionOk('account1 as new owner should have been able to give account5 role ' + roleName);
            result.set(await CpuCoin.methods[isRoleMethod](account5).call({from: account5}));
            result.checkIsTrue("account5 should now have role " + roleName);
            result.set(await CpuCoin.methods[isRoleMethod](account5).call({from: account1}));
            result.checkIsTrue("account5 should now have role " + roleName + " (even if other account performs the inspection)");
            result.set(await CpuCoin.methods[removeRoleMethod](account5).send({from: account1}));
            result.checkTransactionOk('account1 as new owner should have been able to remove account5 as having role ' + roleName);
            result.set(await CpuCoin.methods[isRoleMethod](account5).call({from: account5}));
            result.checkIsFalse("account5 should no longer have role " + roleName);
            result.set(await CpuCoin.methods[isRoleMethod](account5).call({from: account1}));
            result.checkIsFalse("account5 should bo longer have role " + roleName + " (even if other account performs the inspection)");
        }).catch(catcher);

        await subtest(testNumber + 'f. test addRoleMethod() failure cases', async () => {
            result.set(await CpuCoin.methods[isRoleMethod](account3).call({from: owner}));
            result.checkIsFalse("account3 should start off not having role " + roleName);
            result.set(await expectFail(CpuCoin.methods[addRoleMethod](account3, ...addRoleParams).send({from: owner})).catch(catcher));
            result.checkDidFail();
            result.set(await CpuCoin.methods[isRoleMethod](account3).call({from: owner}));
            result.checkIsFalse("account3 doesn't have role " + roleName + " after attempting to add it");

            // Repeat using account6, which was never owner or roleName
            result.set(await CpuCoin.methods[isRoleMethod](account3).call({from: account6}));
            result.checkIsFalse("account3 should start off not having role " + roleName);
            result.set(await expectFail(CpuCoin.methods[addRoleMethod](account3, ...addRoleParams).send({from: account6})).catch(catcher));
            result.checkDidFail();
            result.set(await CpuCoin.methods[isRoleMethod](account3).call({from: account6}));
            result.checkIsFalse("account3 does not have role " + roleName + " after attempting to add it");
        }).catch(catcher);

        await subtest(testNumber + 'g. non-owner (without the role) trying to add/remove role' + roleName, async () => {
            result.set(await expectFail(CpuCoin.methods[addRoleMethod](account4, ...addRoleParams).send({from: account3})).catch(catcher));
            result.checkDidFail();
            result.set(await expectFail(CpuCoin.methods[removeRoleMethod](account4).send({from: account3})).catch(catcher));
            result.checkDidFail('account3 should NOT have been able to remove role ' + roleName + ' from other account');
        }).catch(catcher);

        await subtest(testNumber + 'h. non-owner should not be able to add/remove role' + roleName, async () => {
            result.set(await expectFail(CpuCoin.methods[addRoleMethod](account3, ...addRoleParams).send({from: owner})).catch(catcher));
            result.checkDidFail('Original owner should NOT have been able to add role for account3 (account1 is owner)');
            result.set(await expectFail(CpuCoin.methods[addRoleMethod](account4, ...addRoleParams).send({from: account3})).catch(catcher));
            result.checkDidFail('account3 owner should NOT be able to add role for account4 (only account1 can)');
            result.set(await expectFail(CpuCoin.methods[removeRoleMethod](account4).send({from: account3})).catch(catcher));
            result.checkDidFail('account3 should NOT have been able to remove role ' + roleName + ' from other account');
            result.set(await expectFail(CpuCoin.methods[removeRoleMethod](account1).send({from: account3})).catch(catcher));
            result.checkDidFail('account3 should NOT have been able to remove role ' + roleName + ' from actual role holder');
        }).catch(catcher);

        await subtest(testNumber + 'i. non-owner (having the role) should not be able to add/remove role' + roleName, async () => {
            result.set(await CpuCoin.methods[addRoleMethod](account5, ...addRoleParams).send({from: account1}));
            result.checkTransactionOk();
            result.set(await CpuCoin.methods[isRoleMethod](account5).call({from: account1}));
            result.checkIsTrue("We just set this role, it should be " + roleName);
            result.set(await expectFail(CpuCoin.methods[addRoleMethod](account6, ...addRoleParams).send({from: account5})).catch(catcher));
            result.checkDidFail('Account with role ' + roleName + ' should NOT have been able to add same role.');
            result.set(await expectFail(CpuCoin.methods[removeRoleMethod](account6).send({from: account5})).catch(catcher));
            result.checkDidFail('Account with role ' + roleName + ' should NOT have been able to remove same role.');
            result.set(await CpuCoin.methods[removeRoleMethod](account5).send({from: account1}));
            result.checkTransactionOk();
        }).catch(catcher);
    }

    // Note: these tests somewhat overlap test #6
    if (runThisTest())
        it('30. Test Grantor role isRole/addRole/removeRole behavior (with ownership change)', async () => {
            if (!CpuCoin) return;
            await testRoleBehavior(30, 'grantor', 'isGrantor', 'addGrantor', [false], 'removeGrantor').catch(catcher);
        });

    if (runThisTest())
        it('31. Test Pauser role isRole/addRole/removeRole behavior (with ownership change)', async () => {
            if (!CpuCoin) return;
            await testRoleBehavior(31, 'pauser', 'isPauser', 'addPauser', [], 'removePauser').catch(catcher);
        });

    async function testPausableMethod(method, methodParams, from) {
        // Try a valid ERC20 call while not paused
        result.set(await method(...methodParams).send({from: from}));
        result.checkTransactionOk('Contract is not paused, so this should have worked');

        // Pause the contract
        result.set(await CpuCoin.methods.pause().send({from: owner}));
        result.checkTransactionOk();

        // Try pausing while already paused
        result.set(await expectFail(method(...methodParams).send({from: from})).catch(catcher));
        result.checkDidFail();

        // Put things back
        result.set(await CpuCoin.methods.unpause().send({from: owner}));
        result.checkTransactionOk();
    }

    if (runThisTest())
        it('32. test that pausable ERC20 functionality is blocked while paused', async () => {
            if (!CpuCoin) return;

            // Make sure account1 and account2 have some tokens so the account can transfer and be approved as spender.
            result.set(await CpuCoin.methods.transfer(account1, tokensToWei(100 * ONE_MILLION)).send({from: owner}));
            result.checkTransactionOk();
            result.set(await CpuCoin.methods.transfer(account2, tokensToWei(100 * ONE_MILLION)).send({from: owner}));
            result.checkTransactionOk();

            await subtest('32a. try a valid call to transfer(), paused and not paused', async () => {
                await testPausableMethod(
                    CpuCoin.methods.transfer,
                    [account1, tokensToWei(ONE_MILLION)],
                    owner).catch(catcher);
            }).catch(catcher);

            await subtest('32b. try a valid call to approve(), paused and not paused', async () => {
                await testPausableMethod(
                    CpuCoin.methods.approve,
                    [account2, tokensToWei(ONE_MILLION)],
                    account1).catch(catcher);
            }).catch(catcher);

            // Owner approves account 3 to spend a million
            result.set(await CpuCoin.methods.approve(account3, tokensToWei(ONE_MILLION)).send({from: owner}));
            result.checkTransactionOk();

            await subtest('32c. try a valid call to transferFrom(), paused and not paused', async () => {
                await testPausableMethod(
                    CpuCoin.methods.transferFrom,
                    [owner, account3, tokensToWei(ONE_MILLION)],
                    account3).catch(catcher);
            }).catch(catcher);

            await subtest('32d. try a valid call to increaseAllowance(), paused and not paused', async () => {
                await testPausableMethod(
                    CpuCoin.methods.increaseAllowance,
                    [account5, tokensToWei(ONE_MILLION)],
                    account2).catch(catcher);
            }).catch(catcher);

            await subtest('32e. try a valid call to decreaseAllowance(), paused and not paused', async () => {
                await testPausableMethod(
                    CpuCoin.methods.decreaseAllowance,
                    [account5, tokensToWei(ONE_MILLION)],
                    account2).catch(catcher);
            }).catch(catcher);
        });

    if (runThisTest())
        it('33. additional pausable tests', async () => {
            if (!CpuCoin) return;

            // Contract is not paused.

            // Disallowed: non-pauser role pausing the not-paused contract.
            result.set(await expectFail(CpuCoin.methods.pause().send({from: account7})).catch(catcher));
            result.checkDidFail();
            // Allowed: owner (pauser role) pausing the not-paused contract.
            result.set(await CpuCoin.methods.pause().send({from: owner}));
            result.checkTransactionOk();

            // Contract is paused now.

            // Disallowed: owner (pauser role) trying to pause while already paused.
            result.set(await expectFail(CpuCoin.methods.pause().send({from: owner})).catch(catcher));
            result.checkDidFail();
            // Disallowed: non-pauser role unpausing the paused contract.
            result.set(await expectFail(CpuCoin.methods.unpause().send({from: account7})).catch(catcher));
            result.checkDidFail();
            // Allowed: owner (pauser role) unpausing the paused contract.
            result.set(await CpuCoin.methods.unpause().send({from: owner}));
            result.checkTransactionOk();

            // Contract is no longer paused.

            // Disallowed: owner (pauser role) unpausing the not-paused contract.
            result.set(await expectFail(CpuCoin.methods.unpause().send({from: owner})).catch(catcher));
            result.checkDidFail();
        });

    if (runThisTest())
        it('34. Test kill()', async () => {
            if (!CpuCoin) return;

            await subtest('34a. kill when not paused', async () => {
                result.set(await expectFail(CpuCoin.methods.kill().send({from: account1})).catch(catcher));
                result.checkDidFail('Non-owner should not be able to kill');

                result.set(await expectFail(CpuCoin.methods.kill().send({from: owner})).catch(catcher));
                result.checkDidFail('Owner should not be able to kill when not paused');
            }).catch(catcher);

            result.set(await CpuCoin.methods.addPauser(account2).send({from: owner}));
            result.checkTransactionOk();
            result.set(await CpuCoin.methods.removePauser(owner).send({from: owner}));
            result.checkTransactionOk();

            result.set(await CpuCoin.methods.pause().send({from: account2}));
            result.checkTransactionOk();

            // From this point on the contract is paused, and account2 is pauser.
            const pauser = account2;

            await subtest('34b. kill when paused, with correct owner param', async () => {
                result.set(await expectFail(CpuCoin.methods.kill().send({from: account9})).catch(catcher));
                result.checkDidFail('Non-owner should not be able to kill');

                // This only succeeds if not killed.
                result.set(await CpuCoin.methods.symbol().call());
                result.checkIsEqual('CPU');

                result.set(await CpuCoin.methods.kill().send({from: pauser}).catch(catcher));
                result.checkTransactionOk;

                result.set(await expectFail(CpuCoin.methods.symbol().call(),
                    'Returned values aren\'t valid, did it run Out of Gas?'));
                result.checkDidFail();
            }).catch(catcher);
        });

    // ================================================================================
    // === Test uniform grant-related functionality
    // ================================================================================

    let MINSTARTDAY = TODAY_DAYS;
    let MAXSTARTDAY = TODAY_DAYS + 30;
    let EXPIRATIONDAY = TODAY_DAYS + 1;
    let grantParams_restricted1 = [tokensToWei(2 * ONE_MILLION), tokensToWei(ONE_MILLION), MINSTARTDAY - 1];
    let grantParams_restricted2 = [tokensToWei(2 * ONE_MILLION), tokensToWei(ONE_MILLION), MAXSTARTDAY];
    let grantParams = [tokensToWei(2 * ONE_MILLION), tokensToWei(ONE_MILLION), MINSTARTDAY];

    if (runThisTest())
        it('40. test uniform grantor setup', async () => {
            if (!CpuCoin) return;

            let grantor = account1;
            let isUniformGrantor = true;
            let beneficiary = account2;
            let beneficiary2 = account3;
            let vestingSchedule = [12, 3, 1, true];
            let vestingSchedule2 = [24, 6, 1, true];

            await subtest('40a. check that owner can\'t set restrictions on non-grantor.', async () => {
                result.set(await expectFail(CpuCoin.methods.setRestrictions(grantor, MINSTARTDAY, MAXSTARTDAY, EXPIRATIONDAY).send({from: owner})).catch(catcher));
                result.checkDidFail();
            }).catch(catcher);

            await subtest('40a1. check that grantor is not yet an exchange grantor.', async () => {
                result.set(await CpuCoin.methods.isGrantor(grantor).call({from: account9}));
                result.checkIsEqual(false);
                result.set(await CpuCoin.methods.isUniformGrantor(grantor).call({from: account9}));
                result.checkIsEqual(false);
            }).catch(catcher);

            await subtest('40b. check that owner can\'t set restrictions on unregistered grantor.', async () => {
                result.set(await CpuCoin.methods.addGrantor(grantor, isUniformGrantor).send({from: owner}));
                result.checkTransactionOk();
                result.set(await expectFail(CpuCoin.methods.setRestrictions(grantor, MINSTARTDAY, MAXSTARTDAY, EXPIRATIONDAY).send({from: owner}),
                    'account not registered').catch(catcher));
                result.checkDidFail();
            }).catch(catcher);

            await subtest('40b1. check that grantor is now a exchange grantor.', async () => {
                result.set(await CpuCoin.methods.isGrantor(grantor).call({from: account9}));
                result.checkIsEqual(true);
                result.set(await CpuCoin.methods.isUniformGrantor(grantor).call({from: account9}));
                result.checkIsEqual(true);
            }).catch(catcher);

            await subtest('40c. check that owner can\'t set vesting schedule of unregistered grantor.', async () => {
                result.set(await expectFail(CpuCoin.methods.setGrantorVestingSchedule(grantor, ...vestingSchedule).send({from: owner}),
                    'account not registered').catch(catcher));
                result.checkDidFail();
            }).catch(catcher);

            await subtest('40d. check that owner can\'t set vesting schedule of non-grantor.', async () => {
                result.set(await expectFail(CpuCoin.methods.setGrantorVestingSchedule(beneficiary, ...vestingSchedule).send({from: owner}),
                    'account not registered').catch(catcher));
                result.checkDidFail();
            }).catch(catcher);

            await subtest('40e. check that grantor can\'t grant tokens without restrictions set up.', async () => {
                result.set(await expectFail(CpuCoin.methods.grantUniformVestingTokens(beneficiary, ...grantParams).send({from: owner}),
                    'grantor account not ready').catch(catcher));
                result.checkDidFail();

            });

            await subtest('40f. check that grantor can\'t self-set own restrictions.', async () => {
                result.set(await expectFail(CpuCoin.methods.setRestrictions(grantor, MINSTARTDAY, MAXSTARTDAY, EXPIRATIONDAY).send({from: grantor}),
                    DEFAULT_ERROR).catch(catcher));
                result.checkDidFail();
            }).catch(catcher);

            await subtest('40g. check that grantor can\'t self-set own vesting schedule.', async () => {
                result.set(await expectFail(CpuCoin.methods.setGrantorVestingSchedule(grantor, ...vestingSchedule).send({from: grantor}),
                    DEFAULT_ERROR).catch(catcher));
                result.checkDidFail();
            }).catch(catcher);

            await subtest('40h. check that owner CAN set restrictions and vesting schedule on registered grantor.', async () => {
                // These 3 steps set up a working uniform grantor.
                result.set(await CpuCoin.methods.registerAccount().send({from: grantor}));
                result.checkTransactionOk();
                result.set(await CpuCoin.methods.setRestrictions(grantor, MINSTARTDAY, MAXSTARTDAY, EXPIRATIONDAY).send({from: owner}));
                result.checkTransactionOk();
                result.set(await CpuCoin.methods.setGrantorVestingSchedule(grantor, ...vestingSchedule).send({from: owner}));
                result.checkTransactionOk();
            }).catch(catcher);

            // From this point on, grantor is a valid, working uniform grantor.

            await subtest('40i. check that vesting schedule cannot be changed', async () => {
                result.set(await expectFail(CpuCoin.methods.setGrantorVestingSchedule(grantor, ...vestingSchedule).send({from: owner}),
                    'schedule already exists').catch(catcher));
                result.checkDidFail();

                result.set(await expectFail(CpuCoin.methods.setGrantorVestingSchedule(grantor, ...vestingSchedule2).send({from: owner}),
                    'schedule already exists').catch(catcher));
                result.checkDidFail();
            }).catch(catcher);

            // Fund grantor so it can make grants
            await CpuCoin.methods.safeTransfer(grantor, tokensToWei(100 * ONE_MILLION)).send({from: owner});

            // From this point on in the test, the grantor is properly set up as restricted uniform grantor with a vesting schedule.

            await subtest('40j. check that date restrictions are enforced when granting.', async () => {
                result.set(await expectFail(CpuCoin.methods.grantUniformVestingTokens(beneficiary, ...grantParams_restricted1).send({from: grantor, gas: UNIFORMGRANTGAS}),
                    'startDay too early').catch(catcher));
                result.checkDidFail();
                result.set(await expectFail(CpuCoin.methods.grantUniformVestingTokens(beneficiary, ...grantParams_restricted2).send({from: grantor, gas: UNIFORMGRANTGAS}),
                    'startDay too early').catch(catcher));
                result.checkDidFail();
            }).catch(catcher);

            await subtest('40k. check that grantor CAN grant tokens, and they are granted correctly.', async () => {
                result.set(await CpuCoin.methods.grantUniformVestingTokens(beneficiary, ...grantParams).send({from: grantor, gas: UNIFORMGRANTGAS}));
                result.checkTransactionOk();

                await testVestingScheduleDayByDay(beneficiary, grantParams, vestingSchedule).catch(catcher);
            }).catch(catcher);

            await subtest('40m. check that under the same conditions, safe grant is disallowed.', async () => {
                result.set(await expectFail(CpuCoin.methods.safeGrantUniformVestingTokens(beneficiary2, ...grantParams).send({from: grantor, gas: UNIFORMGRANTGAS}),
                    'account not registered').catch(catcher));
                result.checkDidFail();
            }).catch(catcher);

            await subtest('40n. check that grantor CAN safe-grant tokens, and they are granted correctly.', async () => {
                result.set(await CpuCoin.methods.registerAccount().send({from: beneficiary2}));
                result.checkTransactionOk();
                result.set(await CpuCoin.methods.safeGrantUniformVestingTokens(beneficiary2, ...grantParams).send({from: grantor, gas: UNIFORMGRANTGAS}));
                result.checkTransactionOk();

                await testVestingScheduleDayByDay(beneficiary2, grantParams, vestingSchedule).catch(catcher);
            }).catch(catcher);

            await subtest('40p. check revocation of beneficiary2.', async () => {
                result.set(await CpuCoin.methods.revokeGrant(beneficiary2, MINSTARTDAY + 5).send({from: grantor, gas: REVOKEONGAS}));
                result.checkTransactionOk();
                result.set(await testAccountHasNoGrant(beneficiary2, true, MINSTARTDAY + 5));     // beneficiary2 keeps (5/12) million.
                result.checkIsTrue();
            }).catch(catcher);

            await subtest('40q. check that first beneficiary grant not affected by revocation of beneficiary2.', async () => {
                await testVestingScheduleDayByDay(beneficiary, grantParams, vestingSchedule).catch(catcher);
            }).catch(catcher);

            await subtest('40r. heck that grantor account reflects one full and one partial revocation having been subtracted.', async () => {
                result.set(await CpuCoin.methods.balanceOf(grantor).call());
                result.checkIsEqual('96583333333333333333333334');      // This is 100 - (4 - 7/12) million
            }).catch(catcher);

        }).timeout(5000);


    if (runThisTest())
        it('41. whoAmI()', async () => {
            if (!CpuCoin) return;

            await subtest('41a. be somebody.', async () => {
                result.set(await CpuCoin.methods.iAm("The boss man").send({from: owner}));
                result.checkTransactionOk();

                result.set(await CpuCoin.methods.iAm("just account 5").send({from: account5}));
                result.checkTransactionOk();

                result.set(await CpuCoin.methods.iAm("I'm last! (and 31 bytes long..)").send({from: account9}));
                result.checkTransactionOk();
            }).catch(catcher);

            await subtest('41b. I am who I think I am.', async () => {
                result.set(await CpuCoin.methods.whereAmI().call({from: owner}));
                result.checkIsEqual(owner);
                result.set(await CpuCoin.methods.whoAmI().call({from: owner}));
                result.checkIsEqual("The boss man");

                result.set(await CpuCoin.methods.whereAmI().call({from: account5}));
                result.checkIsEqual(account5);
                result.set(await CpuCoin.methods.whoAmI().call({from: account5}));
                result.checkIsEqual("just account 5");

                result.set(await CpuCoin.methods.whereAmI().call({from: account9}));
                result.checkIsEqual(account9);
                result.set(await CpuCoin.methods.whoAmI().call({from: account9}));
                result.checkIsEqual("I'm last! (and 31 bytes long..)");
            }).catch(catcher);
        });

    if (runThisTest())
        it('42. isRegistered()', async () => {
            if (!CpuCoin) return;

            // Owner should initially be pre-registered (via constructor).
            result.set(await CpuCoin.methods.isRegistered(owner).call({from: account9}));
            result.checkIsEqual(true);

            // Account1 should initially not be registered.
            result.set(await CpuCoin.methods.isRegistered(account1).call({from: account9}));
            result.checkIsEqual(false);

            // Register account1.
            result.set(await CpuCoin.methods.registerAccount().send({from: account1}));
            result.checkTransactionOk();

            // Account1 should initially now be registered.
            result.set(await CpuCoin.methods.isRegistered(account1).call({from: account9}));
            result.checkIsEqual(true);

        });

    if (runThisTest())
        it('43. burn tokens - test not-vested tokens can\'t be burned', async () => {
            if (!CpuCoin) return;

            await subtest('43a. check that cannot burn not-vested tokens (using account1)', async () => {
                // Create a grant that would be not vested right now
                await testGrantVestingTokens(owner, account1,
                    [tokensToWei(1000000), tokensToWei(1000000), TODAY_DAYS],
                    [12, 3, 1, true]);
                result.checkTransactionOk();

                // Try to burn 1 token now (zero are vested). Should fail.
                result.set(await expectFail(CpuCoin.methods.burn(tokensToWei(1)).send({from: account1})).catch(catcher));
                result.checkDidFail();
            }).catch(catcher);

            await subtest('43b. check that only vested tokens can be burned (using account2)', async () => {
                // Create a grant that would be half-vested right now
                await testGrantVestingTokens(owner, account2,
                    [tokensToWei(1000000), tokensToWei(1000000), TODAY_DAYS-6],
                    [12, 3, 1, true]);
                result.checkTransactionOk();

                // Try to burn 1 more than half the tokens (half are vested). Should fail.
                result.set(await expectFail(CpuCoin.methods.burn(tokensToWei(500001)).send({from: account2})).catch(catcher));
                result.checkDidFail();

                // Try to burn exactly half the tokens (half are vested). Should work.
                result.set(await CpuCoin.methods.burn(tokensToWei(500000)).send({from: account2}));
                result.checkTransactionOk();
            }).catch(catcher);

            await subtest('43b. check that fully vested tokens can be burned (using account3)', async () => {
                // Create a grant that would be fully-vested right now
                await testGrantVestingTokens(owner, account3,
                    [tokensToWei(1000000), tokensToWei(1000000), TODAY_DAYS-20],
                    [12, 3, 1, true]);
                result.checkTransactionOk();

                // Try to burn all the tokens + 1 (all are vested). Should fail.
                result.set(await expectFail(CpuCoin.methods.burn(tokensToWei(1000001)).send({from: account3})).catch(catcher));
                result.checkDidFail();

                // Try to burn exactly all the tokens (all are vested). Should work.
                result.set(await CpuCoin.methods.burn(tokensToWei(1000000)).send({from: account3}));
                result.checkTransactionOk();
            }).catch(catcher);
        });

    // ================================================================================
    // === Last: Summary
    // ================================================================================
    it('Display build results summary', async () => {
        if (!CpuCoin) {
            console.log(colors.blue('==> All tests were skipped! Please check the following:\n  - Did the build fail?\n  - Did it run out of gas when deployed?\n  - Check that all interface methods have an implementation (build success without deployment).'));
        } else {
            const results = result.getResults();
            const attempts = results[0];
            const successes = results[1];
            const failures = (attempts - successes) - expectedFails;
            if (attempts === 0)
                console.log(colors.yellow('==> No checks were made by any test.'));
            else if (failures > 0)
                console.log(colors.red('==> Out of ' + attempts + ' checks, ' + failures + ' failed!'));
            else
                console.log(colors.green('==> All ' + attempts + ' checks were successful.'));

            if (unexpectedErrors > 0)
                console.log(colors.red('==> FAILURE: ' + unexpectedErrors + ' uncaught exception(s)! (see above)'));
        }
    });
});

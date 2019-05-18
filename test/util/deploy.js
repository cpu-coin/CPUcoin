const build = require('./build');

const colors = require('colors');
const HDWalletProvider = require('truffle-hdwallet-provider');
const ganache = require('ganache-cli');
const Web3 = require('web3');
const fs = require("fs");

// Support for production blockchain isn't implemented yet.
const useProductionBlockchain = false;

const log = true;
const debug = false;
let logger = console;

function getWalletProvider() {
    if (useProductionBlockchain)
        return new Web3(new HDWalletProvider(
            'foster door tonight blade swing method kind wide glass pepper permit scrub',
            'https://rinkeby.infura.io/v3/2694f180955f4061af2ea57208316964'
        ));
    else
        return ganache.provider();
}

async function deployContract(walletProvider, contractFullPath, doBuild, constructorArgs, someLogger) {
    if (!!someLogger)
        logger = someLogger;

    if (doBuild)
        build(contractFullPath, logger);

    if (log) logger.log('==> Deploying contract \'' + contractPath + '\' and dependencies...');

    walletProvider.setMaxListeners(15);       // Suppress MaxListenersExceededWarning warning
    const web3 = new Web3(walletProvider);
    this.gasPrice = await web3.eth.getGasPrice();
    this.accounts = await web3.eth.getAccounts();

    // Read in the compiled contract code and fetch ABI description and the bytecode as objects
    const compiled = JSON.parse(fs.readFileSync("./output/contracts.json"));
    if (typeof(compiled.errors) !== 'undefined' && typeof(compiled.errors.formattedMessage) !== 'undefined')
        throw compiled.errors.formattedMessage;
    const abi = compiled.contracts["CpuCoin.sol"]["CpuCoin"].abi;
    const bytecode = compiled.contracts['CpuCoin.sol']['CpuCoin'].evm.bytecode.object;

    // Deploy the contract and send it gas to run.
    if (log) logger.log('Attempting to deploy from account:', this.accounts[0]);
    try {
        this.contract = await new web3.eth.Contract(abi)
            .deploy({data: '0x' + bytecode, arguments: constructorArgs})
            .send({from: this.accounts[0], gas: '6720000'});        /* This is AT the block limit and CANNOT be increased! */
    } catch (err) {
        if (log) logger.log(colors.red('==> Deploy FAILED! (no deployment)\n'));
    }

    if (this.contract.options.address == null) {
        if (log) logger.log(colors.red('==> Deploy FAILED! (no contract address)\n'));
    } else {
        if (log) logger.log(colors.green('==> Contract deployed!') + ' to: ' + colors.blue(this.contract.options.address) + '\n');
    }
    return this;
}

async function deploy(contractFullPath, doBuild, constructorArgs, theLogger) {
    if (!!theLogger)
        logger = theLogger;

    const deployment = await deployContract(getWalletProvider(), contractFullPath, doBuild, constructorArgs, theLogger).catch(logger.log);
    if (log) logger.log('Done!');

    logger.log('Deployment: '+deployment);
    return deployment;
}

// Pass build function to module user
module.exports = deploy;

// Uncomment to make it run if invoked directly from the command line
//deploy(null, console, []);

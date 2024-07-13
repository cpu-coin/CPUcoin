# CPUcoin token

Smart contracts for the CPUcoin ecosystem token (see cpucoin.io ). 

Core to CPUcoin pre-main net launch is an implementation of a fully-featured vesting token.
 
Here is a brief summary of its features and capabilities:

- Simultaneously supports both revocable and irrevocable token grants. Use cases for this are token purchases (irrevocable) as well employee compensation plans (revocable).
- At the time of grant, tokens are deposited into the beneficiary's account, but the non-vested portion is prevented from being spent. We like this model because it ensures the not-vested tokens are stored safely with the beneficiary and remain locked, with no possibility of unreleased tokens being accidentally spent or used for another purpose.
- If a revocable token grant is revoked by the grantor, the beneficiary keeps the vested tokens, and the not-vested tokens are returned to the grantor.
- Sophisticated support for a grantor role, which can be assigned to multiple accounts, creating the ability to form multiple grant pools of different types for different purposes, each with its own grantor.
- Each grant pool may have its own uniform vesting schedule, which is applied to grants made to all beneficiaries from that pool. Restrictions can be set to parameterize the grantor's ability to set start dates, and a grantor expiration date can be set to automatically close the pool.
- There's also an ability to create one-off grants, where each beneficiary can have a unique vesting schedule for its grant.
- The vesting schedule supports start date, cliff date, end date and interval. If interval is 1, the grant vests linearly. If interval is a number like say 30, vesting bumps up every 30 days. There is a restriction that both the interval from start to the cliff and the overall duration must be an even multiple of the interval. This flexibility opens up many possible vesting patterns.
- All grant-related dates are measured in whole days, with each day starting at midnight UTC time. This locks all vesting to the same clock, which will help with orderly bookkeeping. It also disallows absurd cases like grants that are 15 minutes long, etc.
- There is a limit of one vesting grant at a time per account. A beneficiary can have multiple grants in effect on different terms simply by using a new account for each new grant.
- Support for an address self-registration mechanism, and safe methods which will only transact with a verified address, to help prevent token loss through accidental bad data.
- Enterprise-style support for roles and permissions, with mechanisms in place to prevent loss of ownership control or accidental transfer of ownership to an invalid address.
- Full automated test coverage of the contract code written in nodejs.
- I am wrapping up loose ends with this work before I publish the source, but it will be soon. I am eager to receive any feedback and hear ideas for improvement that this group may have. Also, I hope many of you will find it useful, and can help me improve on it.

Many of these capabilities are intended to help make it easy for us to manage exchanges, allowing us to keep some control over how token grants are issued by exchange delegates. The pools mechanism makes it easy to place overall limits on what any given grantor is allowed to issue out of an account under their control.

## Getting Started

The project requires node.js. I'm using node v10.15.1. The node modules/versions you need are enumerated in `package.json`.

### Prerequisites

You'll need a copy of the [openzeppelin-solidity](https://github.com/OpenZeppelin/openzeppelin-solidity.git) repository.

Clone it to a folder called `openzeppelin-solidity` which is a sibling of `CpuCoin`.

### Installing

After you've pulled the code, open a command prompt in `CpuCoin` and install the required node modules.

First, install NPM (if you haven't already)

```
cd CpuCoin
npm install npm -g
```

And then the needed modules:

```
npm install
```

At this time, the only thing you can do next is run the tests. I'm working on some deployment tools for testing on an Ethereum testnet, but it's not ready yet.

## Running the tests

Create the output directory for the tests (one-time only):

```
mkdir output
```

Run the tests by issuing the command:

```
npm test
```

(or in a DOS command prompt):

```
test.bat
```

### Breakdown into end-to-end tests

There is a comprehensive set of tests written using Mocha that exercise functions of the smart contract that aren't already covered by openzeppelin-solidity, which has tests for the contracts implemented for this project. Web3 and ganache allow the tests to be run quickly using a local JS blockchain.

The testing style is end-to-end functional testing. While these tests run pretty quickly, technically they're not unit tests. I didn't use mocks or the openzeppelin-solidity conventions for test creation because I'm not yet fluent in those techniques, but that would be a good next step. I have tried to cover all major functionality, but there is still work needed to be done. For example, there are not yet any tests that verify event generation. 

## Deployment

This section is yet to be written.

## Built With

* [openzeppelin-solidity](https://github.com/OpenZeppelin/openzeppelin-solidity.git) - a battle-tested framework of reusable smart contracts.

## Contributing

This section is yet to be written. 

## Versioning

This section is yet to be written. 

## License

This project is licensed under the MIT License - see the [LICENSE.md](LICENSE.md) file for details

This was made to help crypto projects solve the vesting token compliance issues plaguing the industry. For more information for how it can be used
and why we did it please go here: https://cpucoin.medium.com/the-making-of-an-open-source-token-vesting-smart-contract

## Acknowledgments

Sean Barger, Managing Director of CPUcoin concieved this addition to an ERC-20 token smart contract and made sure this functionality was made part of the original CPUcoin $CPU specifically to address the issues discussed and made a part of this token smart contract.
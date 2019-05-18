pragma solidity ^0.5.7;

import "./Identity.sol";
import "../../openzeppelin-solidity/contracts/token/ERC20/ERC20Burnable.sol";
import "../../openzeppelin-solidity/contracts/token/ERC20/ERC20Detailed.sol";
import "./UniformTokenGrantor.sol";

/**
 * @dev An ERC20 implementation of the CPUcoin ecosystem token. All tokens are initially pre-assigned to
 * the creator, and can later be distributed freely using transfer transferFrom and other ERC20
 * functions.
 */
contract CpuCoin is Identity, ERC20, ERC20Pausable, ERC20Burnable, ERC20Detailed, UniformTokenGrantor {
    uint32 public constant VERSION = 8;

    uint8 private constant DECIMALS = 18;
    uint256 private constant TOKEN_WEI = 10 ** uint256(DECIMALS);

    uint256 private constant INITIAL_WHOLE_TOKENS = uint256(5 * (10 ** 9));
    uint256 private constant INITIAL_SUPPLY = uint256(INITIAL_WHOLE_TOKENS) * uint256(TOKEN_WEI);

    /**
     * @dev Constructor that gives msg.sender all of existing tokens.
     */
    constructor () ERC20Detailed("CPUcoin", "CPU", DECIMALS) public {
        // This is the only place where we ever mint tokens.
        _mint(msg.sender, INITIAL_SUPPLY);
    }

    event DepositReceived(address indexed from, uint256 value);

    /**
     * fallback function: collect any ether sent to us (whether we asked for it or not).
     */
    function() payable external {
        // Track where unexpected ETH came from so we can follow up later.
        emit DepositReceived(msg.sender, msg.value);
    }

    /**
     * @dev Allow only the owner to burn tokens from the owner's wallet, also decreasing the total
     * supply. There is no reason for a token holder to EVER call this method directly. It will be
     * used by the future CPUcoin ecosystem token contract to implement IEO token redemption.
     */
    function burn(uint256 value) onlyIfFundsAvailableNow(msg.sender, value) public {
        // This is the only place where we ever burn tokens.
        _burn(msg.sender, value);
    }

    /**
     * @dev Allow pauser to kill the contract (which must already be paused), with enough restrictions
     * in place to ensure this could not happen by accident very easily. ETH is returned to owner wallet.
     */
    function kill() whenPaused onlyPauser public returns (bool itsDeadJim) {
        require(isPauser(msg.sender), "onlyPauser");
        address payable payableOwner = address(uint160(owner()));
        selfdestruct(payableOwner);
        return true;
    }
}

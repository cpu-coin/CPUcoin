pragma solidity ^0.5.7;

import "../../openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "../../openzeppelin-solidity/contracts/access/Roles.sol";

/**
 * @dev GrantorRole trait
 *
 * This adds support for a role that allows creation of vesting token grants, allocated from the
 * role holder's wallet.
 *
 * NOTE: We have implemented a role model only the contract owner can assign/un-assign roles.
 * This is necessary to support enterprise software, which requires a permissions model in which
 * roles can be owner-administered, in contrast to a blockchain community approach in which
 * permissions can be self-administered. Therefore, this implementation replaces the self-service
 * "renounce" approach with one where only the owner is allowed to makes role changes.
 *
 * Owner is not allowed to renounce ownership, lest the contract go without administration. But
 * it is ok for owner to shed initially granted roles by removing role from self.
 */
contract GrantorRole is Ownable {
    bool private constant OWNER_UNIFORM_GRANTOR_FLAG = false;

    using Roles for Roles.Role;

    event GrantorAdded(address indexed account);
    event GrantorRemoved(address indexed account);

    Roles.Role private _grantors;
    mapping(address => bool) private _isUniformGrantor;

    constructor () internal {
        _addGrantor(msg.sender, OWNER_UNIFORM_GRANTOR_FLAG);
    }

    modifier onlyGrantor() {
        require(isGrantor(msg.sender), "onlyGrantor");
        _;
    }

    modifier onlyGrantorOrSelf(address account) {
        require(isGrantor(msg.sender) || msg.sender == account, "onlyGrantorOrSelf");
        _;
    }

    function isGrantor(address account) public view returns (bool) {
        return _grantors.has(account);
    }

    function addGrantor(address account, bool isUniformGrantor) public onlyOwner {
        _addGrantor(account, isUniformGrantor);
    }

    function removeGrantor(address account) public onlyOwner {
        _removeGrantor(account);
    }

    function _addGrantor(address account, bool isUniformGrantor) private {
        require(account != address(0));
        _grantors.add(account);
        _isUniformGrantor[account] = isUniformGrantor;
        emit GrantorAdded(account);
    }

    function _removeGrantor(address account) private {
        require(account != address(0));
        _grantors.remove(account);
        emit GrantorRemoved(account);
    }

    function isUniformGrantor(address account) public view returns (bool) {
        return isGrantor(account) && _isUniformGrantor[account];
    }

    modifier onlyUniformGrantor() {
        require(isUniformGrantor(msg.sender), "onlyUniformGrantor");
        // Only grantor role can do this.
        _;
    }


    // =========================================================================
    // === Overridden ERC20 functionality
    // =========================================================================

    /**
     * Ensure there is no way for the contract to end up with no owner. That would inadvertently result in
     * token grant administration becoming impossible. We override this to always disallow it.
     */
    function renounceOwnership() public onlyOwner {
        require(false, "forbidden");
    }

    /**
     * @dev Allows the current owner to transfer control of the contract to a newOwner.
     * @param newOwner The address to transfer ownership to.
     */
    function transferOwnership(address newOwner) public onlyOwner {
        _removeGrantor(msg.sender);
        super.transferOwnership(newOwner);
        _addGrantor(newOwner, OWNER_UNIFORM_GRANTOR_FLAG);
    }
}

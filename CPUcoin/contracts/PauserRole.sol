pragma solidity ^0.5.7;

import "../../openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "../../openzeppelin-solidity/contracts/access/Roles.sol";

/**
 * @dev This role allows the contract to be paused, so that in case something goes horribly wrong
 * during an ICO, the owner/administrator has an ability to suspend all transactions while things
 * are sorted out.
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
contract PauserRole is Ownable {
    using Roles for Roles.Role;

    event PauserAdded(address indexed account);
    event PauserRemoved(address indexed account);

    Roles.Role private _pausers;

    constructor () internal {
        _addPauser(msg.sender);
    }

    modifier onlyPauser() {
        require(isPauser(msg.sender), "onlyPauser");
        _;
    }

    function isPauser(address account) public view returns (bool) {
        return _pausers.has(account);
    }

    function addPauser(address account) public onlyOwner {
        _addPauser(account);
    }

    function removePauser(address account) public onlyOwner {
        _removePauser(account);
    }

    function _addPauser(address account) private {
        require(account != address(0));
        _pausers.add(account);
        emit PauserAdded(account);
    }

    function _removePauser(address account) private {
        require(account != address(0));
        _pausers.remove(account);
        emit PauserRemoved(account);
    }


    // =========================================================================
    // === Overridden ERC20 functionality
    // =========================================================================

    /**
     * Ensure there is no way for the contract to end up with no owner. That would inadvertently result in
     * pauser administration becoming impossible. We override this to always disallow it.
     */
    function renounceOwnership() public onlyOwner {
        require(false, "forbidden");
    }

    /**
     * @dev Allows the current owner to transfer control of the contract to a newOwner.
     * @param newOwner The address to transfer ownership to.
     */
    function transferOwnership(address newOwner) public onlyOwner {
        _removePauser(msg.sender);
        super.transferOwnership(newOwner);
        _addPauser(newOwner);
    }
}

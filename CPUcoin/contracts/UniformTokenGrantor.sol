pragma solidity ^0.5.7;

import "./ERC20Vestable.sol";

/**
 * @title Contract for uniform granting of vesting tokens
 *
 * @notice Adds methods for programmatic creation of uniform or standard token vesting grants.
 *
 * @dev This is primarily for use by exchanges and scripted internal employee incentive grant creation.
 */
contract UniformTokenGrantor is ERC20Vestable {

    struct restrictions {
        bool isValid;
        uint32 minStartDay;        /* The smallest value for startDay allowed in grant creation. */
        uint32 maxStartDay;        /* The maximum value for startDay allowed in grant creation. */
        uint32 expirationDay;       /* The last day this grantor may make grants. */
    }

    mapping(address => restrictions) private _restrictions;


    // =========================================================================
    // === Uniform token grant setup
    // === Methods used by owner to set up uniform grants on restricted grantor
    // =========================================================================

    event GrantorRestrictionsSet(
        address indexed grantor,
        uint32 minStartDay,
        uint32 maxStartDay,
        uint32 expirationDay);

    /**
     * @dev Lets owner set or change existing specific restrictions. Restrictions must be established
     * before the grantor will be allowed to issue grants.
     *
     * All date values are expressed as number of days since the UNIX epoch. Note that the inputs are
     * themselves not very thoroughly restricted. However, this method can be called more than once
     * if incorrect values need to be changed, or to extend a grantor's expiration date.
     *
     * @param grantor = Address which will receive the uniform grantable vesting schedule.
     * @param minStartDay = The smallest value for startDay allowed in grant creation.
     * @param maxStartDay = The maximum value for startDay allowed in grant creation.
     * @param expirationDay = The last day this grantor may make grants.
     */
    function setRestrictions(
        address grantor,
        uint32 minStartDay,
        uint32 maxStartDay,
        uint32 expirationDay
    )
    public
    onlyOwner
    onlyExistingAccount(grantor)
    returns (bool ok)
    {
        require(
            isUniformGrantor(grantor)
         && maxStartDay > minStartDay
         && expirationDay > today(), "invalid params");

        // We allow owner to set or change existing specific restrictions.
        _restrictions[grantor] = restrictions(
            true/*isValid*/,
            minStartDay,
            maxStartDay,
            expirationDay
        );

        // Emit the event and return success.
        emit GrantorRestrictionsSet(grantor, minStartDay, maxStartDay, expirationDay);
        return true;
    }

    /**
     * @dev Lets owner permanently establish a vesting schedule for a restricted grantor to use when
     * creating uniform token grants. Grantee accounts forever refer to the grantor's account to look up
     * vesting, so this method can only be used once per grantor.
     *
     * @param grantor = Address which will receive the uniform grantable vesting schedule.
     * @param duration = Duration of the vesting schedule, with respect to the grant start day, in days.
     * @param cliffDuration = Duration of the cliff, with respect to the grant start day, in days.
     * @param interval = Number of days between vesting increases.
     * @param isRevocable = True if the grant can be revoked (i.e. was a gift) or false if it cannot
     *   be revoked (i.e. tokens were purchased).
     */
    function setGrantorVestingSchedule(
        address grantor,
        uint32 duration,
        uint32 cliffDuration,
        uint32 interval,
        bool isRevocable
    )
    public
    onlyOwner
    onlyExistingAccount(grantor)
    returns (bool ok)
    {
        // Only allow doing this to restricted grantor role account.
        require(isUniformGrantor(grantor), "uniform grantor only");
        // Make sure no prior vesting schedule has been set!
        require(!_hasVestingSchedule(grantor), "schedule already exists");

        // The vesting schedule is unique to this grantor wallet and so will be stored here to be
        // referenced by future grants. Emits VestingScheduleCreated event.
        _setVestingSchedule(grantor, cliffDuration, duration, interval, isRevocable);

        return true;
    }


    // =========================================================================
    // === Uniform token grants
    // === Methods to be used by exchanges to use for creating tokens.
    // =========================================================================

    function isUniformGrantorWithSchedule(address account) internal view returns (bool ok) {
        // Check for grantor that has a uniform vesting schedule already set.
        return isUniformGrantor(account) && _hasVestingSchedule(account);
    }

    modifier onlyUniformGrantorWithSchedule(address account) {
        require(isUniformGrantorWithSchedule(account), "grantor account not ready");
        _;
    }

    modifier whenGrantorRestrictionsMet(uint32 startDay) {
        restrictions storage restriction = _restrictions[msg.sender];
        require(restriction.isValid, "set restrictions first");

        require(
            startDay >= restriction.minStartDay
            && startDay < restriction.maxStartDay, "startDay too early");

        require(today() < restriction.expirationDay, "grantor expired");
        _;
    }

    /**
     * @dev Immediately grants tokens to an address, including a portion that will vest over time
     * according to the uniform vesting schedule already established in the grantor's account.
     *
     * @param beneficiary = Address to which tokens will be granted.
     * @param totalAmount = Total number of tokens to deposit into the account.
     * @param vestingAmount = Out of totalAmount, the number of tokens subject to vesting.
     * @param startDay = Start day of the grant's vesting schedule, in days since the UNIX epoch
     *   (start of day). The startDay may be given as a date in the future or in the past, going as far
     *   back as year 2000.
     */
    function grantUniformVestingTokens(
        address beneficiary,
        uint256 totalAmount,
        uint256 vestingAmount,
        uint32 startDay
    )
    public
    onlyUniformGrantorWithSchedule(msg.sender)
    whenGrantorRestrictionsMet(startDay)
    returns (bool ok)
    {
        // Issue grantor tokens to the beneficiary, using beneficiary's own vesting schedule.
        // Emits VestingTokensGranted event.
        return _grantVestingTokens(beneficiary, totalAmount, vestingAmount, startDay, msg.sender, msg.sender);
    }

    /**
     * @dev This variant only grants tokens if the beneficiary account has previously self-registered.
     */
    function safeGrantUniformVestingTokens(
        address beneficiary,
        uint256 totalAmount,
        uint256 vestingAmount,
        uint32 startDay
    )
    public
    onlyUniformGrantorWithSchedule(msg.sender)
    whenGrantorRestrictionsMet(startDay)
    onlyExistingAccount(beneficiary)
    returns (bool ok)
    {
        // Issue grantor tokens to the beneficiary, using beneficiary's own vesting schedule.
        // Emits VestingTokensGranted event.
        return _grantVestingTokens(beneficiary, totalAmount, vestingAmount, startDay, msg.sender, msg.sender);
    }
}

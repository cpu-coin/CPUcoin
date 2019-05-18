pragma solidity ^0.5.7;

import "../../openzeppelin-solidity/contracts/token/ERC20/ERC20Pausable.sol";
import "./VerifiedAccount.sol";
import "./GrantorRole.sol";
import "./IERC20Vestable.sol";

/**
 * @title Contract for grantable ERC20 token vesting schedules
 *
 * @notice Adds to an ERC20 support for grantor wallets, which are able to grant vesting tokens to
 *   beneficiary wallets, following per-wallet custom vesting schedules.
 *
 * @dev Contract which gives subclass contracts the ability to act as a pool of funds for allocating
 *   tokens to any number of other addresses. Token grants support the ability to vest over time in
 *   accordance a predefined vesting schedule. A given wallet can receive no more than one token grant.
 *
 *   Tokens are transferred from the pool to the recipient at the time of grant, but the recipient
 *   will only able to transfer tokens out of their wallet after they have vested. Transfers of non-
 *   vested tokens are prevented.
 *
 *   Two types of toke grants are supported:
 *   - Irrevocable grants, intended for use in cases when vesting tokens have been issued in exchange
 *     for value, such as with tokens that have been purchased in an ICO.
 *   - Revocable grants, intended for use in cases when vesting tokens have been gifted to the holder,
 *     such as with employee grants that are given as compensation.
 */
contract ERC20Vestable is ERC20, VerifiedAccount, GrantorRole, IERC20Vestable {
    using SafeMath for uint256;

    // Date-related constants for sanity-checking dates to reject obvious erroneous inputs
    // and conversions from seconds to days and years that are more or less leap year-aware.
    uint32 private constant THOUSAND_YEARS_DAYS = 365243;                   /* See https://www.timeanddate.com/date/durationresult.html?m1=1&d1=1&y1=2000&m2=1&d2=1&y2=3000 */
    uint32 private constant TEN_YEARS_DAYS = THOUSAND_YEARS_DAYS / 100;     /* Includes leap years (though it doesn't really matter) */
    uint32 private constant SECONDS_PER_DAY = 24 * 60 * 60;                 /* 86400 seconds in a day */
    uint32 private constant JAN_1_2000_SECONDS = 946684800;                 /* Saturday, January 1, 2000 0:00:00 (GMT) (see https://www.epochconverter.com/) */
    uint32 private constant JAN_1_2000_DAYS = JAN_1_2000_SECONDS / SECONDS_PER_DAY;
    uint32 private constant JAN_1_3000_DAYS = JAN_1_2000_DAYS + THOUSAND_YEARS_DAYS;

    struct vestingSchedule {
        bool isValid;               /* true if an entry exists and is valid */
        bool isRevocable;           /* true if the vesting option is revocable (a gift), false if irrevocable (purchased) */
        uint32 cliffDuration;       /* Duration of the cliff, with respect to the grant start day, in days. */
        uint32 duration;            /* Duration of the vesting schedule, with respect to the grant start day, in days. */
        uint32 interval;            /* Duration in days of the vesting interval. */
    }

    struct tokenGrant {
        bool isActive;              /* true if this vesting entry is active and in-effect entry. */
        bool wasRevoked;            /* true if this vesting schedule was revoked. */
        uint32 startDay;            /* Start day of the grant, in days since the UNIX epoch (start of day). */
        uint256 amount;             /* Total number of tokens that vest. */
        address vestingLocation;    /* Address of wallet that is holding the vesting schedule. */
        address grantor;            /* Grantor that made the grant */
    }

    mapping(address => vestingSchedule) private _vestingSchedules;
    mapping(address => tokenGrant) private _tokenGrants;


    // =========================================================================
    // === Methods for administratively creating a vesting schedule for an account.
    // =========================================================================

    /**
     * @dev This one-time operation permanently establishes a vesting schedule in the given account.
     *
     * For standard grants, this establishes the vesting schedule in the beneficiary's account.
     * For uniform grants, this establishes the vesting schedule in the linked grantor's account.
     *
     * @param vestingLocation = Account into which to store the vesting schedule. Can be the account
     *   of the beneficiary (for one-off grants) or the account of the grantor (for uniform grants
     *   made from grant pools).
     * @param cliffDuration = Duration of the cliff, with respect to the grant start day, in days.
     * @param duration = Duration of the vesting schedule, with respect to the grant start day, in days.
     * @param interval = Number of days between vesting increases.
     * @param isRevocable = True if the grant can be revoked (i.e. was a gift) or false if it cannot
     *   be revoked (i.e. tokens were purchased).
     */
    function _setVestingSchedule(
        address vestingLocation,
        uint32 cliffDuration, uint32 duration, uint32 interval,
        bool isRevocable) internal returns (bool ok) {

        // Check for a valid vesting schedule given (disallow absurd values to reject likely bad input).
        require(
            duration > 0 && duration <= TEN_YEARS_DAYS
            && cliffDuration < duration
            && interval >= 1,
            "invalid vesting schedule"
        );

        // Make sure the duration values are in harmony with interval (both should be an exact multiple of interval).
        require(
            duration % interval == 0 && cliffDuration % interval == 0,
            "invalid cliff/duration for interval"
        );

        // Create and populate a vesting schedule.
        _vestingSchedules[vestingLocation] = vestingSchedule(
            true/*isValid*/,
            isRevocable,
            cliffDuration, duration, interval
        );

        // Emit the event and return success.
        emit VestingScheduleCreated(
            vestingLocation,
            cliffDuration, duration, interval,
            isRevocable);
        return true;
    }

    function _hasVestingSchedule(address account) internal view returns (bool ok) {
        return _vestingSchedules[account].isValid;
    }

    /**
     * @dev returns all information about the vesting schedule directly associated with the given
     * account. This can be used to double check that a uniform grantor has been set up with a
     * correct vesting schedule. Also, recipients of standard (non-uniform) grants can use this.
     * This method is only callable by the account holder or a grantor, so this is mainly intended
     * for administrative use.
     *
     * Holders of uniform grants must use vestingAsOf() to view their vesting schedule, as it is
     * stored in the grantor account.
     *
     * @param grantHolder = The address to do this for.
     *   the special value 0 to indicate today.
     * @return = A tuple with the following values:
     *   vestDuration = grant duration in days.
     *   cliffDuration = duration of the cliff.
     *   vestIntervalDays = number of days between vesting periods.
     */
    function getIntrinsicVestingSchedule(address grantHolder)
    public
    view
    onlyGrantorOrSelf(grantHolder)
    returns (
        uint32 vestDuration,
        uint32 cliffDuration,
        uint32 vestIntervalDays
    )
    {
        return (
        _vestingSchedules[grantHolder].duration,
        _vestingSchedules[grantHolder].cliffDuration,
        _vestingSchedules[grantHolder].interval
        );
    }


    // =========================================================================
    // === Token grants (general-purpose)
    // === Methods to be used for administratively creating one-off token grants with vesting schedules.
    // =========================================================================

    /**
     * @dev Immediately grants tokens to an account, referencing a vesting schedule which may be
     * stored in the same account (individual/one-off) or in a different account (shared/uniform).
     *
     * @param beneficiary = Address to which tokens will be granted.
     * @param totalAmount = Total number of tokens to deposit into the account.
     * @param vestingAmount = Out of totalAmount, the number of tokens subject to vesting.
     * @param startDay = Start day of the grant's vesting schedule, in days since the UNIX epoch
     *   (start of day). The startDay may be given as a date in the future or in the past, going as far
     *   back as year 2000.
     * @param vestingLocation = Account where the vesting schedule is held (must already exist).
     * @param grantor = Account which performed the grant. Also the account from where the granted
     *   funds will be withdrawn.
     */
    function _grantVestingTokens(
        address beneficiary,
        uint256 totalAmount,
        uint256 vestingAmount,
        uint32 startDay,
        address vestingLocation,
        address grantor
    )
    internal returns (bool ok)
    {
        // Make sure no prior grant is in effect.
        require(!_tokenGrants[beneficiary].isActive, "grant already exists");

        // Check for valid vestingAmount
        require(
            vestingAmount <= totalAmount && vestingAmount > 0
            && startDay >= JAN_1_2000_DAYS && startDay < JAN_1_3000_DAYS,
            "invalid vesting params");

        // Make sure the vesting schedule we are about to use is valid.
        require(_hasVestingSchedule(vestingLocation), "no such vesting schedule");

        // Transfer the total number of tokens from grantor into the account's holdings.
        _transfer(grantor, beneficiary, totalAmount);
        /* Emits a Transfer event. */

        // Create and populate a token grant, referencing vesting schedule.
        _tokenGrants[beneficiary] = tokenGrant(
            true/*isActive*/,
            false/*wasRevoked*/,
            startDay,
            vestingAmount,
            vestingLocation, /* The wallet address where the vesting schedule is kept. */
            grantor             /* The account that performed the grant (where revoked funds would be sent) */
        );

        // Emit the event and return success.
        emit VestingTokensGranted(beneficiary, vestingAmount, startDay, vestingLocation, grantor);
        return true;
    }

    /**
     * @dev Immediately grants tokens to an address, including a portion that will vest over time
     * according to a set vesting schedule. The overall duration and cliff duration of the grant must
     * be an even multiple of the vesting interval.
     *
     * @param beneficiary = Address to which tokens will be granted.
     * @param totalAmount = Total number of tokens to deposit into the account.
     * @param vestingAmount = Out of totalAmount, the number of tokens subject to vesting.
     * @param startDay = Start day of the grant's vesting schedule, in days since the UNIX epoch
     *   (start of day). The startDay may be given as a date in the future or in the past, going as far
     *   back as year 2000.
     * @param duration = Duration of the vesting schedule, with respect to the grant start day, in days.
     * @param cliffDuration = Duration of the cliff, with respect to the grant start day, in days.
     * @param interval = Number of days between vesting increases.
     * @param isRevocable = True if the grant can be revoked (i.e. was a gift) or false if it cannot
     *   be revoked (i.e. tokens were purchased).
     */
    function grantVestingTokens(
        address beneficiary,
        uint256 totalAmount,
        uint256 vestingAmount,
        uint32 startDay,
        uint32 duration,
        uint32 cliffDuration,
        uint32 interval,
        bool isRevocable
    ) public onlyGrantor returns (bool ok) {
        // Make sure no prior vesting schedule has been set.
        require(!_tokenGrants[beneficiary].isActive, "grant already exists");

        // The vesting schedule is unique to this wallet and so will be stored here,
        _setVestingSchedule(beneficiary, cliffDuration, duration, interval, isRevocable);

        // Issue grantor tokens to the beneficiary, using beneficiary's own vesting schedule.
        _grantVestingTokens(beneficiary, totalAmount, vestingAmount, startDay, beneficiary, msg.sender);

        return true;
    }

    /**
     * @dev This variant only grants tokens if the beneficiary account has previously self-registered.
     */
    function safeGrantVestingTokens(
        address beneficiary, uint256 totalAmount, uint256 vestingAmount,
        uint32 startDay, uint32 duration, uint32 cliffDuration, uint32 interval,
        bool isRevocable) public onlyGrantor onlyExistingAccount(beneficiary) returns (bool ok) {

        return grantVestingTokens(
            beneficiary, totalAmount, vestingAmount,
            startDay, duration, cliffDuration, interval,
            isRevocable);
    }


    // =========================================================================
    // === Check vesting.
    // =========================================================================

    /**
     * @dev returns the day number of the current day, in days since the UNIX epoch.
     */
    function today() public view returns (uint32 dayNumber) {
        return uint32(block.timestamp / SECONDS_PER_DAY);
    }

    function _effectiveDay(uint32 onDayOrToday) internal view returns (uint32 dayNumber) {
        return onDayOrToday == 0 ? today() : onDayOrToday;
    }

    /**
     * @dev Determines the amount of tokens that have not vested in the given account.
     *
     * The math is: not vested amount = vesting amount * (end date - on date)/(end date - start date)
     *
     * @param grantHolder = The account to check.
     * @param onDayOrToday = The day to check for, in days since the UNIX epoch. Can pass
     *   the special value 0 to indicate today.
     */
    function _getNotVestedAmount(address grantHolder, uint32 onDayOrToday) internal view returns (uint256 amountNotVested) {
        tokenGrant storage grant = _tokenGrants[grantHolder];
        vestingSchedule storage vesting = _vestingSchedules[grant.vestingLocation];
        uint32 onDay = _effectiveDay(onDayOrToday);

        // If there's no schedule, or before the vesting cliff, then the full amount is not vested.
        if (!grant.isActive || onDay < grant.startDay + vesting.cliffDuration)
        {
            // None are vested (all are not vested)
            return grant.amount;
        }
        // If after end of vesting, then the not vested amount is zero (all are vested).
        else if (onDay >= grant.startDay + vesting.duration)
        {
            // All are vested (none are not vested)
            return uint256(0);
        }
        // Otherwise a fractional amount is vested.
        else
        {
            // Compute the exact number of days vested.
            uint32 daysVested = onDay - grant.startDay;
            // Adjust result rounding down to take into consideration the interval.
            uint32 effectiveDaysVested = (daysVested / vesting.interval) * vesting.interval;

            // Compute the fraction vested from schedule using 224.32 fixed point math for date range ratio.
            // Note: This is safe in 256-bit math because max value of X billion tokens = X*10^27 wei, and
            // typical token amounts can fit into 90 bits. Scaling using a 32 bits value results in only 125
            // bits before reducing back to 90 bits by dividing. There is plenty of room left, even for token
            // amounts many orders of magnitude greater than mere billions.
            uint256 vested = grant.amount.mul(effectiveDaysVested).div(vesting.duration);
            return grant.amount.sub(vested);
        }
    }

    /**
     * @dev Computes the amount of funds in the given account which are available for use as of
     * the given day. If there's no vesting schedule then 0 tokens are considered to be vested and
     * this just returns the full account balance.
     *
     * The math is: available amount = total funds - notVestedAmount.
     *
     * @param grantHolder = The account to check.
     * @param onDay = The day to check for, in days since the UNIX epoch.
     */
    function _getAvailableAmount(address grantHolder, uint32 onDay) internal view returns (uint256 amountAvailable) {
        uint256 totalTokens = balanceOf(grantHolder);
        uint256 vested = totalTokens.sub(_getNotVestedAmount(grantHolder, onDay));
        return vested;
    }

    /**
     * @dev returns all information about the grant's vesting as of the given day
     * for the given account. Only callable by the account holder or a grantor, so
     * this is mainly intended for administrative use.
     *
     * @param grantHolder = The address to do this for.
     * @param onDayOrToday = The day to check for, in days since the UNIX epoch. Can pass
     *   the special value 0 to indicate today.
     * @return = A tuple with the following values:
     *   amountVested = the amount out of vestingAmount that is vested
     *   amountNotVested = the amount that is vested (equal to vestingAmount - vestedAmount)
     *   amountOfGrant = the amount of tokens subject to vesting.
     *   vestStartDay = starting day of the grant (in days since the UNIX epoch).
     *   vestDuration = grant duration in days.
     *   cliffDuration = duration of the cliff.
     *   vestIntervalDays = number of days between vesting periods.
     *   isActive = true if the vesting schedule is currently active.
     *   wasRevoked = true if the vesting schedule was revoked.
     */
    function vestingForAccountAsOf(
        address grantHolder,
        uint32 onDayOrToday
    )
    public
    view
    onlyGrantorOrSelf(grantHolder)
    returns (
        uint256 amountVested,
        uint256 amountNotVested,
        uint256 amountOfGrant,
        uint32 vestStartDay,
        uint32 vestDuration,
        uint32 cliffDuration,
        uint32 vestIntervalDays,
        bool isActive,
        bool wasRevoked
    )
    {
        tokenGrant storage grant = _tokenGrants[grantHolder];
        vestingSchedule storage vesting = _vestingSchedules[grant.vestingLocation];
        uint256 notVestedAmount = _getNotVestedAmount(grantHolder, onDayOrToday);
        uint256 grantAmount = grant.amount;

        return (
        grantAmount.sub(notVestedAmount),
        notVestedAmount,
        grantAmount,
        grant.startDay,
        vesting.duration,
        vesting.cliffDuration,
        vesting.interval,
        grant.isActive,
        grant.wasRevoked
        );
    }

    /**
     * @dev returns all information about the grant's vesting as of the given day
     * for the current account, to be called by the account holder.
     *
     * @param onDayOrToday = The day to check for, in days since the UNIX epoch. Can pass
     *   the special value 0 to indicate today.
     * @return = A tuple with the following values:
     *   amountVested = the amount out of vestingAmount that is vested
     *   amountNotVested = the amount that is vested (equal to vestingAmount - vestedAmount)
     *   amountOfGrant = the amount of tokens subject to vesting.
     *   vestStartDay = starting day of the grant (in days since the UNIX epoch).
     *   cliffDuration = duration of the cliff.
     *   vestDuration = grant duration in days.
     *   vestIntervalDays = number of days between vesting periods.
     *   isActive = true if the vesting schedule is currently active.
     *   wasRevoked = true if the vesting schedule was revoked.
     */
    function vestingAsOf(uint32 onDayOrToday) public view returns (
        uint256 amountVested,
        uint256 amountNotVested,
        uint256 amountOfGrant,
        uint32 vestStartDay,
        uint32 vestDuration,
        uint32 cliffDuration,
        uint32 vestIntervalDays,
        bool isActive,
        bool wasRevoked
    )
    {
        return vestingForAccountAsOf(msg.sender, onDayOrToday);
    }

    /**
     * @dev returns true if the account has sufficient funds available to cover the given amount,
     *   including consideration for vesting tokens.
     *
     * @param account = The account to check.
     * @param amount = The required amount of vested funds.
     * @param onDay = The day to check for, in days since the UNIX epoch.
     */
    function _fundsAreAvailableOn(address account, uint256 amount, uint32 onDay) internal view returns (bool ok) {
        return (amount <= _getAvailableAmount(account, onDay));
    }

    /**
     * @dev Modifier to make a function callable only when the amount is sufficiently vested right now.
     *
     * @param account = The account to check.
     * @param amount = The required amount of vested funds.
     */
    modifier onlyIfFundsAvailableNow(address account, uint256 amount) {
        // Distinguish insufficient overall balance from insufficient vested funds balance in failure msg.
        require(_fundsAreAvailableOn(account, amount, today()),
            balanceOf(account) < amount ? "insufficient funds" : "insufficient vested funds");
        _;
    }


    // =========================================================================
    // === Grant revocation
    // =========================================================================

    /**
     * @dev If the account has a revocable grant, this forces the grant to end based on computing
     * the amount vested up to the given date. All tokens that would no longer vest are returned
     * to the account of the original grantor.
     *
     * @param grantHolder = Address to which tokens will be granted.
     * @param onDay = The date upon which the vesting schedule will be effectively terminated,
     *   in days since the UNIX epoch (start of day).
     */
    function revokeGrant(address grantHolder, uint32 onDay) public onlyGrantor returns (bool ok) {
        tokenGrant storage grant = _tokenGrants[grantHolder];
        vestingSchedule storage vesting = _vestingSchedules[grant.vestingLocation];
        uint256 notVestedAmount;

        // Make sure grantor can only revoke from own pool.
        require(msg.sender == owner() || msg.sender == grant.grantor, "not allowed");
        // Make sure a vesting schedule has previously been set.
        require(grant.isActive, "no active grant");
        // Make sure it's revocable.
        require(vesting.isRevocable, "irrevocable");
        // Fail on likely erroneous input.
        require(onDay <= grant.startDay + vesting.duration, "no effect");
        // Don"t let grantor revoke anf portion of vested amount.
        require(onDay >= today(), "cannot revoke vested holdings");

        notVestedAmount = _getNotVestedAmount(grantHolder, onDay);

        // Use ERC20 _approve() to forcibly approve grantor to take back not-vested tokens from grantHolder.
        _approve(grantHolder, grant.grantor, notVestedAmount);
        /* Emits an Approval Event. */
        transferFrom(grantHolder, grant.grantor, notVestedAmount);
        /* Emits a Transfer and an Approval Event. */

        // Kill the grant by updating wasRevoked and isActive.
        _tokenGrants[grantHolder].wasRevoked = true;
        _tokenGrants[grantHolder].isActive = false;

        emit GrantRevoked(grantHolder, onDay);
        /* Emits the GrantRevoked event. */
        return true;
    }


    // =========================================================================
    // === Overridden ERC20 functionality
    // =========================================================================

    /**
     * @dev Methods transfer() and approve() require an additional available funds check to
     * prevent spending held but non-vested tokens. Note that transferFrom() does NOT have this
     * additional check because approved funds come from an already set-aside allowance, not from the wallet.
     */
    function transfer(address to, uint256 value) public onlyIfFundsAvailableNow(msg.sender, value) returns (bool ok) {
        return super.transfer(to, value);
    }

    /**
     * @dev Additional available funds check to prevent spending held but non-vested tokens.
     */
    function approve(address spender, uint256 value) public onlyIfFundsAvailableNow(msg.sender, value) returns (bool ok) {
        return super.approve(spender, value);
    }
}

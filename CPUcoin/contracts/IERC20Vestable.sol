pragma solidity ^0.5.7;

import "../../openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";

interface IERC20Vestable {
    function getIntrinsicVestingSchedule(address grantHolder)
    external
    view
    returns (
        uint32 cliffDuration,
        uint32 vestDuration,
        uint32 vestIntervalDays
    );

    function grantVestingTokens(
        address beneficiary,
        uint256 totalAmount,
        uint256 vestingAmount,
        uint32 startDay,
        uint32 duration,
        uint32 cliffDuration,
        uint32 interval,
        bool isRevocable
    ) external returns (bool ok);

    function today() external view returns (uint32 dayNumber);

    function vestingForAccountAsOf(
        address grantHolder,
        uint32 onDayOrToday
    )
    external
    view
    returns (
        uint256 amountVested,
        uint256 amountNotVested,
        uint256 amountOfGrant,
        uint32 vestStartDay,
        uint32 cliffDuration,
        uint32 vestDuration,
        uint32 vestIntervalDays,
        bool isActive,
        bool wasRevoked
    );

    function vestingAsOf(uint32 onDayOrToday) external view returns (
        uint256 amountVested,
        uint256 amountNotVested,
        uint256 amountOfGrant,
        uint32 vestStartDay,
        uint32 cliffDuration,
        uint32 vestDuration,
        uint32 vestIntervalDays,
        bool isActive,
        bool wasRevoked
    );

    function revokeGrant(address grantHolder, uint32 onDay) external returns (bool);


    event VestingScheduleCreated(
        address indexed vestingLocation,
        uint32 cliffDuration, uint32 indexed duration, uint32 interval,
        bool indexed isRevocable);

    event VestingTokensGranted(
        address indexed beneficiary,
        uint256 indexed vestingAmount,
        uint32 startDay,
        address vestingLocation,
        address indexed grantor);

    event GrantRevoked(address indexed grantHolder, uint32 indexed onDay);
}

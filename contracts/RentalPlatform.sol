// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title RentalPlatform
 * @dev A smart contract for a decentralized item rental platform.
 * Stores item details and IPFS metadata links on-chain.
 * Handles rentals, returns, fees, and payments.
 */
contract RentalPlatform is ReentrancyGuard {

    // --- Structs ---
    struct Item {
        uint256 id;
        string title; // Basic title for potential on-chain filtering
        address payable owner;
        uint256 dailyRentalPrice; // Price per day in Wei
        uint256 deposit;          // Deposit amount in Wei
        string metadataCID;       // IPFS CID linking to off-chain metadata (image, description, etc.)
        address payable renter;
        uint256 rentalStartTime;  // Timestamp when the rental period began
        uint256 rentedUntil;      // Timestamp until which the item is paid for (initially 1 day)
        bool isListed;            // True if the item is available for rent
        bool exists;              // To check if an item ID is valid
    }

    // --- State Variables ---
    mapping(uint256 => Item) public items;
    uint256 public totalItems; // Counter for total items listed

    // Optional: Track items per owner/renter (requires more complex logic for removal on return/delist)
    mapping(address => uint256[]) private _ownerItemsList;
    mapping(address => uint256[]) private _renterItemsList;

    // Constants
    uint256 public constant LATE_FEE_PERCENTAGE = 10; // Example: 10% of deposit as late fee per day

    // --- Events ---
    event ItemListed(
        uint256 indexed itemId,
        address indexed owner,
        string title,
        uint256 dailyRentalPrice,
        uint256 deposit,
        string metadataCID // Include CID in the event
    );

    event ItemRented(
        uint256 indexed itemId,
        address indexed renter,
        uint256 rentedUntil,
        uint256 depositPaid
    );

    event ItemReturned(
        uint256 indexed itemId,
        address indexed renter,
        uint256 rentalFeePaid, // Note: Emits CALCULATED fee before potential capping
        uint256 depositRefunded,
        uint256 lateFeePaid    // Note: Emits CALCULATED fee before potential capping
    );

    event ItemDelisted(
        uint256 indexed itemId,
        address indexed owner
    );

    // --- Modifiers ---
    modifier onlyItemOwner(uint256 _itemId) {
        require(items[_itemId].exists, "Item does not exist.");
        require(msg.sender == items[_itemId].owner, "Only the item owner can call this function.");
        _;
    }

    modifier onlyRenter(uint256 _itemId) {
        require(items[_itemId].exists, "Item does not exist."); // Corrected typo
        require(msg.sender == items[_itemId].renter, "Only the current renter can call this function.");
        _;
    }

    modifier isListed(uint256 _itemId) {
        require(items[_itemId].exists, "Item does not exist."); // Corrected typo
        require(items[_itemId].isListed, "Item is not listed for rent.");
        _;
    }

    modifier isRented(uint256 _itemId) {
        require(items[_itemId].exists, "Item does not exist."); // Corrected typo
        require(!items[_itemId].isListed && items[_itemId].renter != address(0), "Item is not currently rented.");
        _;
    }

    // --- Functions ---

    /**
     * @notice Allows an owner to list a new item for rent.
     * @param _title The title or description of the item (basic).
     * @param _dailyRentalPrice The rental price per day in Wei.
     * @param _deposit The security deposit required in Wei.
     * @param _metadataCID The IPFS Content ID linking to off-chain metadata (image, full desc, etc.).
     */
    function listItem(
        string memory _title,
        uint256 _dailyRentalPrice,
        uint256 _deposit,
        string memory _metadataCID // Accept CID
    ) external {
        require(bytes(_title).length > 0, "Title cannot be empty.");
        require(_dailyRentalPrice > 0, "Daily rental price must be greater than zero.");
        require(_deposit > 0, "Deposit must be greater than zero.");
        require(bytes(_metadataCID).length > 0, "Metadata CID cannot be empty."); // Basic check

        totalItems++;
        uint256 newItemId = totalItems;

        items[newItemId] = Item({
            id: newItemId,
            title: _title,
            owner: payable(msg.sender),
            dailyRentalPrice: _dailyRentalPrice,
            deposit: _deposit,
            metadataCID: _metadataCID, // Store the CID
            renter: payable(address(0)),
            rentalStartTime: 0,
            rentedUntil: 0,
            isListed: true,
            exists: true
        });

        // Optional: Add to owner's list
        _ownerItemsList[msg.sender].push(newItemId);

        // Emit event including the CID
        emit ItemListed(newItemId, msg.sender, _title, _dailyRentalPrice, _deposit, _metadataCID);
    }

    /**
     * @notice Allows a user to rent a listed item.
     * @dev Requires payment equal to deposit + 1 day's rent.
     * @param _itemId The ID of the item to rent.
     */
    function rentItem(uint256 _itemId) external payable isListed(_itemId) nonReentrant {
        Item storage item = items[_itemId];
        uint256 requiredPayment = item.deposit + item.dailyRentalPrice;
        require(msg.value == requiredPayment, "Incorrect payment amount sent.");

        item.renter = payable(msg.sender);
        item.isListed = false; // Lock item availability
        item.rentalStartTime = block.timestamp;
        item.rentedUntil = block.timestamp + 1 days; // Initially rented for 1 day

        // Optional: Add to renter's list
        _renterItemsList[msg.sender].push(_itemId);

        emit ItemRented(_itemId, msg.sender, item.rentedUntil, item.deposit);
    }

     /**
     * @notice Allows the current renter to return an item.
     * @dev Calculates rental fees, late fees, and distributes funds correctly.
     * @param _itemId The ID of the item to return.
     */
    function returnItem(uint256 _itemId) external onlyRenter(_itemId) isRented(_itemId) nonReentrant {
        Item storage item = items[_itemId];

        // Calculate rental duration (rounds up to nearest day)
        uint256 rentalDurationSeconds = block.timestamp - item.rentalStartTime;
        uint256 rentalDurationDays = (rentalDurationSeconds + (1 days - 1)) / 1 days;
        if (rentalDurationDays == 0) {
            rentalDurationDays = 1; // Minimum 1 day charge
        }

        // Calculate base rental fee and late fee
        uint256 calculatedRentalFee = rentalDurationDays * item.dailyRentalPrice;
        uint256 calculatedLateFee = 0;
        uint256 depositRefund = item.deposit; // Start with full deposit
        uint256 paymentToOwner = 0; // This will hold the final amount owner receives

        // Calculate late fee if applicable
        if (block.timestamp > item.rentedUntil) {
            uint256 overdueSeconds = block.timestamp - item.rentedUntil;
            // Round up overdue days
            uint256 overdueDays = (overdueSeconds + (1 days - 1)) / 1 days;
            if (overdueDays > 0) {
                 calculatedLateFee = (item.deposit * LATE_FEE_PERCENTAGE * overdueDays) / 100;
            }
        }

        // Determine final payment amounts based on fees vs deposit
        uint256 totalDeduction = calculatedRentalFee + calculatedLateFee;

        if (totalDeduction >= depositRefund) {
            // Fees meet or exceed deposit: Owner gets full deposit, refund is 0
             paymentToOwner = depositRefund;
             depositRefund = 0;
             // Note: Event below still emits originally calculated fees for transparency
        } else {
             // Fees are less than deposit: Owner gets full fees, refund is remainder
             paymentToOwner = totalDeduction;
             // Solidity 0.8+ automatically checks for underflow
             depositRefund = depositRefund - totalDeduction;
        }

        // --- Checks-Effects-Interactions Pattern ---
        // 1. Effects (update state)
        address payable renterAddress = item.renter; // Store before clearing state
        item.renter = payable(address(0));
        item.rentalStartTime = 0;
        item.rentedUntil = 0;
        item.isListed = true; // Make item available again

        // Optional: Implement logic to remove item from _renterItemsList (can be gas intensive)

        // Emit event *before* interactions, using originally calculated fees
        emit ItemReturned(_itemId, renterAddress, calculatedRentalFee, depositRefund, calculatedLateFee);

        // 2. Interactions (external calls/transfers)
        // Transfer payment to owner (Corrected Logic)
        if (paymentToOwner > 0) {
             (bool successOwner, ) = item.owner.call{value: paymentToOwner}("");
             require(successOwner, "Failed to send payment to owner.");
        }

        // Transfer refund to renter
        if (depositRefund > 0) {
             (bool successRenter, ) = renterAddress.call{value: depositRefund}("");
             require(successRenter, "Failed to send deposit refund to renter.");
        }
    }

    /**
     * @notice Allows an owner to delist their item if it's not currently rented.
     * @param _itemId The ID of the item to delist.
     */
    function delistItem(uint256 _itemId) external onlyItemOwner(_itemId) isListed(_itemId) {
         Item storage item = items[_itemId];
         // Although isListed modifier checks this, explicit check is clearer
         require(item.renter == address(0), "Cannot delist a currently rented item.");

         item.isListed = false;

         // Optional: Implement removal from _ownerItemsList

         emit ItemDelisted(_itemId, msg.sender);
    }


    // --- View Functions (for frontend) ---

    /**
     * @notice Get details for a specific item, including metadata CID.
     * @param _itemId The ID of the item.
     * @return Item details struct.
     */
    function getItem(uint256 _itemId) external view returns (Item memory) {
        require(items[_itemId].exists, "Item does not exist.");
        return items[_itemId];
    }

     /**
     * @notice Get listed item IDs (example with basic pagination/limit).
     * @dev Note: Iterating through all items on-chain can be inefficient for large lists.
     * Consider events + off-chain indexing for production marketplaces.
     * @param _offset Starting index for checking items (0 means check from item ID 1).
     * @param _limit Maximum number of listed item IDs to return.
     * @return Array of listed item IDs.
     */
    function getListedItemIds(uint256 _offset, uint256 _limit) external view returns (uint256[] memory) {
        uint256 maxItems = totalItems;
        if (_limit == 0) {
             return new uint256[](0); // Handle zero limit
        }
        if (_offset >= maxItems) {
            return new uint256[](0); // Offset is beyond the last possible item
        }

        // Estimate size needed, capped by limit and remaining items
        uint256 remainingItems = maxItems - _offset;
        uint256 estimatedCount = remainingItems < _limit ? remainingItems : _limit;
        uint256[] memory tempIds = new uint256[](estimatedCount); // Allocate based on estimate
        uint256 count = 0;

        // Iterate through relevant item IDs (from _offset + 1 up to totalItems)
        for (uint256 i = _offset + 1; i <= maxItems; i++) {
            if (items[i].isListed && items[i].exists) {
                if (count < estimatedCount) { // Check against allocated size
                     tempIds[count] = i;
                     count++;
                 } else {
                     // Stop if we've reached the limit
                     break;
                 }
            }
            // Stop if we have found enough items to fill the limit
             if (count == _limit) {
                 break;
             }
        }

        // Resize array to actual count found
        uint256[] memory listedIds = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            listedIds[i] = tempIds[i];
        }
        return listedIds;
    }


    // Function to receive Ether (necessary for holding deposits)
    receive() external payable {}
    fallback() external payable {}
}
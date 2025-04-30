pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract RentalPlatform is ReentrancyGuard {

    struct Item {
        uint256 id;
        string title;
        address payable owner;
        uint256 dailyRentalPrice;
        uint256 deposit;
        string metadataCID;
        address payable renter;
        uint256 rentalStartTime;
        uint256 rentedUntil;
        bool isListed;
        bool exists;
    }

    mapping(uint256 => Item) public items;
    uint256 public totalItems;

    mapping(address => uint256[]) private _ownerItemsList;
    mapping(address => uint256[]) private _renterItemsList;

    uint256 public constant LATE_FEE_PERCENTAGE = 10;

    event ItemListed(
        uint256 indexed itemId,
        address indexed owner,
        string title,
        uint256 dailyRentalPrice,
        uint256 deposit,
        string metadataCID
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
        uint256 rentalFeePaid,
        uint256 depositRefunded,
        uint256 lateFeePaid
    );

    event ItemDelisted(
        uint256 indexed itemId,
        address indexed owner
    );

    modifier onlyItemOwner(uint256 _itemId) {
        require(items[_itemId].exists, "Item does not exist.");
        require(msg.sender == items[_itemId].owner, "Only the item owner can call this function.");
        _;
    }

    modifier onlyRenter(uint256 _itemId) {
        require(items[_itemId].exists, "Item does not exist.");
        require(msg.sender == items[_itemId].renter, "Only the current renter can call this function.");
        _;
    }

    modifier isListed(uint256 _itemId) {
        require(items[_itemId].exists, "Item does not exist.");
        require(items[_itemId].isListed, "Item is not listed for rent.");
        _;
    }

    modifier isRented(uint256 _itemId) {
        require(items[_itemId].exists, "Item does not exist.");
        require(!items[_itemId].isListed && items[_itemId].renter != address(0), "Item is not currently rented.");
        _;
    }

    function listItem(
        string memory _title,
        uint256 _dailyRentalPrice,
        uint256 _deposit,
        string memory _metadataCID
    ) external {
        require(bytes(_title).length > 0, "Title cannot be empty.");
        require(_dailyRentalPrice > 0, "Daily rental price must be greater than zero.");
        require(_deposit > 0, "Deposit must be greater than zero.");
        require(bytes(_metadataCID).length > 0, "Metadata CID cannot be empty.");

        totalItems++;
        uint256 newItemId = totalItems;

        items[newItemId] = Item({
            id: newItemId,
            title: _title,
            owner: payable(msg.sender),
            dailyRentalPrice: _dailyRentalPrice,
            deposit: _deposit,
            metadataCID: _metadataCID,
            renter: payable(address(0)),
            rentalStartTime: 0,
            rentedUntil: 0,
            isListed: true,
            exists: true
        });

        _ownerItemsList[msg.sender].push(newItemId);

        emit ItemListed(newItemId, msg.sender, _title, _dailyRentalPrice, _deposit, _metadataCID);
    }

    function rentItem(uint256 _itemId) external payable isListed(_itemId) nonReentrant {
        Item storage item = items[_itemId];
        uint256 requiredPayment = item.deposit + item.dailyRentalPrice;
        require(msg.value == requiredPayment, "Incorrect payment amount sent.");

        item.renter = payable(msg.sender);
        item.isListed = false;
        item.rentalStartTime = block.timestamp;
        item.rentedUntil = block.timestamp + 1 days;

        _renterItemsList[msg.sender].push(_itemId);

        emit ItemRented(_itemId, msg.sender, item.rentedUntil, item.deposit);
    }

    function returnItem(uint256 _itemId) external onlyRenter(_itemId) isRented(_itemId) nonReentrant {
        Item storage item = items[_itemId];

        uint256 rentalDurationSeconds = block.timestamp - item.rentalStartTime;
        uint256 rentalDurationDays = (rentalDurationSeconds + (1 days - 1)) / 1 days;
        if (rentalDurationDays == 0) {
            rentalDurationDays = 1;
        }

        uint256 calculatedRentalFee = rentalDurationDays * item.dailyRentalPrice;
        uint256 calculatedLateFee = 0;
        uint256 depositRefund = item.deposit;
        uint256 paymentToOwner = 0;

        if (block.timestamp > item.rentedUntil) {
            uint256 overdueSeconds = block.timestamp - item.rentedUntil;

            uint256 overdueDays = (overdueSeconds + (1 days - 1)) / 1 days;
            if (overdueDays > 0) {
                 calculatedLateFee = (item.deposit * LATE_FEE_PERCENTAGE * overdueDays) / 100;
            }
        }

        uint256 totalDeduction = calculatedRentalFee + calculatedLateFee;

        if (totalDeduction >= depositRefund) {
             paymentToOwner = depositRefund;
             depositRefund = 0;
        } else {
             paymentToOwner = totalDeduction;
             depositRefund = depositRefund - totalDeduction;
        }

        address payable renterAddress = item.renter;
        item.renter = payable(address(0));
        item.rentalStartTime = 0;
        item.rentedUntil = 0;
        item.isListed = true;

        emit ItemReturned(_itemId, renterAddress, calculatedRentalFee, depositRefund, calculatedLateFee);

        if (paymentToOwner > 0) {
             (bool successOwner, ) = item.owner.call{value: paymentToOwner}("");
             require(successOwner, "Failed to send payment to owner.");
        }

        if (depositRefund > 0) {
             (bool successRenter, ) = renterAddress.call{value: depositRefund}("");
             require(successRenter, "Failed to send deposit refund to renter.");
        }
    }

    function delistItem(uint256 _itemId) external onlyItemOwner(_itemId) isListed(_itemId) {
         Item storage item = items[_itemId];

         require(item.renter == address(0), "Cannot delist a currently rented item.");

         item.isListed = false;

         emit ItemDelisted(_itemId, msg.sender);
    }

    function getItem(uint256 _itemId) external view returns (Item memory) {
        require(items[_itemId].exists, "Item does not exist.");
        return items[_itemId];
    }

    function getListedItemIds(uint256 _offset, uint256 _limit) external view returns (uint256[] memory) {
        uint256 maxItems = totalItems;
        if (_limit == 0) {
             return new uint256[](0);
        }
        if (_offset >= maxItems) {
            return new uint256[](0);
        }

        uint256 remainingItems = maxItems - _offset;
        uint256 estimatedCount = remainingItems < _limit ? remainingItems : _limit;
        uint256[] memory tempIds = new uint256[](estimatedCount);
        uint256 count = 0;

        for (uint256 i = _offset + 1; i <= maxItems; i++) {
            if (items[i].isListed && items[i].exists) {
                if (count < estimatedCount) {
                     tempIds[count] = i;
                     count++;
                 } else {
                     break;
                 }
            }

             if (count == _limit) {
                 break;
             }
        }

        uint256[] memory listedIds = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            listedIds[i] = tempIds[i];
        }
        return listedIds;
    }

    receive() external payable {}
    fallback() external payable {}
}
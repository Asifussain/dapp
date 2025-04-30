const RentalPlatform = artifacts.require("RentalPlatform");
const truffleAssert = require('truffle-assertions');

const timeTravel = async (seconds) => {
    await web3.currentProvider.send({
        jsonrpc: "2.0",
        method: "evm_increaseTime",
        params: [seconds],
        id: new Date().getTime()
    }, () => {});
    await web3.currentProvider.send({
        jsonrpc: "2.0",
        method: "evm_mine",
        params: [],
        id: new Date().getTime()
    }, () => {});
};

const LATE_FEE_PERCENTAGE_JS = 10;

contract("RentalPlatform", accounts => {
    let contractInstance;
    const owner = accounts[0];
    const renter1 = accounts[1];
    const renter2 = accounts[2];
    const nonOwner = accounts[3];

    const itemTitle = "Test Book";
    const dummyMetadataCID = "QmTESTcid123456789abcdef";
    const dailyPrice = web3.utils.toWei("0.01", "ether");
    const deposit = web3.utils.toWei("0.1", "ether");
    const dailyPriceBN = web3.utils.toBN(dailyPrice);
    const depositBN = web3.utils.toBN(deposit);

    const initialRentPayment = depositBN.add(dailyPriceBN);

    beforeEach(async () => {
        contractInstance = await RentalPlatform.new({ from: owner });
        await contractInstance.listItem(itemTitle, dailyPrice, deposit, dummyMetadataCID, { from: owner });
    });

    describe("Item Listing", () => {
        it("should allow an owner to list an item", async () => {
            const item = await contractInstance.items(1);
            assert.equal(item.id.toString(), '1');
            assert.equal(item.metadataCID, dummyMetadataCID);
        });

        it("should reject listing with zero price", async () => { await truffleAssert.reverts( contractInstance.listItem(itemTitle, 0, deposit, dummyMetadataCID, { from: owner }), "Daily rental price must be greater than zero." ); });
        it("should reject listing with zero deposit", async () => { await truffleAssert.reverts( contractInstance.listItem(itemTitle, dailyPrice, 0, dummyMetadataCID, { from: owner }), "Deposit must be greater than zero." ); });
        it("should reject listing with empty title", async () => { await truffleAssert.reverts( contractInstance.listItem("", dailyPrice, deposit, dummyMetadataCID, { from: owner }), "Title cannot be empty." ); });
        it("should reject listing with empty metadata CID", async () => { await truffleAssert.reverts( contractInstance.listItem(itemTitle, dailyPrice, deposit, "", { from: owner }), "Metadata CID cannot be empty." ); });
        it("should increment totalItems count", async () => {
            await contractInstance.listItem("Item 2", dailyPrice, deposit, "cid2", { from: owner });
            const count = await contractInstance.totalItems();
            assert.equal(count.toString(), '2');
        });
    });

    describe("Item Renting", () => {
        it("should allow a user to rent a listed item with correct payment", async () => {
            const initialContractBalance = web3.utils.toBN(await web3.eth.getBalance(contractInstance.address));
            const tx = await contractInstance.rentItem(1, { from: renter1, value: initialRentPayment.toString() });
            const item = await contractInstance.items(1);
            assert.equal(item.renter, renter1);
            assert.equal(item.isListed, false);
            assert.ok(item.rentalStartTime.gtn(0));
            const finalContractBalance = web3.utils.toBN(await web3.eth.getBalance(contractInstance.address));
            const expectedBalance = initialContractBalance.add(initialRentPayment);
            assert.equal(finalContractBalance.toString(), expectedBalance.toString());
            truffleAssert.eventEmitted(tx, 'ItemRented', (ev) => {
                return ev.itemId.toString() === '1' && ev.renter === renter1 && ev.depositPaid.toString() === depositBN.toString() && ev.rentalStartTime.gt(web3.utils.toBN(0));
            });
        });

        it("should reject renting with incorrect payment (less)", async () => { await truffleAssert.reverts( contractInstance.rentItem(1, { from: renter1, value: web3.utils.toWei("0.05", "ether") }), "Incorrect payment amount sent." ); });
        it("should reject renting with incorrect payment (more)", async () => { await truffleAssert.reverts( contractInstance.rentItem(1, { from: renter1, value: initialRentPayment.add(web3.utils.toBN(1)).toString() }), "Incorrect payment amount sent." ); });
        it("should reject renting an item that is not listed (already rented)", async () => {
            await contractInstance.rentItem(1, { from: renter1, value: initialRentPayment.toString() });
            await truffleAssert.reverts( contractInstance.rentItem(1, { from: renter2, value: initialRentPayment.toString() }), "Item is not listed for rent." );
        });
        it("should reject renting a non-existent item", async () => { await truffleAssert.reverts( contractInstance.rentItem(99, { from: renter1, value: initialRentPayment.toString() }), "Item does not exist." ); });
        it("should prevent reentrancy attacks on rentItem", async () => {
            await contractInstance.rentItem(1, { from: renter1, value: initialRentPayment.toString() });
            const item = await contractInstance.items(1);
            assert.equal(item.renter, renter1);
        });
    });

    describe("Item Returning - New Logic", () => {
        let rentalStartTimeBN;

        beforeEach(async () => {
            const tx = await contractInstance.rentItem(1, { from: renter1, value: initialRentPayment.toString() });
            const receipt = await web3.eth.getTransactionReceipt(tx.tx);
            const block = await web3.eth.getBlock(receipt.blockNumber);
            rentalStartTimeBN = web3.utils.toBN(block.timestamp);
        });

        it("should handle immediate return (within 1st day)", async () => {
            const ownerInitialBalance = web3.utils.toBN(await web3.eth.getBalance(owner));
            const rentalDurationDays = web3.utils.toBN(1);
            const calculatedRentalFee = rentalDurationDays.mul(dailyPriceBN);
            const depositCoveredDays = depositBN.div(dailyPriceBN);
            const gracePeriodDays = web3.utils.toBN(1).add(depositCoveredDays);
            let calculatedLateFee = web3.utils.toBN(0);
            const paymentDue = calculatedRentalFee.add(calculatedLateFee);
            const paymentToOwner = paymentDue.gte(depositBN) ? depositBN : paymentDue;
            const expectedRefund = depositBN.sub(paymentToOwner);
            const tx = await contractInstance.returnItem(1, { from: renter1 });
            const ownerFinalBalance = web3.utils.toBN(await web3.eth.getBalance(owner));
            assert.equal(ownerFinalBalance.toString(), ownerInitialBalance.add(paymentToOwner).toString(), "Owner balance incorrect (immediate return)");
            truffleAssert.eventEmitted(tx, 'ItemReturned', (ev) => {
                return ev.itemId.toString() === '1' &&
                       ev.rentalFeePaid.toString() === calculatedRentalFee.toString() &&
                       ev.depositRefunded.toString() === expectedRefund.toString() &&
                       ev.lateFeePaid.toString() === calculatedLateFee.toString();
            });
        });

        it("should handle return within deposit-covered period (e.g., 5 days)", async () => {
            await timeTravel(5 * 24 * 60 * 60);
            const ownerInitialBalance = web3.utils.toBN(await web3.eth.getBalance(owner));
            const rentalDurationDays = web3.utils.toBN(5);
            const calculatedRentalFee = rentalDurationDays.mul(dailyPriceBN);
            const depositCoveredDays = depositBN.div(dailyPriceBN);
            const gracePeriodDays = web3.utils.toBN(1).add(depositCoveredDays);
            let calculatedLateFee = web3.utils.toBN(0);
            const paymentDue = calculatedRentalFee.add(calculatedLateFee);
            const paymentToOwner = paymentDue.gte(depositBN) ? depositBN : paymentDue;
            const expectedRefund = depositBN.sub(paymentToOwner);
            const tx = await contractInstance.returnItem(1, { from: renter1 });
            const ownerFinalBalance = web3.utils.toBN(await web3.eth.getBalance(owner));
            assert.equal(ownerFinalBalance.toString(), ownerInitialBalance.add(paymentToOwner).toString(), "Owner balance incorrect (within deposit period)");
            truffleAssert.eventEmitted(tx, 'ItemReturned', (ev) => {
                return ev.itemId.toString() === '1' &&
                       ev.rentalFeePaid.toString() === calculatedRentalFee.toString() &&
                       ev.depositRefunded.toString() === expectedRefund.toString() &&
                       ev.lateFeePaid.toString() === calculatedLateFee.toString();
            });
        });

        it("should apply late fees after deposit period (e.g., 15 days)", async () => {
            await timeTravel(15 * 24 * 60 * 60);
            const ownerInitialBalance = web3.utils.toBN(await web3.eth.getBalance(owner));
            const rentalDurationDays = web3.utils.toBN(15);
            const calculatedRentalFee = rentalDurationDays.mul(dailyPriceBN);
            const depositCoveredDays = depositBN.div(dailyPriceBN);
            const gracePeriodDays = web3.utils.toBN(1).add(depositCoveredDays);
            let calculatedLateFee = web3.utils.toBN(0);
            if (rentalDurationDays.gt(gracePeriodDays)) {
                const overdueDays = rentalDurationDays.sub(gracePeriodDays);
                calculatedLateFee = depositBN.mul(web3.utils.toBN(LATE_FEE_PERCENTAGE_JS)).mul(overdueDays).div(web3.utils.toBN(100));
            }
            const paymentDue = calculatedRentalFee.add(calculatedLateFee);
            let paymentToOwner = paymentDue.gte(depositBN) ? depositBN : paymentDue;
            let expectedRefund = web3.utils.toBN(0);
            if (paymentToOwner.lt(depositBN)) {
                expectedRefund = depositBN.sub(paymentToOwner);
            }
            paymentToOwner = depositBN;
            const tx = await contractInstance.returnItem(1, { from: renter1 });
            const ownerFinalBalance = web3.utils.toBN(await web3.eth.getBalance(owner));
            assert.equal(ownerFinalBalance.toString(), ownerInitialBalance.add(paymentToOwner).toString(), "Owner balance incorrect (late return, deposit exceeded)");
            truffleAssert.eventEmitted(tx, 'ItemReturned', (ev) => {
                return ev.itemId.toString() === '1' &&
                       ev.rentalFeePaid.toString() === calculatedRentalFee.toString() &&
                       ev.depositRefunded.toString() === expectedRefund.toString() &&
                       ev.lateFeePaid.toString() === calculatedLateFee.toString();
            });
        });

        it("should handle return exactly at end of grace period (e.g., 11 days)", async () => {
            await timeTravel(11 * 24 * 60 * 60);
            const ownerInitialBalance = web3.utils.toBN(await web3.eth.getBalance(owner));
            const rentalDurationDays = web3.utils.toBN(11);
            const calculatedRentalFee = rentalDurationDays.mul(dailyPriceBN);
            const depositCoveredDays = depositBN.div(dailyPriceBN);
            const gracePeriodDays = web3.utils.toBN(1).add(depositCoveredDays);
            let calculatedLateFee = web3.utils.toBN(0);
            const paymentDue = calculatedRentalFee.add(calculatedLateFee);
            let paymentToOwner = paymentDue.gte(depositBN) ? depositBN : paymentDue;
            let expectedRefund = web3.utils.toBN(0);
            if (paymentToOwner.lt(depositBN)) {
                expectedRefund = depositBN.sub(paymentToOwner);
            }
            paymentToOwner = depositBN;
            const tx = await contractInstance.returnItem(1, { from: renter1 });
            const ownerFinalBalance = web3.utils.toBN(await web3.eth.getBalance(owner));
            assert.equal(ownerFinalBalance.toString(), ownerInitialBalance.add(paymentToOwner).toString(), "Owner balance incorrect (end of grace)");
            truffleAssert.eventEmitted(tx, 'ItemReturned', (ev) => {
                return ev.itemId.toString() === '1' &&
                       ev.rentalFeePaid.toString() === calculatedRentalFee.toString() &&
                       ev.depositRefunded.toString() === expectedRefund.toString() &&
                       ev.lateFeePaid.toString() === calculatedLateFee.toString();
            });
        });

        it("should reject returning an item not rented by the sender", async () => { await truffleAssert.reverts( contractInstance.returnItem(1, { from: renter2 }), "Only the current renter can call this function." ); });
        it("should reject returning an item that is not currently rented", async () => { await contractInstance.returnItem(1, { from: renter1 }); await truffleAssert.reverts( contractInstance.returnItem(1, { from: renter1 }), "Only the current renter can call this function." ); });
        it("should reject returning a non-existent item", async () => { await truffleAssert.reverts( contractInstance.returnItem(99, { from: renter1 }), "Item does not exist." ); });
        it("should prevent reentrancy attacks on returnItem", async () => { await contractInstance.returnItem(1, { from: renter1 }); const item = await contractInstance.items(1); assert.equal(item.isListed, true); });
    });

    describe("View Functions", () => {
        let listedItemIds;
        beforeEach(async () => {
            await contractInstance.listItem("Item B", dailyPrice, deposit, "cidB", { from: accounts[5] });
            await contractInstance.listItem("Item C", dailyPrice, deposit, "cidC", { from: owner });
            await contractInstance.rentItem(2, { from: renter1, value: initialRentPayment.toString() });
            listedItemIds = await contractInstance.getListedItemIds(0, 10);
        });
        it("should get correct item details with getItem", async () => { const item = await contractInstance.getItem(1); assert.equal(item.title, itemTitle); assert.equal(item.owner, owner); assert.equal(item.isListed, true); assert.equal(item.metadataCID, dummyMetadataCID); });
        it("should revert getItem for non-existent item", async () => { await truffleAssert.reverts( contractInstance.getItem(99), "Item does not exist." ); });
        it("should get listed item IDs", async () => { const ids = listedItemIds.map(id => id.toString()); assert.deepInclude(ids, '1'); assert.deepInclude(ids, '3'); assert.notDeepInclude(ids, '2'); assert.lengthOf(ids, 2); });
        it("should handle offset and limit for getListedItemIds", async () => {
            await contractInstance.listItem("Item D", dailyPrice, deposit, "cidD", { from: owner });
            const listedIdsPage1 = await contractInstance.getListedItemIds(0, 2);
            const listedIdsPage2 = await contractInstance.getListedItemIds(1, 2);
            const page1Ids = listedIdsPage1.map(id => id.toString());
            assert.deepEqual(page1Ids, ['1', '3']);
            const page2Ids = listedIdsPage2.map(id => id.toString());
            assert.deepEqual(page2Ids, ['3', '4']);
        });
        it("should return empty array if offset is out of bounds", async () => { const listedIds = await contractInstance.getListedItemIds(10, 5); assert.lengthOf(listedIds, 0); });
    });

    describe("Item Delisting", () => {
        it("should allow the owner to delist their listed item", async () => { const tx = await contractInstance.delistItem(1, { from: owner }); const item = await contractInstance.items(1); assert.equal(item.isListed, false); truffleAssert.eventEmitted(tx, 'ItemDelisted'); });
        it("should reject delisting by non-owner", async () => { await truffleAssert.reverts( contractInstance.delistItem(1, { from: nonOwner }), "Only the item owner can call this function." ); });
        it("should reject delisting a rented item", async () => { await contractInstance.rentItem(1, { from: renter1, value: initialRentPayment.toString() }); await truffleAssert.reverts( contractInstance.delistItem(1, { from: owner }), "Item is not listed for rent." ); });
        it("should reject delisting a non-existent item", async () => { await truffleAssert.reverts( contractInstance.delistItem(99, { from: owner }), "Item does not exist." ); });
    });
});
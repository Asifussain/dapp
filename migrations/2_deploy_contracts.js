const RentalPlatform = artifacts.require("RentalPlatform");

module.exports = function (deployer) {
  deployer.deploy(RentalPlatform);
};
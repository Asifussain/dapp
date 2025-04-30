require('dotenv').config();

module.exports = {
  networks: {
    development: {
      host: "127.0.0.1",
      port: 7545,
      network_id: "*",
    },
  },

  mocha: {
    reporter: 'eth-gas-reporter',
    reporterOptions : {
      currency: 'USD',
    }
  },

  compilers: {
    solc: {
      version: "0.8.20",
      settings: {
      optimizer: {
        enabled: true,
        runs: 200
      },
      evmVersion: "paris"
      }
    }
  },

  db: {
    enabled: false
  }
};
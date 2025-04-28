require('dotenv').config(); // Optional: if using .env for mnemonic/keys
// const HDWalletProvider = require('@truffle/hdwallet-provider');
// const mnemonic = process.env.MNEMONIC;

module.exports = {
  networks: {
    // Development network (Ganache)
    development: {
      host: "127.0.0.1",     // Localhost (default: none)
      port: 7545,            // Standard Ganache port
      network_id: "*",       // Any network (default: none)
    },
    // --- Optional: Other networks ---
    // sepolia: {
    //   provider: () => new HDWalletProvider(mnemonic, `https://sepolia.infura.io/v3/${process.env.INFURA_PROJECT_ID}`),
    //   network_id: 11155111,       // Sepolia's id
    //   confirmations: 2,    // # of confirmations to wait between deployments (default: 0)
    //   timeoutBlocks: 200,  // # of blocks before a deployment times out  (minimum/default: 50)
    //   skipDryRun: true     // Skip dry run before migrations? (default: false for public nets )
    // },
  },

  // Set default mocha options here, use special reporters, etc.
  mocha: {
    // timeout: 100000
    reporter: 'eth-gas-reporter', // Optional: install 'eth-gas-reporter' for gas usage reports
    reporterOptions : {
      currency: 'USD',
      // gasPrice: 21 // Optional: use fixed gas price for consistency
    }
  },

  // Configure your compilers
  // Inside module.exports = { ... }
  compilers: {
    solc: {
      version: "0.8.20",
      settings: {
      optimizer: {
        enabled: true,
        runs: 200
      },
      evmVersion: "paris" // Add this line (or try "shanghai")
      }
    }
  },
// ... rest of the config

  // Truffle DB is currently disabled by default; to enable it, change enabled: false to enabled: true
  //
  // Note: if you migrated your contracts prior to enabling this field in your Truffle project and want
  // those previously migrated contracts available in the .db directory, you will need to run the following:
  // $ truffle migrate --reset --compile-all

  db: {
    enabled: false
  }
};
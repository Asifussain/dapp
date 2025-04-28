# Decentralized Rental Platform

A trustless item rental platform built on Ethereum using Solidity, Truffle, and React.

## Project Overview

This project allows users to:
- **Owners:** List items (e.g., books, tools) for rent, specifying a daily rental price and a security deposit. [cite: 1, 9]
- **Renters:** Browse listed items and rent them by paying the required deposit plus the first day's rental fee in ETH. [cite: 1, 10]
- **Automatic Settlements:** Smart contracts handle the deposit holding, fee calculation based on rental duration, late fee penalties[cite: 24], and automatic fund distribution (rental fee to owner, refund to renter) upon item return[cite: 1, 11].

## Tech Stack

- **Smart Contracts:** Solidity ^0.8.20
- **Development Framework:** Truffle
- **Ethereum Client:** Ganache (for local development)
- **Frontend:** React (in `client/` directory - code not included here)
- **Libraries:** OpenZeppelin Contracts (for ReentrancyGuard)[cite: 2], Ethers.js (for frontend interaction)

## Setup and Installation

1.  **Prerequisites:**
    * Node.js (v16 or later recommended)
    * npm or yarn
    * Ganache (GUI or CLI) for a local blockchain instance.
    * MetaMask browser extension.

2.  **Clone the Repository:**
    ```bash
    git clone <your-repo-url>
    cd decentralized-rental
    ```

3.  **Install Root Dependencies:**
    ```bash
    npm install
    ```

4.  **Install Client Dependencies:**
    ```bash
    cd client
    npm install
    cd ..
    ```

5.  **Environment Variables:**
    * Rename `.env.example` to `.env`.
    * If needed for specific test accounts or testnet deployment, add your Ganache mnemonic or private keys/Infura ID to `.env`. **DO NOT commit your actual `.env` file.**

6.  **Start Ganache:** Launch your Ganache instance. Ensure it's running on `http://127.0.0.1:7545` (or update `truffle-config.js` if different).

7.  **Compile Contracts:**
    ```bash
    npm run compile
    # or
    truffle compile
    ```

8.  **Migrate Contracts:** Deploy the contracts to your running Ganache instance.
    ```bash
    npm run migrate
    # or to force redeployment
    npm run migrate:reset
    ```

9.  **Copy ABI to Frontend:** After successful migration, copy the generated ABI file to the client directory:
    ```bash
    cp build/contracts/RentalPlatform.json client/src/artifacts/
    ```
    *(You might want to automate this step in your build process later)*

## Running Tests

To ensure the smart contract logic is correct, run the test suite:

```bash
npm run test
# or
truffle test
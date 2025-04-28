# Decentralized Rental Platform (DApp)

## Project Overview

This project implements a trustless, decentralized rental platform built on the Ethereum blockchain using Solidity smart contracts and a React frontend. It allows users (owners) to list items for rent (like books, equipment, etc.) and other users (renters) to borrow these items by paying a security deposit and daily rental fees.

The platform leverages smart contracts to automate crucial aspects of the rental process, including holding deposits, calculating rental duration and fees, handling late penalties based on the deposit coverage, and distributing funds securely upon item return[cite: 1]. To maintain efficiency and keep blockchain transaction costs low, larger item details like images and full descriptions are stored off-chain using IPFS (InterPlanetary File System), with only a link (IPFS CID) stored on-chain[cite: 19, 26].

## Features

* **Owner Item Listing:** Owners can list items with a title, description, contact email, image (uploaded to IPFS), daily rental price (in ETH), and a security deposit (in ETH)[cite: 1].
* **Off-Chain Metadata:** Images, detailed descriptions, and contact emails are stored on IPFS, linked via a CID in the smart contract[cite: 19].
* **Renter Item Browsing:** Users can browse currently listed items in a marketplace view, seeing details fetched from both the blockchain and IPFS.
* **Item Renting:** Renters can rent available items by paying the required deposit plus the first day's rental fee via a blockchain transaction[cite: 10].
* **Automated Returns & Payouts:** Renters can return items via a transaction. The smart contract automatically calculates:
    * Total rental duration (minimum 1 day).
    * Days covered by the initial deposit (`deposit / dailyPrice`).
    * Applicable late fees (10% of deposit per day *after* the deposit-covered grace period ends).
    * The final payment due to the owner (rental fees + late fees, capped at the deposit amount).
    * The deposit refund due back to the renter.
    * Securely transfers the calculated amounts to the owner and renter[cite: 11, 24].
* **Security:**
    * Reentrancy protection using OpenZeppelin's `ReentrancyGuard`[cite: 2].
    * Access control ensures only the current renter can return an item.
    * Access control allows only the owner to delist their item (if not currently rented).
* **Wallet Integration:** Connects to user's Ethereum wallet (MetaMask) for transactions[cite: 16].
* **Frontend:** Responsive user interface built with React and styled with React Bootstrap.

## Tech Stack

* **Blockchain:** Ethereum (Local development via Ganache)
* **Smart Contracts:** Solidity ^0.8.20
* **Development Framework:** Truffle Suite
* **Off-Chain Storage:** IPFS (using Pinata gateway for uploads/retrieval)
* **Frontend:** React, Ethers.js (v5), React Router DOM, React Bootstrap, react-router-bootstrap
* **Libraries:** OpenZeppelin Contracts (`ReentrancyGuard`)
* **Package Manager:** npm

## Prerequisites

Before you begin, ensure you have the following installed:

1.  **Node.js:** **v20.x (LTS Recommended)**. Avoid newer versions like v22 for better compatibility with Truffle v5.x. You can use [nvm](https://github.com/nvm-sh/nvm) or [nvm-windows](https://github.com/coreybutler/nvm-windows) to manage Node versions.
2.  **npm:** (Usually comes with Node.js) or **yarn**.
3.  **Truffle:** Install globally (`npm install -g truffle` or `yarn global add truffle`).
4.  **Ganache:** A local blockchain for development. Download the UI from [Truffle Suite website](https://trufflesuite.com/ganache/) or install the CLI (`npm install -g ganache`).
5.  **MetaMask:** Browser extension wallet ([https://metamask.io/](https://metamask.io/)).
6.  **Git:** Version control system.
7.  **Pinata Account:** Free account needed for IPFS uploads ([https://pinata.cloud](https://pinata.cloud)). You will need to create an **API Key** and get the **JWT** credential.

## Setup and Installation

1.  **Clone Repository:**
    ```bash
    git clone <your-repository-url>
    cd <repository-folder-name> # e.g., cd dapp
    ```

2.  **Install Root Dependencies:** Install Truffle, OpenZeppelin, etc.
    ```bash
    npm install
    ```

3.  **Install Frontend Dependencies:**
    ```bash
    cd client
    npm install
    # Ensure react-router-bootstrap is installed if Navigation links were updated
    npm install react-router-bootstrap
    cd ..
    ```

4.  **Configure Environment Variables:**
    * **Pinata JWT:** Open `client/src/components/ListItemForm.js`. Find the `PINATA_JWT` constant and replace the placeholder `'YOUR_PINATA_JWT_KEY'` with your actual JWT obtained from your Pinata account's API Key section.
        ```javascript
        const PINATA_JWT = 'PASTE_YOUR_PINATA_JWT_HERE';
        ```
        **⚠️ Security Warning:** Do not commit your actual Pinata JWT to a public Git repository. For production, use environment variables and ideally a backend proxy for uploads.
    * **(Optional) `.env`:** If needed for specific Ganache accounts or future testnet deployment, rename `.env.example` to `.env` and add your mnemonic or private keys. Ensure `.env` is listed in your root `.gitignore` file (it should be already).

5.  **Start Ganache:** Launch your Ganache GUI application or run `ganache` in a separate terminal. Note the network details (usually RPC Server: `HTTP://127.0.0.1:7545`, Network ID: `1337` or `5777`).

6.  **Compile Smart Contracts:** Generate the contract artifacts.
    ```bash
    npm run compile
    # or
    truffle compile
    ```
    This creates the `build/contracts/` directory.

7.  **Migrate Smart Contracts:** Deploy the contracts to your running Ganache instance. Use `--reset` to ensure a fresh deployment.
    ```bash
    npm run migrate:reset
    # or
    truffle migrate --reset
    ```
    **Note:** Take note of the deployed `RentalPlatform` contract address shown in the output.

8.  **Update Frontend Configuration:**
    * **Copy Artifact:** Copy the generated ABI file from the backend build output to the frontend's artifact directory:
        ```bash
        # Run from the project root directory (e.g., 'dapp')
        cp build/contracts/RentalPlatform.json client/src/artifacts/
        ```
        (Use `copy` instead of `cp` on Windows Command Prompt if needed).
    * **Update Contract Address:** Open `client/src/contexts/Web3Context.js`. Find the `CONTRACT_ADDRESS` constant and replace the placeholder value with the actual `RentalPlatform` address you noted from the migration output.
        ```javascript
        const CONTRACT_ADDRESS = "YOUR_DEPLOYED_CONTRACT_ADDRESS_FROM_MIGRATION";
        ```
    * **IMPORTANT:** You **must** repeat Step 8 (copy artifact & update address) every time you run `truffle migrate --reset` or make significant changes to your smart contract that alter its ABI.

## Running the Application

1.  **Ensure Ganache is running.**
2.  **Start the React Frontend:**
    ```bash
    cd client
    npm start
    ```
    This will usually open the application automatically in your default browser at `http://localhost:3000`.
3.  **Configure MetaMask:**
    * Open the MetaMask browser extension.
    * Ensure it's connected to your local Ganache network (e.g., add a custom RPC network pointing to `http://127.0.0.1:7545` with the correct Chain ID, often `1337` or `5777`).
    * Import at least one or two accounts from Ganache into MetaMask using their private keys. Ganache displays these when you start it. You'll need ETH in these accounts to pay for gas and rental deposits.
    * Connect MetaMask to the DApp when prompted or by clicking the "Connect Wallet" button.

## Running Tests

To verify the smart contract logic, run the Truffle tests:

```bash
# Run from the project root directory (e.g., 'dapp')
npm run test
# or
truffle test

import React, { useState, useEffect, createContext, useCallback } from 'react';
import { ethers } from 'ethers';
import RentalPlatformArtifact from '../artifacts/RentalPlatform.json';

const CONTRACT_ADDRESS = "0x7581eeA1494312c0bBD98bEEE1B0c8f036c1d7c5"

export const Web3Context = createContext();

export const Web3Provider = ({ children }) => {
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [account, setAccount] = useState(null);
  const [contract, setContract] = useState(null);
  const [network, setNetwork] = useState(null);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const connectWallet = useCallback(async () => {
    setError(null);
    setIsLoading(true);
    if (window.ethereum) {
      try {

        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        if (accounts.length === 0) {
          throw new Error("No accounts found. Please unlock MetaMask.");
        }

        const web3Provider = new ethers.providers.Web3Provider(window.ethereum);
        const web3Signer = web3Provider.getSigner();
        const currentAccount = accounts[0];
        const networkInfo = await web3Provider.getNetwork();

        setProvider(web3Provider);
        setSigner(web3Signer);
        setAccount(currentAccount);
        setNetwork(networkInfo);

        const rentalContract = new ethers.Contract(
          CONTRACT_ADDRESS,
          RentalPlatformArtifact.abi,
          web3Signer
        );
        setContract(rentalContract);

        console.log("Wallet Connected:", currentAccount);
        console.log("Network:", networkInfo);
        console.log("Contract Initialized:", rentalContract.address);

      } catch (err) {
        console.error("Error connecting wallet:", err);
        setError(err.message || "Failed to connect wallet. Is MetaMask installed and unlocked?");
        setAccount(null);
        setSigner(null);
        setProvider(null);
        setContract(null);
        setNetwork(null);
      } finally {
          setIsLoading(false);
      }
    } else {
      setError("MetaMask not detected. Please install MetaMask!");
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (window.ethereum) {
      const handleAccountsChanged = (accounts) => {
        console.log("Account changed:", accounts);
        if (accounts.length > 0) {
          connectWallet();
        } else {
          setAccount(null);
          setSigner(null);
          setContract(null);
          setError("Please connect MetaMask.");
        }
      };

      const handleChainChanged = (_chainId) => {
        console.log("Network changed:", _chainId);
         window.location.reload();
      };

      window.ethereum.on('accountsChanged', handleAccountsChanged);
      window.ethereum.on('chainChanged', handleChainChanged);

      return () => {
        if (window.ethereum.removeListener) {
             window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
             window.ethereum.removeListener('chainChanged', handleChainChanged);
        }
      };
    }
  }, [connectWallet]);

  return (
    <Web3Context.Provider value={{ provider, signer, account, contract, network, isLoading, error, connectWallet, setError, setIsLoading }}>
      {children}
    </Web3Context.Provider>
  );
};
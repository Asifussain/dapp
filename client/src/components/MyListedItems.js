import React, { useState, useEffect, useContext, useCallback } from 'react';
import { ethers } from 'ethers'; 
import { Web3Context } from '../contexts/Web3Context';
import './MyListedItems.css';

function MyListedItems({ notify }) {
  const { contract, account, provider } = useContext(Web3Context);
  const [ownedItems, setOwnedItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const zeroAddress = "0x0000000000000000000000000000000000000000";

  const fetchMyListedItems = useCallback(async () => {
    const readContract = contract || (provider && contract?.address && new ethers.Contract(contract.address, contract.interface, provider));
    if (!readContract || !account) {
      if (!account) setError("Please connect your wallet to view your listed items.");
      return;
    }
    setLoading(true);
    setError('');
    try {
      const totalItemCount = await readContract.totalItems();
      if (totalItemCount.toNumber() === 0) {
        setOwnedItems([]);
        setLoading(false);
        return;
      }
      const myItems = [];
      
      for (let i = totalItemCount.toNumber(); i >= 1; i--) {
        try {
          
          const item = await readContract.getItem(i);
          if (item.exists && item.owner.toLowerCase() === account.toLowerCase()) {
            myItems.push({
              id: item.id.toNumber(),
              title: item.title,
              isListed: item.isListed,
              renter: item.renter
            });
          }
        } catch (itemError) {
          console.warn(`Could not fetch item ID ${i} for ownership check:`, itemError);
        }
      }
      setOwnedItems(myItems);
    } catch (err) {
      console.error("Error fetching owned items:", err);
      setError("Could not fetch your listed items.");
      notify(`Error fetching listings: ${err.message || 'Unknown error'}`, 'danger');
    } finally {
      setLoading(false);
    }
  }, [contract, account, provider, notify]);

  useEffect(() => {
    if (account && contract) { fetchMyListedItems(); }
    else { setOwnedItems([]); }
  }, [account, contract, fetchMyListedItems]);

  
  if (!account) { 
    return (
      <div className="listed-items-container">
        <div className="connection-alert">
          <span className="alert-icon">!</span>
          <span>Please connect your wallet.</span>
        </div>
      </div>
    );
  }
  
  if (loading) { 
    return (
      <div className="listed-items-container">
        <div className="loading-container">
          <div className="loader"></div>
          <p>Loading listings...</p>
        </div>
      </div>
    );
  }
  
  if (error) { 
    return (
      <div className="listed-items-container">
        <div className="error-alert">
          <span className="alert-icon">×</span>
          <span>{error}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="listed-items-container">
      <div className="listed-items-header">
        <h2>My Listed Items</h2>
        <div className="header-accent"></div>
      </div>
      
      {ownedItems.length > 0 ? (
        <ul className="items-list">
          {ownedItems.map((item) => (
            <li key={item.id} className="item-card">
              <div className="item-content">
                <h3 className="item-title">{item.title}</h3>
                <div className="item-badges">
                  <span className={`status-badge ${item.isListed ? 'listed' : 'delisted'}`}>
                    {item.isListed ? 'Listed' : 'Delisted'}
                  </span>
                  {item.renter !== zeroAddress && (
                    <span className="status-badge rented">Rented Out</span>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="info-message">
          <span className="info-icon">i</span>
          <span>You have not listed any items.</span>
        </div>
      )}
    </div>
  );
}

export default MyListedItems;
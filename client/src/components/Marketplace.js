import React, { useState, useEffect, useContext, useCallback } from 'react';
import { ethers } from 'ethers';
import { Web3Context } from '../contexts/Web3Context';
import ItemCard from './ItemCard';
import './Marketplace.css';

function Marketplace({ notify }) {
  const { contract, account, provider } = useContext(Web3Context);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchItems = useCallback(async () => {
      const readContract = contract || (provider && contract?.address && new ethers.Contract(contract.address, contract.interface, provider));

      if (!readContract) {
        if (!account) setError("Please connect your wallet to view the marketplace.");
        else setError("Contract not loaded correctly. Ensure you are on the right network.");
        return;
      }

      setLoading(true);
      setError('');
      try {
          const totalItemCount = await readContract.totalItems();
          if (totalItemCount.toNumber() === 0) {
              setItems([]);
              setLoading(false);
              return;
          }

          const fetchedItems = [];
          // Get IDs of listed items first
          const listedItemIds = await readContract.getListedItemIds(0, 100); // Fetch first 100 listed IDs

          // Fetch full details for each listed ID using getItem()
          for (const idBN of listedItemIds) {
              const itemId = idBN.toNumber();
              if (itemId === 0) continue; // Skip potential zero ID if returned

              try {
                  const item = await readContract.getItem(itemId);

                  // We already know it's listed from getListedItemIds, but check exists
                  if (item.exists) {
                      console.log(`Marketplace: Fetched Item ${itemId} via getItem()`, item);
                      fetchedItems.push({
                          id: item.id.toNumber(),
                          title: item.title,
                          owner: item.owner,
                          dailyRentalPrice: item.dailyRentalPrice,
                          deposit: item.deposit,
                          metadataCID: item.metadataCID,
                          isListed: item.isListed,
                          renter: item.renter
                      });
                  }
              } catch (itemError) {
                  console.warn(`Could not fetch full details for item ID ${itemId} via getItem():`, itemError);
              }
          }

          setItems(fetchedItems);
      } catch (err) {
          console.error("Error fetching items:", err);
          setError("Could not fetch items from the contract. Please ensure you are connected to the correct network and the contract is deployed.");
          notify(`Error fetching items: ${err.message || 'Unknown error'}`, 'danger');
      } finally {
          setLoading(false);
      }
  }, [contract, provider, account, notify]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  if (loading) {
    return (
      <div className="marketplace-container">
        <div className="loading-container">
          <div className="cyber-spinner">
            <div className="spinner-inner"></div>
          </div>
          <p className="loading-text">Loading blockchain data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="marketplace-container">
        <div className="error-message">
          <div className="error-icon">!</div>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="marketplace-container">
      <div className="marketplace-header">
        <h2 className="marketplace-title">Book Rental Library</h2>
        <div className="marketplace-subtitle">Browse available books for rent </div>
      </div>
      
      {items.length > 0 ? (
        <div className="items-grid">
          {items.map((item) => (
            <div key={item.id} className="item-column">
              <ItemCard item={item} notify={notify} onRental={fetchItems} />
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-marketplace">
          <div className="empty-icon">◇</div>
          <p>No items currently listed for rent on the blockchain</p>
          {account && (
            <p className="empty-suggestion">Be the first to list an item for rent!</p>
          )}
        </div>
      )}
    </div>
  );
}

export default Marketplace;
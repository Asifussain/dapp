import React, { useState, useEffect, useContext, useCallback } from 'react';
import { ethers } from 'ethers';
import { Web3Context } from '../contexts/Web3Context';
import './MyRentals.css';

function MyRentals({ notify }) {
  const { contract, account, provider, signer } = useContext(Web3Context);
  const [rentedItems, setRentedItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [processingReturn, setProcessingReturn] = useState(null); // Track which item ID is being returned

  const fetchMyRentedItems = useCallback(async () => {
    const readContract = contract || (provider && contract?.address && new ethers.Contract(contract.address, contract.interface, provider));

    if (!readContract || !account) {
      if (!account) setError("Please connect your wallet to view your rentals.");
      return;
    }

    setLoading(true);
    setError('');
    try {
      const totalItemCount = await readContract.totalItems();
      if (totalItemCount.toNumber() === 0) {
        setRentedItems([]);
        setLoading(false);
        return;
      }

      const myItems = [];
      // Inefficient: Iterate through all items and filter by renter
      // TODO: Add contract event indexing or dedicated functions for better performance
      for (let i = 1; i <= totalItemCount.toNumber(); i++) {
        try {
          const item = await readContract.items(i);
          if (item.exists && item.renter.toLowerCase() === account.toLowerCase()) {
            // Calculate remaining time (approximate)
            const now = Math.floor(Date.now() / 1000);
            const rentedUntilTimestamp = item.rentedUntil.toNumber();
            const isOverdue = now > rentedUntilTimestamp;

            myItems.push({
              id: item.id.toNumber(),
              title: item.title,
              owner: item.owner,
              dailyRentalPrice: item.dailyRentalPrice,
              deposit: item.deposit,
              rentedUntil: rentedUntilTimestamp,
              isOverdue: isOverdue
            });
          }
        } catch (itemError) {
          console.warn(`Could not fetch item ID ${i} for rental check:`, itemError);
        }
      }
      setRentedItems(myItems);
    } catch (err) {
      console.error("Error fetching rented items:", err);
      setError("Could not fetch your rented items.");
      notify(`Error fetching rentals: ${err.message || 'Unknown error'}`, 'danger');
    } finally {
      setLoading(false);
    }
  }, [contract, account, provider, notify]); // Dependencies

  useEffect(() => {
    if (account && contract) { // Fetch only if connected and contract is ready
      fetchMyRentedItems();
    } else {
      setRentedItems([]); // Clear items if disconnected
    }
  }, [account, contract, fetchMyRentedItems]); // Rerun if account or contract changes

  const handleReturn = async (itemId, itemTitle) => {
    if (!contract || !signer || !account) {
      notify("Please connect your wallet first.", "warning");
      return;
    }

    setProcessingReturn(itemId); // Set loading state for this specific item
    notify(`Preparing return transaction for "${itemTitle}"...`, "info");

    try {
      console.log(`Returning item ${itemId}`);
      const tx = await contract.connect(signer).returnItem(itemId);

      notify("Return transaction sent, waiting for confirmation...", "info", 15000);
      await tx.wait();

      notify(`Successfully returned "${itemTitle}"!`, 'success');
      fetchMyRentedItems(); // Refresh the list

    } catch(err) {
      console.error(`Return failed for item ${itemId}:`, err);
      let errorMessage = "Failed to return item.";
      if (err.reason) {
        errorMessage = `Return failed: ${err.reason}`;
      } else if (err.code === 4001) {
        errorMessage = "Transaction rejected by user.";
      } else if (err.message) {
        if (err.message.includes("Only the current renter")) {
          errorMessage = "Return failed: You are not the current renter.";
        } else {
          errorMessage = `Return failed: ${err.message.substring(0,100)}...`;
        }
      }
      notify(errorMessage, 'danger');
    } finally {
      setProcessingReturn(null); // Clear loading state for this item
    }
  };

  const formatEth = (weiValue) => {
    if (!weiValue) return '0';
    return ethers.utils.formatEther(weiValue);
  }

  const formatTimestamp = (timestamp) => {
    if (!timestamp || timestamp === 0) return 'N/A';
    return new Date(timestamp * 1000).toLocaleString(); // Convert seconds to ms
  }

  if (!account) {
    return <div className="alert warning">Please connect your wallet to see your rentals.</div>;
  }

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner-cube"></div>
        <p>Loading your rented items...</p>
      </div>
    );
  }

  if (error) {
    return <div className="alert danger">{error}</div>;
  }

  return (
    <div className="rentals-container">
      <div className="rentals-header">
        <h2>My Rented Items</h2>
        <div className="header-accent"></div>
      </div>

      <div className="rentals-grid">
        {rentedItems.length > 0 ? (
          rentedItems.map((item) => (
            <div key={item.id} className="rental-card">
              <div className="rental-card-header">
                <h3>{item.title}</h3>
                {item.isOverdue && <span className="status-badge overdue">Overdue</span>}
              </div>
              <div className="rental-card-body">
                <div className="rental-details">
                  <div className="rental-detail">
                    <span className="detail-label">Deposit</span>
                    <span className="detail-value">{formatEth(item.deposit)} ETH</span>
                  </div>
                  <div className="rental-detail">
                    <span className="detail-label">Due By</span>
                    <span className="detail-value">{formatTimestamp(item.rentedUntil)}</span>
                  </div>
                </div>
                <button
                  className={`action-button return ${processingReturn === item.id ? 'processing' : ''}`}
                  onClick={() => handleReturn(item.id, item.title)}
                  disabled={processingReturn === item.id}
                >
                  {processingReturn === item.id ? (
                    <>
                      <span className="button-spinner"></span>
                      <span>Returning...</span>
                    </>
                  ) : (
                    'Return Item'
                  )}
                </button>
              </div>
              <div className="card-glow"></div>
            </div>
          ))
        ) : (
          <div className="alert info">You have not rented any items.</div>
        )}
      </div>
    </div>
  );
}

export default MyRentals;
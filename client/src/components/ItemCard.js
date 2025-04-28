import React, { useState, useEffect, useContext } from 'react';
import { ethers } from 'ethers';
import { Web3Context } from '../contexts/Web3Context';
import './ItemCard.css';

// Helper to convert CID or ipfs:// uri to gateway URL
const resolveIPFSUrl = (ipfsUriOrCid) => {
    if (!ipfsUriOrCid) return null;
    const cid = ipfsUriOrCid.startsWith('ipfs://')
        ? ipfsUriOrCid.substring(7)
        : ipfsUriOrCid;
    // Use your preferred gateway
    return `https://gateway.pinata.cloud/ipfs/${cid}`; // Example using Pinata
};

function ItemCard({ item, notify, onRental }) {
    // Ensure item has default values if props are not fully loaded initially
    const safeItem = item || {};
    const { contract, account, signer } = useContext(Web3Context);
    const [isProcessingRent, setIsProcessingRent] = useState(false);
    const [metadata, setMetadata] = useState(null);
    const [imageUrl, setImageUrl] = useState(null);
    const [loadingMeta, setLoadingMeta] = useState(true);
    const [metaError, setMetaError] = useState('');

    // Fetch metadata from IPFS
    useEffect(() => {
        let isMounted = true;
        setLoadingMeta(true);
        setImageUrl(null);
        setMetadata(null);
        setMetaError('');
        console.log(`ItemCard Effect: item ID ${safeItem?.id}, CID received: ${safeItem?.metadataCID}`);

        const fetchMetadata = async () => {
            // Check if the CID exists and is a non-empty string BEFORE trying to fetch
            if (!safeItem?.metadataCID || typeof safeItem.metadataCID !== 'string' || safeItem.metadataCID.trim() === '') {
                console.warn(`No valid metadataCID for item ${safeItem?.id}. Value:`, safeItem?.metadataCID);
                if(isMounted) setLoadingMeta(false);
                return;
            }
            try {
                const metaUrl = resolveIPFSUrl(safeItem.metadataCID);
                if (!metaUrl) throw new Error("Invalid metadata CID could not be resolved.");

                console.log(`Fetching metadata for item ${safeItem.id} from: ${metaUrl}`);
                const response = await fetch(metaUrl, { signal: AbortSignal.timeout(15000) });
                if (!response.ok) {
                    throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
                }
                const data = await response.json();
                console.log(`Fetched Metadata for item ${safeItem.id}:`, data);

                if (isMounted) {
                    setMetadata(data); // Store the whole metadata object
                    if (data?.image) {
                        const resolvedUrl = resolveIPFSUrl(data.image);
                        setImageUrl(resolvedUrl);
                        console.log(`Resolved image URL for item ${safeItem.id}: ${resolvedUrl}`);
                    } else {
                        console.warn(`Metadata for item ${safeItem.id} missing 'image' field.`);
                    }
                }
            } catch (err) {
                console.error(`Failed to fetch/process metadata for item ${safeItem.id} (CID: ${safeItem.metadataCID}):`, err);
                if (isMounted) {
                    setMetaError(`Could not load details.`); // Simplified error
                }
            } finally {
                if (isMounted) {
                    setLoadingMeta(false);
                }
            }
        };

        fetchMetadata();

        // Cleanup function
        return () => { isMounted = false; };
    }, [safeItem?.id, safeItem?.metadataCID]);

    const handleRent = async () => {
        // Ensure item data is loaded before allowing rent
        if (!safeItem || !safeItem.deposit || !safeItem.dailyRentalPrice) {
            notify("Item data not fully loaded.", "warning");
            return;
        }
        if (!contract || !signer || !account) { 
            notify("Please connect your wallet first.", "warning"); 
            return; 
        }
        if (safeItem.owner?.toLowerCase() === account?.toLowerCase()) { 
            notify("You cannot rent your own item.", "warning"); 
            return; 
        }
        // Add check for item listing status from prop
        if (!safeItem.isListed) {
            notify("This item is not currently available for rent.", "warning");
            return;
        }

        setIsProcessingRent(true);
        notify("Preparing rental transaction...", "info", 5000);
        try {
            // Use safeItem for calculations
            const requiredPaymentWei = safeItem.deposit.add(safeItem.dailyRentalPrice);
            console.log(`Attempting to rent item ${safeItem.id} for ${requiredPaymentWei.toString()} Wei`);
            const tx = await contract.connect(signer).rentItem(safeItem.id, { value: requiredPaymentWei });
            notify("Rental transaction sent, waiting for confirmation...", "info", 15000);
            await tx.wait();
            console.log("Rental Transaction confirmed:", tx.hash);
            notify(`Successfully rented "${metadata?.title || safeItem.title}"!`, 'success');
            if(onRental) onRental(); // Callback to refresh marketplace list
        } catch (error) {
            console.error(`Rental failed for item ${safeItem.id}:`, error);
            let errorMessage = "Rental failed.";
            // Extract specific revert reasons or error codes
            if (error.reason) { errorMessage = `Rental failed: ${error.reason}`; }
            else if (error.data?.message) { errorMessage = `Rental failed: ${error.data.message}`; }
            else if (error.code === 4001) { errorMessage = "Transaction rejected by user."; }
            else if (error.message) {
                if (error.message.includes("insufficient funds")) { errorMessage = "Rental failed: Insufficient funds."; }
                else if (error.message.includes("Item is not listed")) { errorMessage = "Rental failed: Item is no longer listed."; }
                else { errorMessage = `Rental failed: Please check console.`; }
            }
            notify(errorMessage, 'danger', 5000);
        } finally {
            setIsProcessingRent(false);
        }
    };

    const formatEth = (weiValue) => {
        if (!weiValue) return '0';
        try { return ethers.utils.formatEther(weiValue); }
        catch (e) { console.error("Error formatting ETH:", weiValue, e); return 'N/A'; }
    }

    // --- Render Logic ---
    const displayTitle = metadata?.title || safeItem?.title || 'Loading Title...';
    const descriptionContent = loadingMeta ? 'Loading details...' : metaError ? `Error: ${metaError}` : metadata?.description || '';
    const isOwner = account && safeItem?.owner?.toLowerCase() === account?.toLowerCase();
    const canRent = !isOwner && safeItem?.isListed;
    
    // Determine button class based on state
    let buttonClass = "item-card-btn";
    if (isOwner) buttonClass += " item-card-btn-owner";
    if (!safeItem?.isListed && !isOwner) buttonClass += " item-card-btn-rented";

    return (
        <div className="item-card">
            {/* Image Section */}
            {loadingMeta && !imageUrl ? (
                <div className="item-card-img-placeholder">Loading image...</div>
            ) : imageUrl ? (
                <img
                    className="item-card-img"
                    src={imageUrl}
                    alt={displayTitle}
                    onError={(e) => { 
                        e.target.onerror = null; 
                        e.target.src="/logo192.png"; 
                        setImageUrl(null);
                    }}
                />
            ) : (
                <div className="item-card-img-placeholder">
                    {metaError || 'No Image Available'}
                </div>
            )}

            {/* Content Section */}
            <div className="item-card-body">
                <h3 className="item-card-title">{displayTitle}</h3>
                
                <div className="item-card-text">
                    {descriptionContent && <p>{descriptionContent}</p>}
                </div>
                
                <hr className="item-card-divider" />
                
                <div className="item-card-details">
                    <div className="item-card-details-item">
                        <span className="item-card-details-label">Owner:</span>
                        <span className="item-card-details-value">
                            {safeItem?.owner 
                                ? `${safeItem.owner.substring(0, 6)}...${safeItem.owner.substring(safeItem.owner.length - 4)}` 
                                : 'N/A'}
                        </span>
                    </div>
                    
                    <div className="item-card-details-item">
                        <span className="item-card-details-label">Deposit:</span>
                        <span className="item-card-details-value">{formatEth(safeItem?.deposit)} ETH</span>
                    </div>
                    
                    <div className="item-card-details-item">
                        <span className="item-card-details-label">Daily Price:</span>
                        <span className="item-card-details-value">{formatEth(safeItem?.dailyRentalPrice)} ETH/day</span>
                    </div>
                </div>
                
                {/* Contact Email - Now right-aligned */}
                {!loadingMeta && !metaError && metadata?.contactEmail && (
                    <div className="item-card-email">
                        Contact: <a href={`mailto:${metadata.contactEmail}`}>{metadata.contactEmail}</a>
                    </div>
                )}
                
                <button
                    className={buttonClass}
                    onClick={handleRent}
                    disabled={isProcessingRent || !canRent}
                >
                    {isProcessingRent ? (
                        <><span className="item-card-spinner"></span>Processing...</>
                    ) : isOwner ? (
                        "Your Item"
                    ) : !safeItem?.isListed ? (
                        "Already Rented"
                    ) : (
                        "Rent Item"
                    )}
                </button>
            </div>
        </div>
    );
}

export default ItemCard;
import React, { useState, useContext } from 'react';
import { ethers } from 'ethers';
import { Web3Context } from '../contexts/Web3Context';
import './ListItemForm.css'; // Import your new CSS file

// --- IMPORTANT: Replace with your Pinata JWT ---
const PINATA_JWT = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySW5mb3JtYXRpb24iOnsiaWQiOiI5Y2VhMmY5My05MmRhLTRlYzItYjA3Yy03MGQ1YmE5N2FmYjQiLCJlbWFpbCI6Imhtc2lpdGluZG9yZUBnbWFpbC5jb20iLCJlbWFpbF92ZXJpZmllZCI6dHJ1ZSwicGluX3BvbGljeSI6eyJyZWdpb25zIjpbeyJkZXNpcmVkUmVwbGljYXRpb25Db3VudCI6MSwiaWQiOiJGUkExIn0seyJkZXNpcmVkUmVwbGljYXRpb25Db3VudCI6MSwiaWQiOiJOWUMxIn1dLCJ2ZXJzaW9uIjoxfSwibWZhX2VuYWJsZWQiOmZhbHNlLCJzdGF0dXMiOiJBQ1RJVkUifSwiYXV0aGVudGljYXRpb25UeXBlIjoic2NvcGVkS2V5Iiwic2NvcGVkS2V5S2V5IjoiYzhhOWExNTEyOGMzN2ZmNjRjYzMiLCJzY29wZWRLZXlTZWNyZXQiOiJmODkxODg2YzhlMWYyZWEzMzNiYjYxMjZkNWY4ZjhhODI2MDJhNjBkOGU5MGEzOTdiODQwNTk1NzQxZDdhMjNlIiwiZXhwIjoxNzc3MTIxMTA1fQ.DRPmjcZG_x04_GelJ3EPLoFGS5c9DE6lqnvuNu3AOQY';

function ListItemForm({ notify }) {
  const { contract, account, signer } = useContext(Web3Context);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [email, setEmail] = useState(''); 
  const [dailyPrice, setDailyPrice] = useState('');
  const [deposit, setDeposit] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');
  const [validated, setValidated] = useState(false);
  const [fileName, setFileName] = useState('');

  const handleFileChange = (event) => {
      if (event.target.files && event.target.files[0]) {
          const file = event.target.files[0];
          setSelectedFile(file);
          setFileName(file.name);
      }
  };

  // Function to upload file/data to Pinata (unchanged)
  const uploadToPinata = async (content, filename) => {
    // ... your existing uploadToPinata function
    setIsProcessing(true);
    notify(`Uploading ${filename} to IPFS via Pinata...`, "info");
    const formData = new FormData();
    if (content instanceof File) {
        formData.append('file', content, filename);
    } else if (typeof content === 'object') {
        const blob = new Blob([JSON.stringify(content)], { type: 'application/json' });
        formData.append('file', blob, filename);
    } else {
        throw new Error("Unsupported content type for Pinata upload");
    }
    const metadata = JSON.stringify({ name: filename });
    formData.append('pinataMetadata', metadata);
    const options = JSON.stringify({ cidVersion: 1 });
    formData.append('pinataOptions', options);
    try {
        const res = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
            method: 'POST',
            headers: { Authorization: `Bearer ${PINATA_JWT}` },
            body: formData
        });
        if (!res.ok) {
            const errorData = await res.text();
            throw new Error(`Pinata upload failed: ${res.status} ${res.statusText} - ${errorData}`);
        }
        const resData = await res.json();
        console.log(`Pinata upload response for ${filename}:`, resData);
        notify(`${filename} uploaded to IPFS!`, "success");
        return resData.IpfsHash;
    } catch (e) {
         console.error(`IPFS Upload Error for ${filename}:`, e);
         notify(`IPFS Upload for ${filename} failed: ${e.message}`, "danger");
         throw e;
    }
  };

  const handleSubmit = async (event) => {
    // ... your existing handleSubmit function
    event.preventDefault();
    event.stopPropagation();
    const form = event.currentTarget;
    
    // Form validation
    const isFormValid = title && dailyPrice && deposit && selectedFile;
    
    if (!isFormValid || !contract || !signer || !account) {
      setValidated(true);
      if(!account || !signer || !contract) setError("Please ensure your wallet is connected.");
      if(!selectedFile) setError("Please select an image file.");
      if(!title) setError("Please provide a title.");
      if(!dailyPrice) setError("Please provide a daily price.");
      if(!deposit) setError("Please provide a security deposit.");
      return;
    }
    
    setValidated(true);
    setError('');
    setIsProcessing(true);

    try {
      // 1. Upload Image file
      if (!selectedFile) throw new Error("Image file not selected.");
      const imageCID = await uploadToPinata(selectedFile, selectedFile.name);

      // 2. Create Metadata JSON Object (including email)
      const metadataJSON = {
          title: title,
          description: description,
          image: `ipfs://${imageCID}`,
          contactEmail: email
      };

      // 3. Upload Metadata JSON
      const metadataCID = await uploadToPinata(metadataJSON, "metadata.json");

      // 4. Convert ETH values to Wei
      const dailyPriceWei = ethers.utils.parseEther(dailyPrice);
      const depositWei = ethers.utils.parseEther(deposit);
      if (dailyPriceWei.lte(0) || depositWei.lte(0)) {
          throw new Error("Price and Deposit must be positive values.");
      }

      // 5. Call Smart Contract
      notify("Preparing list item transaction...", "info");
      const tx = await contract.connect(signer).listItem(
          title,
          dailyPriceWei,
          depositWei,
          metadataCID
       );

      notify("List item transaction sent, waiting for confirmation...", "info", 15000);
      await tx.wait();
      notify(`Successfully listed "${title}"!`, 'success');

      // Reset form
      setTitle('');
      setDescription('');
      setEmail('');
      setDailyPrice('');
      setDeposit('');
      setSelectedFile(null);
      setFileName('');
      if (form) form.reset();
      setValidated(false);

    } catch (err) {
      console.error("Listing item failed:", err);
      let errorMessage = err.message.includes('Pinata upload failed') ? err.message : err.message || "Failed to list item.";
      if (err.reason) { errorMessage = `Listing failed: ${err.reason}`; }
      else if (err.code === 4001) { errorMessage = "Transaction rejected by user."; }
      setError(errorMessage);
      notify(errorMessage, 'danger');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="list-item-card">
      <div className="list-item-header">
        <h4>List a New Item for Rent</h4>
      </div>
      <div className="list-item-body">
        {error && <div className="form-alert">{error}</div>}
        
        <form className="list-item-form" onSubmit={handleSubmit} noValidate>
          <div className="form-group required">
            <label className="form-label" htmlFor="itemTitle">Item Title</label>
            <input 
              id="itemTitle"
              className={`form-control ${validated && !title ? 'is-invalid' : ''}`}
              type="text" 
              placeholder="Enter title" 
              value={title} 
              onChange={(e) => setTitle(e.target.value)} 
              disabled={isProcessing}
              required 
            />
            <div className="form-feedback">Please provide a title.</div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="itemDescription">Description</label>
            <textarea 
              id="itemDescription"
              className="form-control" 
              rows="3" 
              placeholder="Detailed description of your item" 
              value={description} 
              onChange={(e) => setDescription(e.target.value)} 
              disabled={isProcessing}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="itemContactEmail">
              Contact Email
              <span className="tooltip" data-tooltip="This email will be stored off-chain for rental inquiries">ⓘ</span>
            </label>
            <input 
              id="itemContactEmail"
              className="form-control" 
              type="email"
              placeholder="Enter your email (will be stored off-chain)" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              disabled={isProcessing}
            />
          </div>

          <div className="form-section">
            <div className="form-group required price-field">
              <label className="form-label" htmlFor="itemDailyPrice">Daily Rental Price</label>
              <input 
                id="itemDailyPrice"
                className={`form-control ${validated && !dailyPrice ? 'is-invalid' : ''}`}
                type="number" 
                step="any" 
                min="0.000001" 
                placeholder="e.g., 0.01" 
                value={dailyPrice} 
                onChange={(e) => setDailyPrice(e.target.value)} 
                disabled={isProcessing}
                required 
              />
              <div className="form-feedback">Please provide a valid positive price.</div>
            </div>

            <div className="form-group required price-field">
              <label className="form-label" htmlFor="itemDeposit">Security Deposit</label>
              <input 
                id="itemDeposit"
                className={`form-control ${validated && !deposit ? 'is-invalid' : ''}`}
                type="number" 
                step="any" 
                min="0.000001" 
                placeholder="e.g., 0.1" 
                value={deposit} 
                onChange={(e) => setDeposit(e.target.value)} 
                disabled={isProcessing}
                required 
              />
              <div className="form-feedback">Please provide a valid positive deposit.</div>
            </div>
          </div>

          <div className="form-group required">
            <label className="form-label" htmlFor="formFile">Item Thumbnail Image</label>
            <input 
              id="formFile"
              className={`form-control ${validated && !selectedFile ? 'is-invalid' : ''}`}
              type="file" 
              accept="image/*" 
              onChange={handleFileChange} 
              disabled={isProcessing}
              required 
            />
            {fileName && (
              <div className="file-preview">
                <span className="file-preview-icon">◈</span>
                <span>{fileName}</span>
              </div>
            )}
            <div className="form-feedback">Please select an image file.</div>
          </div>

          <button 
            className="btn" 
            type="submit" 
            disabled={isProcessing || !account}
          >
            {isProcessing ? (
              <>
                <div className="spinner"></div> 
                Processing...
              </>
            ) : 'List Item'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default ListItemForm;
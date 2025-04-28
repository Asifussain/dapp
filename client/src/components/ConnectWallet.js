import React, { useContext } from 'react';
import Button from 'react-bootstrap/Button';
import Spinner from 'react-bootstrap/Spinner'; // For loading state
import { Web3Context } from '../contexts/Web3Context';
// import './ConnectWallet.css';

function ConnectWallet() {
  const { account, connectWallet, isLoading, error } = useContext(Web3Context);

  // Function to format address (e.g., 0x123...abc)
  const formatAddress = (addr) => {
    return addr ? `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}` : '';
  };

  return (
    <>
      {account ? (
        <Button variant="outline-success" disabled>
          Connected: {formatAddress(account)}
        </Button>
      ) : (
        <Button
          variant="primary"
          onClick={connectWallet}
          disabled={isLoading} // Disable button while loading
        >
          {isLoading ? (
            <>
              <Spinner
                as="span"
                animation="border"
                size="sm"
                role="status"
                aria-hidden="true"
              />
              <span className="visually-hidden">Loading...</span> Connecting...
            </>
          ) : (
            'Connect Wallet'
          )}
        </Button>
      )}
       {/* Display connection errors next to the button if they exist */}
       {error && !account && <span className="text-danger ms-2">{error}</span>}
    </>
  );
}

export default ConnectWallet;
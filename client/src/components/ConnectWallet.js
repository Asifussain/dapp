import React, { useContext } from 'react';
import Button from 'react-bootstrap/Button';
import Spinner from 'react-bootstrap/Spinner'; 
import { Web3Context } from '../contexts/Web3Context';


function ConnectWallet() {
  const { account, connectWallet, isLoading, error } = useContext(Web3Context);

  
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
          disabled={isLoading} 
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
       
       {error && !account && <span className="text-danger ms-2">{error}</span>}
    </>
  );
}

export default ConnectWallet;
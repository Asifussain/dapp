import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import Spinner from 'react-bootstrap/Spinner';
import OverlayTrigger from 'react-bootstrap/OverlayTrigger';
import Tooltip from 'react-bootstrap/Tooltip';

const fetchProfileData = async (address) => {
    console.log(`Placeholder: Fetching profile for ${address}...`);
    await new Promise(resolve => setTimeout(resolve, 500));

    if (address.toLowerCase() === "0x1129a2336773d7baa7af7833f0fe6438dfcfc503") { 
         return { displayName: "Alice (Owner Example)", contact: "alice@example.com (mock)" };
    } else if (address.toLowerCase() === "0x0e8e45f9ac59c3d7b0a69543b7478a8d5238c973") { 
         return { displayName: "Bob (Renter Example)" }; 
    } else {
         return null; 
    }
};

function UserProfileDisplay({ address }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError('');
    setProfile(null);

    if (!address || address === "0x0000000000000000000000000000000000000000") {
        setLoading(false);
        setError("Invalid address");
        return;
    }

    fetchProfileData(address)
      .then(data => {
        if (isMounted) {
          setProfile(data); 
        }
      })
      .catch(err => {
        console.error("Error fetching profile:", err);
        if (isMounted) {
          setError("Could not load profile");
        }
      })
      .finally(() => {
        if (isMounted) {
          setLoading(false);
        }
      });

    return () => { isMounted = false; };
  }, [address]); 

  const formatAddress = (addr) => `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;

  let displayContent;
  if (loading) {
    displayContent = <Spinner animation="border" size="sm" />;
  } else if (profile && profile.displayName) {
    displayContent = (
        <OverlayTrigger
            placement="top"
            overlay={<Tooltip id={`tooltip-${address}`}>Address: {address} {profile.contact ? `- Contact: ${profile.contact}` : ''}</Tooltip>}
         >
            <span>{profile.displayName}</span>
        </OverlayTrigger>
    );
  } else {
     displayContent = (
         <OverlayTrigger placement="top" overlay={<Tooltip id={`tooltip-${address}`}>{address}</Tooltip>}>
            <span>{formatAddress(address)}</span>
         </OverlayTrigger>
     );
  }

  return (
     <span className="user-profile-display ms-1">{displayContent}</span>
  );
}

UserProfileDisplay.propTypes = {
  address: PropTypes.string.isRequired,
};

export default UserProfileDisplay;
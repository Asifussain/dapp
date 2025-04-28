import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import Spinner from 'react-bootstrap/Spinner';
import OverlayTrigger from 'react-bootstrap/OverlayTrigger';
import Tooltip from 'react-bootstrap/Tooltip';

// Placeholder function - Replace with actual API call to your backend/service
const fetchProfileData = async (address) => {
    console.log(`Placeholder: Fetching profile for ${address}...`);
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 500));

    // --- Replace this with your actual API call ---
    // Example: const response = await fetch(`/api/profile/${address}`);
    // if (!response.ok) throw new Error("Profile not found");
    // const data = await response.json();
    // return data;

    // --- Mock Data for Demonstration ---
    // In a real app, return null or throw error if profile doesn't exist
    if (address.toLowerCase() === "0x1129a2336773d7baa7af7833f0fe6438dfcfc503") { // Example owner address from logs
         return { displayName: "Alice (Owner Example)", contact: "alice@example.com (mock)" };
    } else if (address.toLowerCase() === "0x0e8e45f9ac59c3d7b0a69543b7478a8d5238c973") { // Example renter address from logs
         return { displayName: "Bob (Renter Example)" }; // Example with no contact info
    } else {
         return null; // No profile found for other addresses
    }
    // ------------------------------------
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
          setProfile(data); // Can be null if not found
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
  }, [address]); // Re-fetch if address changes

  const formatAddress = (addr) => `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;

  // Display Logic
  let displayContent;
  if (loading) {
    displayContent = <Spinner animation="border" size="sm" />;
  } else if (profile && profile.displayName) {
    // Display name and optionally contact info in a tooltip
    displayContent = (
        <OverlayTrigger
            placement="top"
            overlay={<Tooltip id={`tooltip-${address}`}>Address: {address} {profile.contact ? `- Contact: ${profile.contact}` : ''}</Tooltip>}
         >
            <span>{profile.displayName}</span>
        </OverlayTrigger>
    );
  } else {
    // Default to formatted address if no profile or display name
     displayContent = (
         <OverlayTrigger placement="top" overlay={<Tooltip id={`tooltip-${address}`}>{address}</Tooltip>}>
            <span>{formatAddress(address)}</span>
         </OverlayTrigger>
     );
  }
  // Optionally display error: else if (error) { displayContent = <span className="text-danger">Error</span>; }


  return (
     // Render as an inline element or customize as needed
     <span className="user-profile-display ms-1">{displayContent}</span>
  );
}

UserProfileDisplay.propTypes = {
  address: PropTypes.string.isRequired,
};

export default UserProfileDisplay;
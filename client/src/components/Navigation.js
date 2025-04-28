import React, { useContext, useState } from 'react';
import { Link } from 'react-router-dom';
import ConnectWallet from './ConnectWallet';
import { Web3Context } from '../contexts/Web3Context';
import './Navigation.css';

function Navigation() {
  const { account } = useContext(Web3Context);
  const [isOpen, setIsOpen] = useState(false);

  const toggleMenu = () => {
    setIsOpen(!isOpen);
  };

  return (
    <header className="navbar">
      <div className="navbar-container">
        <div className="navbar-logo">
          <Link to="/" className="logo-link">
            <span className="logo-text">CHAIN</span>
            <span className="logo-accent">RENT</span>
            <div className="logo-cube"></div>
          </Link>
        </div>

        <div className="menu-toggle" onClick={toggleMenu}>
          <div className={`hamburger ${isOpen ? 'active' : ''}`}>
            <span></span>
            <span></span>
            <span></span>
          </div>
        </div>

        <nav className={`navbar-menu ${isOpen ? 'active' : ''}`}>
          <ul className="nav-links">
            <li className="nav-item">
              <Link to="/" className="nav-link">
                <span className="nav-icon">◈</span>
                <span className="nav-text">Library</span>
              </Link>
            </li>

            {account && (
              <>
                <li className="nav-item">
                  <Link to="/list-item" className="nav-link">
                    <span className="nav-icon">+</span>
                    <span className="nav-text">List Item</span>
                  </Link>
                </li>
                <li className="nav-item">
                  <Link to="/my-rentals" className="nav-link">
                    <span className="nav-icon">⟁</span>
                    <span className="nav-text">My Rentals</span>
                  </Link>
                </li>
                <li className="nav-item">
                  <Link to="/my-listed-items" className="nav-link">
                    <span className="nav-icon">⧉</span>
                    <span className="nav-text">My Listings</span>
                  </Link>
                </li>
              </>
            )}
          </ul>
          <div className="wallet-container">
            <ConnectWallet />
          </div>
        </nav>
      </div>
    </header>
  );
}

export default Navigation;
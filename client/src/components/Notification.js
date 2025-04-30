import React from 'react';
import './Notification.css';

function Notification({ message, type = 'info', show, onClose }) {

  React.useEffect(() => {
    if (show) {
      const timer = setTimeout(() => {
        onClose();
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [show, onClose]); 

  if (!show) {
    return null;
  }

  return (
    <div className="notification-container">
      <div className={`notification-toast ${type}`}>
        <div className="notification-header">
          <strong className="notification-title">{type}</strong>
          <button className="notification-close" onClick={onClose}>
            <span>×</span>
          </button>
        </div>
        <div className="notification-body">
          <div className="notification-message">{message}</div>
        </div>
        <div className="notification-progress"></div>
      </div>
    </div>
  );
}

export default Notification;
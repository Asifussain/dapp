import React from 'react';
import './Notification.css';

function Notification({ message, type = 'info', show, onClose }) {

  // Call the Hook unconditionally at the top level.
  React.useEffect(() => {
    // Put the conditional logic *inside* the effect.
    // Only set the timer if the notification should be shown.
    if (show) {
      const timer = setTimeout(() => {
        onClose();
      }, 3000);

      // The cleanup function is important! It will run:
      // 1. When the component unmounts.
      // 2. Before the effect runs again if dependencies ([show, onClose]) change.
      // This prevents memory leaks if the notification is closed early
      // or if the component re-renders while the timer is still active.
      return () => clearTimeout(timer);
    }
    // If show is false, the effect runs, but does nothing and sets up no timer.
  }, [show, onClose]); // Dependencies: Run effect when show or onClose changes.

  // Now the conditional return based on `show` is perfectly fine.
  // It happens *after* all Hooks have been called.
  if (!show) {
    return null;
  }

  // Render the notification JSX only when show is true.
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
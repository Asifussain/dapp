import { useState, useCallback } from 'react';

export const useNotifications = () => {
  const [notification, setNotification] = useState({ message: '', type: 'info', show: false });

  const showNotification = useCallback((message, type = 'info', duration = 3000) => {
    setNotification({ message, type, show: true });
    setTimeout(() => {
      setNotification((prev) => ({ ...prev, show: false }));
    }, duration);
  }, []);

  const hideNotification = useCallback(() => {
     setNotification((prev) => ({ ...prev, show: false }));
  }, []);

  return { notification, showNotification, hideNotification };
};
import React, { useContext } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Container from 'react-bootstrap/Container';
import Navigation from './components/Navigation';
import Marketplace from './components/Marketplace';
import ListItemForm from './components/ListItemForm';
import MyRentals from './components/MyRentals';
import MyListedItems from './components/MyListedItems'; 
import Notification from './components/Notification';
import { Web3Context } from './contexts/Web3Context';
import { useNotifications } from './hooks/useNotifications';

function App() {
  const { account } = useContext(Web3Context);
  const { notification, showNotification, hideNotification } = useNotifications();

  const notify = (message, type = 'info', duration = 3000) => {
    showNotification(message, type, duration);
  };

  return (
    <div className="App">
      <Navigation />
      <Notification
        message={notification.message}
        type={notification.type}
        show={notification.show}
        onClose={hideNotification}
      />
      <Container className="mt-4">
        <Routes>
          <Route path="/" element={<Marketplace notify={notify} />} />
          <Route path="/list-item" element={account ? <ListItemForm notify={notify} /> : <Navigate to="/" />} />
          <Route path="/my-rentals" element={account ? <MyRentals notify={notify} /> : <Navigate to="/" />} />
          <Route path="/my-listed-items" element={account ? <MyListedItems notify={notify} /> : <Navigate to="/" />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Container>
    </div>
  );
}

export default App;
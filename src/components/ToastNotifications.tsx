import React from 'react';
import { Toaster } from 'react-hot-toast';

export function ToastNotifications() {
  return (
    <Toaster
      position="top-right"
      toastOptions={{
        duration: 4000,
        style: {
          background: '#141414',
          color: '#FFFFFF',
          border: '1px solid #292929',
          fontSize: '14px',
        },
        success: {
          iconTheme: {
            primary: '#16A34A',
            secondary: '#FFFFFF',
          },
        },
        error: {
          iconTheme: {
            primary: '#ED1010',
            secondary: '#FFFFFF',
          },
        },
      }}
    />
  );
}

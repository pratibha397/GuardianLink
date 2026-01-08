// @google/genai guidelines followed: ensuring clean entry point
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Get root element from DOM
const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

// Create React 18 root and render the App
const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
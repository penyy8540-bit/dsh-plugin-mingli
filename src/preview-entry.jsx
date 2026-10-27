import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './app/App.jsx';
import themeCss from './ui/theme.css';

const host = document.getElementById('mingli-preview');
const shadow = host.attachShadow({ mode: 'open' });
const style = document.createElement('style');
style.textContent = themeCss;
shadow.appendChild(style);
const mount = document.createElement('div');
mount.className = 'mingli-mount';
shadow.appendChild(mount);
createRoot(mount).render(React.createElement(App, { preview: true }));

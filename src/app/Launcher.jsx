import React from 'react';

/**
 * Floating entry: 46px gold "命" seal at the bottom-right of the shell.
 * Hidden while the panel is open (the panel owns focus then).
 */
export default function Launcher({ open = false, onClick }) {
  if (open) return null;
  return React.createElement(
    'button',
    {
      className: 'ml-launcher',
      type: 'button',
      title: '打开命理推演（MINGLI）',
      'aria-label': '打开命理推演',
      'aria-expanded': 'false',
      onClick,
    },
    React.createElement('span', { className: 'ml-serif', 'aria-hidden': 'true' }, '命'),
  );
}

import React from 'react';
import overlayCss from './workbench-overlay.css';
import WorkbenchPage from './WorkbenchPage.jsx';
import App from '../App.jsx';
import { subscribeWorkbench, requestWorkbench } from '../panel-bus.js';

/** Floating pill + full-screen workbench layer (three-column page inside an overlay). */
export default function WorkbenchOverlay() {
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => subscribeWorkbench(() => setOpen(true)), []);
  React.useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => { if (event.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return React.createElement(React.Fragment, null,
    React.createElement('style', { dangerouslySetInnerHTML: { __html: overlayCss } }),
    React.createElement('button', {
      type: 'button',
      className: 'ml-launcher',
      title: '打开命理工作台（紫微 · 八字 · 奇门）',
      onClick: () => requestWorkbench(),
    }, '命'),

    open
      ? React.createElement('div', {
        className: 'ml-wbo-backdrop',
        onMouseDown: (event) => { if (event.target === event.currentTarget) setOpen(false); },
      },
      React.createElement('div', { className: 'ml-wbo-panel', role: 'dialog', 'aria-modal': 'true', 'aria-label': '命理工作台' },
        React.createElement('div', { className: 'ml-wbo-bar' },
          React.createElement('span', { className: 'ml-wbo-title' }, 'MINGLI · 命理工作台'),
          React.createElement('button', {
            type: 'button', className: 'ml-wbo-close', title: '关闭（Esc）', onClick: () => setOpen(false),
          }, '×')),
        React.createElement('div', { className: 'ml-wbo-body' }, React.createElement(WorkbenchPage))))
      : null,
    // Keep the profile/chart modal mounted (launcher hidden) so the page's
    // 「新建命主」 and 「看盘面」 actions still work.
    React.createElement(App, { hideLauncher: true }));
}

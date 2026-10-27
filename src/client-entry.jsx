import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './app/App.jsx';
import Workbench from './app/workbench/Workbench.jsx';
import WorkbenchPage from './app/workbench/WorkbenchPage.jsx';
import WorkbenchOverlay from './app/workbench/WorkbenchOverlay.jsx';
import WorkbenchTitle from './app/workbench/WorkbenchTitle.jsx';
import { requestOpen, requestWorkbench } from './app/panel-bus.js';
import { focusMingliView } from './app/open-page.js';
import themeCss from './ui/theme.css';

/**
 * DSH client plugin module. The loader calls factory(require) and expects
 * { inject, apply(ctx) }. Three surfaces share one bundle:
 *
 *   1. sidebar.right.pane.tab  — 「命理」 workbench tab in the right sidebar
 *   2. shell.overlay           — floating 「命盘」 pill + full chart panel
 *   3. conversation.composer.dock / conversation.session.header.utilities — openers
 * Each mounts into its own Shadow DOM.
 */

const WORKBENCH_ID = 'dsh-plugin-mingli/workbench';
const WORKBENCH_KIND = 'mingliWorkbench';

function safeService(ctx, key) {
  try {
    return ctx.get(key) ?? undefined;
  } catch {
    return undefined;
  }
}

function ShadowMount({ variant, children }) {
  const hostRef = React.useRef(null);
  const rootRef = React.useRef(null);

  React.useEffect(() => {
    const host = hostRef.current;
    if (!host || rootRef.current) return undefined;
    const shadow = host.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = themeCss;
    shadow.appendChild(style);
    const mount = document.createElement('div');
    mount.className = 'mingli-mount';
    shadow.appendChild(mount);
    const root = createRoot(mount);
    root.render(children);
    rootRef.current = root;
    return () => {
      rootRef.current = null;
      try { root.unmount(); } catch { /* already gone */ }
    };
  }, []);

  return React.createElement('div', {
    ref: hostRef,
    'data-mingli-host': variant,
    className: variant === 'dock'
      ? 'ml-host-dock'
      : variant === 'view'
        ? 'ml-host-view'
        : variant === 'sidebar'
          ? 'ml-host-sidebar'
          : 'ml-host-overlay',
  });
}

function OverlayEntry() {
  return React.createElement(ShadowMount, { variant: 'overlay' }, React.createElement(WorkbenchOverlay));
}

function ConversationViewEntry(props) {
  return React.createElement(ShadowMount, { variant: 'view' },
    React.createElement(WorkbenchPage, {
      sessionId: props?.sessionId,
      inputActions: props?.inputActions,
      useChat: props?.useChat,
    }));
}

export default {
  inject: ['slots', 'sidebarRight', 'sidebarRightTabs', 'uiWorkspace'],
  apply(ctx) {
    const sidebarRight = safeService(ctx, 'sidebarRight');
    const sidebarRightTabs = safeService(ctx, 'sidebarRightTabs');
    const uiWorkspace = safeService(ctx, 'uiWorkspace');

    const openWorkbench = () => {
      // Primary: jump to the native 「命理」 Conversation view tab (session-bound,
      // so聊天/发送/回填 all work there). Fallback: the detached overlay.
      if (focusMingliView()) return;
      requestWorkbench();
    };

    // ---- right-sidebar workbench tab --------------------------------------
    if (sidebarRightTabs?.register) {
      ctx.effect(() => sidebarRightTabs.register({
        id: WORKBENCH_ID,
        kind: WORKBENCH_KIND,
        priority: 'builtin',
        title: () => '命理',
      }), 'mingli: workbench tab type');
    }

    ctx.slots.inject('sidebar.right.pane.tab', () => ctx.slots.register(
      { name: 'sidebar.right.pane.tab', key: WORKBENCH_ID },
      () => React.createElement(ShadowMount, { variant: 'sidebar' },
        React.createElement(Workbench, { ctx: { uiWorkspace, sidebarRight } })),
    ));

    ctx.slots.inject('sidebar.right.pane.tab.title', () => ctx.slots.register(
      { name: 'sidebar.right.pane.tab.title', key: WORKBENCH_ID },
      WorkbenchTitle,
    ));

    // ---- openers ----------------------------------------------------------
    ctx.slots.inject('conversation.session.header.utilities', () => ctx.slots.register(
      { name: 'conversation.session.header.utilities', id: 'mingli-workbench-open', order: -3 },
      function OpenWorkbenchButton() {
        return React.createElement('button', {
          type: 'button',
          className: 'ml-wb-open',
          title: '打开命理工作台（右栏）',
          onClick: openWorkbench,
        }, '命');
      },
    ));

    ctx.slots.inject('conversation.composer.dock', () => ctx.slots.register(
      { name: 'conversation.composer.dock', id: 'mingli-composer', order: 40 },
      function MingliDockEntry() {
        return React.createElement('button', {
          type: 'button',
          className: 'ml-dock-btn',
          title: '打开命理工作台（紫微斗数 · 子平八字 · 时家奇门）',
          onClick: openWorkbench,
        },
        React.createElement('span', { className: 'ml-dock-glyph' }, '命'),
        React.createElement('span', { className: 'ml-dock-text' }, '命理'));
      },
    ));

    // ---- native conversation view tab (full-page workbench) --------------
    ctx.slots.inject('conversation.view', () => ctx.slots.register(
      { name: 'conversation.view', id: 'mingli', order: 30, label: () => '命理' },
      ConversationViewEntry,
    ));

    // ---- floating chart panel --------------------------------------------
    ctx.slots.inject('shell.overlay', () => ctx.slots.register(
      { name: 'shell.overlay', id: 'mingli', order: 60 },
      OverlayEntry,
    ));
  },
};





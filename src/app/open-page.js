/**
 * Bring the native 「命理」 Conversation view tab into focus.
 *
 * DSH does not expose a public "select conversation view" service to plugins,
 * so this locates the tab row that owns 对话 / 轨迹 and clicks its 命理 tab.
 * It only runs inside the same renderer as the plugin; any failure returns
 * false so callers can fall back to the overlay.
 */
export function focusMingliView() {
  try {
    const rows = [...document.querySelectorAll('[role="tablist"]')];
    const isMingli = (node) => (node.textContent || '').trim() === '命理';
    const isChatRow = (row) => {
      const labels = [...row.querySelectorAll('[role="tab"]')].map((node) => (node.textContent || '').trim());
      return labels.includes('对话') && labels.includes('轨迹');
    };
    // Prefer the row that also owns 对话/轨迹 — that is the conversation view strip,
    // not the right sidebar chip row.
    const ordered = [...rows.filter(isChatRow), ...rows];
    for (const row of ordered) {
      const tab = [...row.querySelectorAll('[role="tab"]')].find(isMingli);
      if (tab) {
        tab.click();
        return true;
      }
    }
    // Last resort: any element labeled 命理 inside a tab strip.
    const loose = [...document.querySelectorAll('[role="tab"],button')].find((node) => {
      if (!isMingli(node)) return false;
      return node.closest('[role="tablist"]') !== null;
    });
    if (loose) {
      loose.click();
      return true;
    }
  } catch {
    /* fall through */
  }
  // Role-less fallback: find the 命理 label whose nearby container also holds
  // 对话 and 轨迹 (the conversation view strip). Avoids the right-sidebar chip.
  try {
    const candidates = [...document.querySelectorAll('button,[role="tab"],a,div,span')]
      .filter((node) => (node.textContent || '').trim() === '命理');
    for (const node of candidates) {
      let scope = node.parentElement;
      for (let depth = 0; scope && depth < 5; depth += 1, scope = scope.parentElement) {
        const text = scope.textContent || '';
        if (text.includes('对话') && text.includes('轨迹') && text.length < 400) {
          (node.closest('button,[role="tab"],a') || node).click();
          return true;
        }
      }
    }
  } catch {
    /* ignore */
  }
  return false;
}

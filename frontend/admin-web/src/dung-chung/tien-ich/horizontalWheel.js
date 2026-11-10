/** Convert a vertical wheel gesture only over a genuinely horizontal scroll area.
 * Keep in sync with user-web's horizontalWheel.ts (independent Docker builds).
 */
function handleHorizontalWheel(event) {
  if (event.defaultPrevented || !event.cancelable || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey || event.deltaX !== 0 || !event.deltaY) return;
  const target = event.target;
  if (!(target instanceof Element) || target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [data-native-wheel]')) return;

  for (let node = target; node && node !== document.body && node !== document.documentElement; node = node.parentElement) {
    const style = getComputedStyle(node);
    // Preserve scrolling in dialogs, long lists and two-dimensional image viewers.
    if (/^(auto|scroll)$/.test(style.overflowY) && node.scrollHeight > node.clientHeight + 1) return;
    const maximum = node.scrollWidth - node.clientWidth;
    if (!/^(auto|scroll)$/.test(style.overflowX) || maximum <= 1 || style.direction === 'rtl') continue;
    const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? node.clientWidth : 1);
    const next = Math.max(0, Math.min(maximum, node.scrollLeft + delta));
    // At either edge, leave the wheel free to scroll the surrounding page.
    if (Math.abs(next - node.scrollLeft) < 0.5) return;
    node.scrollLeft = next;
    event.preventDefault();
    return;
  }
}

export function installHorizontalWheel() {
  document.addEventListener('wheel', handleHorizontalWheel, { passive: false });
  return () => document.removeEventListener('wheel', handleHorizontalWheel);
}

/** Host half of the Mingli plugin.
 * The UI computes charts in the browser with iztro / lunar-javascript / kinqimen,
 * so the host entry intentionally stays side-effect free for now. It is the natural
 * home for a future `mingli_paipan` agent tool.
 */
export const name = 'mingli';

export const inject = [];

export function apply() {
  // No host services required. Reserved for a future agent-facing tool.
}

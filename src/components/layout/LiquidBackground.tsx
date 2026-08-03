/**
 * Ambient near-white background with a whisper of colour behind the glass UI.
 * Fixed, behind everything (z-index -1), so glass cards pick up a faint tint.
 */
export function LiquidBackground() {
  return (
    <div className="lg-canvas" aria-hidden>
      <div
        className="lg-blob"
        style={{ width: 300, height: 300, top: -90, insetInlineStart: -70, background: "#a78bfa", opacity: 0.16 }}
      />
      <div
        className="lg-blob"
        style={{ width: 260, height: 260, top: 160, insetInlineEnd: -100, background: "#f0abfc", opacity: 0.12 }}
      />
      <div
        className="lg-blob"
        style={{ width: 280, height: 280, bottom: 40, insetInlineStart: -90, background: "#818cf8", opacity: 0.1 }}
      />
    </div>
  );
}

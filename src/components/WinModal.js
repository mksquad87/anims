export default function WinModal({
  visible,
  entering,
  frameRect, // { x, y, width, height } in CSS pixels within the overlay
  imageSrc = "/imgs/bl1.png",
  onDismiss,
}) {
  if (!visible || !frameRect) return null;

  const { x = 0, y = 0, width = 0, height = 0 } = frameRect;
  const modalW = width * 0.9; // adjust as needed
  const modalH = height * 0.9; // adjust as needed
  const mx = x + (width - modalW) / 2;
  const my = y + (height - modalH) / 2;

  return (
    <div
      role="dialog"
      aria-label="Congratulations"
      onClick={onDismiss}
      style={{
        position: "absolute",
        left: `${mx}px`,
        top: `${my}px`,
        width: `${modalW}px`,
        height: `${modalH}px`,
        border: "2px solid #4dd9ff",
        borderRadius: 12,
        boxShadow: "0 0 12px rgba(77,217,255,0.9), 0 0 28px rgba(77,217,255,0.5)",
        background:
          "linear-gradient(180deg, rgba(10,16,24,0.85), rgba(10,16,24,0.75))",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        color: "#e6faff",
        textAlign: "center",
        gap: 8,
        padding: 16,
        pointerEvents: "auto",
        transition:
          "transform 420ms cubic-bezier(0.22, 1, 0.36, 1), opacity 420ms ease",
        transform: entering
          ? "translateY(0px)"
          : `translateY(-${Math.round(modalH * 0.25)}px)`,
        opacity: entering ? 1 : 0,
      }}
    >
      <div
        style={{
          transform: "translateY(-20px)",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        <div
          className="modal-art-wrap"
          style={{
            width: "min(40%, 320px)",
            position: "relative",
            marginBottom: 8,
          }}
        >
          <img
            className="modal-art"
            src={imageSrc}
            alt=""
            style={{ width: "100%", display: "block" }}
          />
        </div>
        <div
          style={{
            fontSize: Math.max(14, Math.round(modalH * 0.1)),
            fontWeight: 800,
            letterSpacing: 1,
            textShadow: "0 0 6px rgba(77,217,255,0.8)",
          }}
        >
          Congratulations
        </div>
        <div
          style={{
            fontSize: Math.max(12, Math.round(modalH * 0.075)),
            fontWeight: 600,
            opacity: 0.95,
          }}
        >
          You have won 8 Bonus Spins
        </div>
      </div>
    </div>
  );
}


interface ScanLineProps {
  text?: string;
}

export function ScanLine({ text = 'SCANNING\u2026' }: ScanLineProps) {
  return (
    <div className="scan">
      <div className="scan__bar" />
      <div className="scan__text">{text}</div>
    </div>
  );
}

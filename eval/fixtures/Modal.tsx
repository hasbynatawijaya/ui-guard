type Props = { open: boolean; title: string; onClose: () => void; children: React.ReactNode };

export function Modal({ open, title, onClose, children }: Props) {
  if (!open) return null;
  return (
    <div className="backdrop" onClick={onClose}>
      <div className="modal" style={{ background: "white", borderRadius: 12, padding: 24 }}>
        <div className="modal-title">{title}</div>
        <span className="close" onClick={onClose}>×</span>
        {children}
      </div>
    </div>
  );
}

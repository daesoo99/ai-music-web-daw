interface ReplaceConfirmModalProps {
  isOpen: boolean
  trackName: string
  onConfirm: () => void
  onContinue: () => void
  onCancel: () => void
}

export function ReplaceConfirmModal({
  isOpen,
  trackName,
  onConfirm,
  onContinue,
  onCancel,
}: ReplaceConfirmModalProps) {
  if (!isOpen) return null

  return (
    <div className="modal-overlay">
      <div className="swap-confirm-modal glass-card">
        <h3>악기 및 트랙 생성 옵션</h3>
        <p style={{ margin: '12px 0 20px 0', lineHeight: '1.5', color: '#e0e0e0' }}>
          선택하신 <strong>{trackName}</strong> 트랙에 이미 생성된 곡이 있습니다.<br />
          기존 곡을 교체하시겠습니까, 아니면 기존 곡 뒤에 이어서 새로운 음악을 붙여 만드시겠습니까?
        </p>
        <div className="actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', flexWrap: 'wrap' }}>
          <button className="btn-secondary" onClick={onCancel}>
            취소
          </button>
          <button className="btn-primary" onClick={onContinue} style={{ backgroundColor: '#4a148c', color: '#fff' }}>
            이어서 생성하기
          </button>
          <button className="btn-primary" onClick={onConfirm} style={{ backgroundColor: '#d32f2f', color: '#fff' }}>
            교체하기
          </button>
        </div>
      </div>
    </div>
  )
}

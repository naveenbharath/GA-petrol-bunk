import Modal from './Modal.jsx'

export default function ConfirmDialog({ isOpen, onClose, onConfirm, title = 'Are you sure?', description, confirmLabel = 'Delete' }) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} maxWidth="max-w-sm">
      <p className="text-sm text-slate-600">{description}</p>
      <div className="mt-5 flex justify-end gap-2">
        <button
          onClick={onClose}
          className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 active:scale-[0.98]"
        >
          Cancel
        </button>
        <button
          onClick={() => {
            onConfirm()
            onClose()
          }}
          className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-rose-700 active:scale-[0.98]"
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  )
}

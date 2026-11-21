import { useEffect, useRef } from 'react'
export function LocalFilePreview({ file, close }: { file: File; close: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null), image = useRef<HTMLImageElement>(null), frame = useRef<HTMLIFrameElement>(null)
  useEffect(() => { const value = URL.createObjectURL(file); const viewer = image.current || frame.current; if (viewer) viewer.src = value; dialog.current?.showModal(); return () => URL.revokeObjectURL(value) }, [file])
  return <dialog ref={dialog} className="sw-dialog" onCancel={close} aria-label="Selected file preview"><header><h2>{file.name}</h2><button type="button" autoFocus onClick={close}>Close</button></header>{file.type.startsWith('image/') ? <img ref={image} alt="Selected document" /> : <iframe ref={frame} title="Selected document" />}</dialog>
}

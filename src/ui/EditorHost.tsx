import { useEffect, useRef } from 'react'
import { app } from '../app/container'

/** Mounts the single CodeMirror instance. Documents are swapped in and out by the controller. */
export function EditorHost({ hidden }: { hidden: boolean }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    app.editor.mount(el)
    return () => app.editor.unmount()
  }, [])

  return <div ref={ref} className="v-editor" hidden={hidden} />
}

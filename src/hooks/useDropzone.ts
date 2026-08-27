import { useCallback, useRef, useState } from 'react'
import { useBatchStore } from '../lib/batch/state'

/**
 * Drag-and-drop + click-to-browse upload for the DropZone.
 * Handles drag state, a hidden file input, and forwards accepted files to the
 * batch store (which does validation + parallel analysis).
 */
export function useDropzone() {
  const addFiles = useBatchStore((s) => s.addFiles)
  const inputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const dragDepth = useRef(0)

  const process = useCallback(
    (list: FileList | null) => {
      if (!list || list.length === 0) return
      addFiles(Array.from(list))
    },
    [addFiles],
  )

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      dragDepth.current = 0
      setIsDragging(false)
      process(e.dataTransfer.files)
    },
    [process],
  )

  const onDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    dragDepth.current += 1
    setIsDragging(true)
  }, [])

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    dragDepth.current -= 1
    if (dragDepth.current <= 0) {
      dragDepth.current = 0
      setIsDragging(false)
    }
  }, [])

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
  }, [])

  const openPicker = useCallback(() => {
    inputRef.current?.click()
  }, [])

  return {
    inputRef,
    isDragging,
    onDrop,
    onDragEnter,
    onDragLeave,
    onDragOver,
    openPicker,
    process,
  }
}

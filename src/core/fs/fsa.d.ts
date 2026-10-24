/* Ambient types for the parts of the File System Access API that lib.dom does not cover. */
export {}

declare global {
  interface FilePickerAcceptType {
    description?: string
    accept: Record<string, string[]>
  }

  interface Window {
    showDirectoryPicker?: (options?: { mode?: 'read' | 'readwrite'; id?: string }) => Promise<FileSystemDirectoryHandle>
    showOpenFilePicker?: (options?: {
      multiple?: boolean
      excludeAcceptAllOption?: boolean
      types?: FilePickerAcceptType[]
    }) => Promise<FileSystemFileHandle[]>
    showSaveFilePicker?: (options?: {
      suggestedName?: string
      excludeAcceptAllOption?: boolean
      types?: FilePickerAcceptType[]
    }) => Promise<FileSystemFileHandle>
  }

  interface DataTransferItem {
    /** Chromium only: resolves a dropped item to a real file system handle. */
    getAsFileSystemHandle?: () => Promise<FileSystemHandle | null>
  }

  interface FileSystemHandle {
    queryPermission?: (descriptor?: { mode?: 'read' | 'readwrite' }) => Promise<PermissionState>
    requestPermission?: (descriptor?: { mode?: 'read' | 'readwrite' }) => Promise<PermissionState>
  }

  interface File {
    readonly webkitRelativePath: string
  }
}

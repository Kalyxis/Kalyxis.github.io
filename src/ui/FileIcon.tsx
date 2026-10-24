import { File, FileCode, FileCog, FileJson, FileText, FileTerminal, Folder, FolderOpen, Palette, Braces } from 'lucide-react'
import { getLanguageInfo, type LanguageId } from '../core/languages/catalog'

interface FileIconProps {
  languageId: LanguageId
  size?: number
}

export function FileIcon({ languageId, size = 18 }: FileIconProps) {
  const kind = getLanguageInfo(languageId).icon
  const props = { size, strokeWidth: 1.4, 'aria-hidden': true as const }
  switch (kind) {
    case 'code':
      return <FileCode {...props} />
    case 'data':
      return languageId === 'json' || languageId === 'jsonc' ? <FileJson {...props} /> : <Braces {...props} />
    case 'markup':
      return <FileCode {...props} />
    case 'style':
      return <Palette {...props} />
    case 'shell':
      return <FileTerminal {...props} />
    case 'config':
      return <FileCog {...props} />
    case 'text':
      return <FileText {...props} />
    default:
      return <File {...props} />
  }
}

export function FolderIcon({ open, size = 18 }: { open?: boolean; size?: number }) {
  return open ? <FolderOpen size={size} strokeWidth={1.4} aria-hidden /> : <Folder size={size} strokeWidth={1.4} aria-hidden />
}

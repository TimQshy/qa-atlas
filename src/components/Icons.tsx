import type { CSSProperties } from 'react'

interface IconProps {
  size?: number
  stroke?: string
  fill?: string
  style?: CSSProperties
}

const Icon = ({ d, size = 14, fill = 'none', stroke = 'currentColor', sw = 1.5, children, style }: {
  d?: string; size?: number; fill?: string; stroke?: string; sw?: number; children?: React.ReactNode; style?: CSSProperties
}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={stroke}
    strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"
    style={{ flexShrink: 0, display: 'inline-block', ...style }}>
    {d ? <path d={d} /> : children}
  </svg>
)

export const I = {
  Chevron:     (p: IconProps) => <Icon {...p}><path d="M9 6l6 6-6 6" /></Icon>,
  ChevronDown: (p: IconProps) => <Icon {...p}><path d="M6 9l6 6 6-6" /></Icon>,
  Folder:      (p: IconProps) => <Icon {...p}><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" /></Icon>,
  FolderOpen:  (p: IconProps) => <Icon {...p}><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v1H3V7zM3 9h18l-2 8a2 2 0 0 1-2 1.5H5A2 2 0 0 1 3 17V9z" /></Icon>,
  Doc:         (p: IconProps) => <Icon {...p}><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5zM14 3v5h5M9 13h6M9 17h4" /></Icon>,
  Search:      (p: IconProps) => <Icon {...p}><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></Icon>,
  Plus:        (p: IconProps) => <Icon {...p}><path d="M12 5v14M5 12h14" /></Icon>,
  Close:       (p: IconProps) => <Icon {...p}><path d="M18 6L6 18M6 6l12 12" /></Icon>,
  More:        (p: IconProps) => <Icon {...p}><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /><circle cx="5" cy="12" r="1" /></Icon>,
  Link:        (p: IconProps) => <Icon {...p}><path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" /></Icon>,
  Paperclip:   (p: IconProps) => <Icon {...p}><path d="M21 11l-9 9a5 5 0 0 1-7-7l9-9a3.5 3.5 0 0 1 5 5l-9 9a2 2 0 0 1-3-3l8-8" /></Icon>,
  Image:       (p: IconProps) => <Icon {...p}><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="9" cy="9" r="2" /><path d="M21 15l-5-5L5 21" /></Icon>,
  Send:        (p: IconProps) => <Icon {...p}><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" /></Icon>,
  Edit:        (p: IconProps) => <Icon {...p}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></Icon>,
  Trash:       (p: IconProps) => <Icon {...p}><path d="M3 6h18M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" /></Icon>,
  Reply:       (p: IconProps) => <Icon {...p}><path d="M9 17l-5-5 5-5M4 12h11a5 5 0 0 1 5 5v3" /></Icon>,
  Sidebar:     (p: IconProps) => <Icon {...p}><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M9 3v18" /></Icon>,
  GitBranch:   (p: IconProps) => <Icon {...p}><circle cx="6" cy="3" r="2" /><circle cx="6" cy="18" r="2" /><circle cx="18" cy="6" r="2" /><path d="M6 5v8a4 4 0 0 0 4 4h2a4 4 0 0 0 4-4V8" /></Icon>,
  Filter:      (p: IconProps) => <Icon {...p}><path d="M3 4h18l-7 9v7l-4-2v-5L3 4z" /></Icon>,
  Check:       (p: IconProps) => <Icon {...p}><path d="M20 6L9 17l-5-5" /></Icon>,
  Arrow:       (p: IconProps) => <Icon {...p}><path d="M5 12h14M13 5l7 7-7 7" /></Icon>,
  Download:    (p: IconProps) => <Icon {...p}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" /></Icon>,
  Upload:      (p: IconProps) => <Icon {...p}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" /></Icon>,
  Sun:         (p: IconProps) => <Icon {...p}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></Icon>,
  Moon:        (p: IconProps) => <Icon {...p}><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></Icon>,
  Refresh:     (p: IconProps) => <Icon {...p}><path d="M1 4v6h6M23 20v-6h-6M20.5 9A9 9 0 0 0 5.6 5.6L1 10m22 4l-4.6 4.4A9 9 0 0 1 3.5 15" /></Icon>,
  LogOut:      (p: IconProps) => <Icon {...p}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" /></Icon>,
  Mail:        (p: IconProps) => <Icon {...p}><rect x="2" y="4" width="20" height="16" rx="2" /><path d="M2 7l10 7 10-7" /></Icon>,
  Lock:        (p: IconProps) => <Icon {...p}><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></Icon>,
  Bug:         (p: IconProps) => <Icon {...p}><path d="M8 6a4 4 0 0 1 8 0M6 10h12v4a6 6 0 0 1-12 0v-4zM3 13h3M18 13h3M5 6l2 2M19 6l-2 2" /></Icon>,
  ChevronsDown:(p: IconProps) => <Icon {...p}><path d="M7 6l5 5 5-5M7 13l5 5 5-5" /></Icon>,
  ChevronsUp:  (p: IconProps) => <Icon {...p}><path d="M17 18l-5-5-5 5M17 11l-5-5-5 5" /></Icon>,
  Copy:        (p: IconProps) => <Icon {...p}><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></Icon>,
  Sparkles:    (p: IconProps) => <Icon {...p} sw={1.4}><path d="M12 3l1.5 4L17 8.5l-3.5 1.5L12 14l-1.5-4L7 8.5l3.5-1.5L12 3z" /><path d="M5 17l.8 2.2L8 20l-2.2.8L5 23l-.8-2.2L2 20l2.2-.8L5 17z" /><path d="M19 2l.6 1.7L21 4.3l-1.4.6L19 7l-.6-1.7L17 4.8l1.4-.5L19 2z" /></Icon>,
  ExternalLink:(p: IconProps) => <Icon {...p}><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3" /></Icon>,
  Logo:        (p: IconProps) => (
    <svg width={p?.size ?? 20} height={p?.size ?? 20} viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
      <rect x="2" y="2" width="20" height="20" rx="5" fill="var(--accent)" />
      <path d="M8 8.5h8M8 12h8M8 15.5h5" stroke="#0a0a0b" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="16.5" cy="15.5" r="1.6" fill="#0a0a0b" />
    </svg>
  ),
}

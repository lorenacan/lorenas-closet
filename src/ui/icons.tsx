import type { ReactNode } from 'react'

const S = (d: ReactNode) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{d}</svg>
)

export const IconHanger = () => S(<><path d="M12 7a2.2 2.2 0 1 0-2.2-2.2" /><path d="M12 7v2.2L3.5 15a1.6 1.6 0 0 0 1 2.9h15a1.6 1.6 0 0 0 1-2.9L12 9.2" /></>)
export const IconSpark = () => S(<><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" /><path d="M19 16l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z" /></>)
export const IconHeartNav = () => S(<path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.6 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z" />)
export const IconGear = () => S(<><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></>)
export const IconPlus = () => S(<path d="M12 5v14M5 12h14" />)
export const IconBack = () => S(<path d="M15 5l-7 7 7 7" />)
export const IconSearch = () => S(<><circle cx="11" cy="11" r="6.5" /><path d="M20 20l-4.2-4.2" /></>)
export const IconHeart = ({ filled }: { filled?: boolean }) => (
  <svg viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.6 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z" />
  </svg>
)
export const IconBookmark = ({ filled }: { filled?: boolean }) => (
  <svg viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 4h12v17l-6-4.2L6 21z" />
  </svg>
)
export const IconX = () => S(<path d="M6 6l12 12M18 6L6 18" />)
export const IconCamera = () => S(<><path d="M4 8h3l1.6-2.5h6.8L17 8h3v11H4z" /><circle cx="12" cy="13" r="3.6" /></>)
export const IconImage = () => S(<><rect x="3.5" y="4.5" width="17" height="15" rx="2" /><circle cx="9" cy="10" r="1.6" /><path d="M20 16l-5-5-8 8" /></>)
export const IconRefresh = () => S(<><path d="M20 11a8 8 0 0 0-14.5-3.8L4 9" /><path d="M4 4v5h5" /><path d="M4 13a8 8 0 0 0 14.5 3.8L20 15" /><path d="M20 20v-5h-5" /></>)
export const IconCheck = () => S(<path d="M5 12.5l4.5 4.5L19 7" />)
export const IconChevron = ({ open }: { open?: boolean }) => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: open ? 'rotate(180deg)' : undefined, transition: 'transform .15s' }}>
    <path d="M6 9l6 6 6-6" />
  </svg>
)
export const IconSliders = () => S(<><path d="M4 7h10M18 7h2M4 17h2M10 17h10" /><circle cx="16" cy="7" r="2" /><circle cx="8" cy="17" r="2" /></>)
export const IconEdit = () => S(<><path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z" /></>)
export const IconTrash = () => S(<><path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13" /></>)

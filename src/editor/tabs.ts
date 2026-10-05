import { CalendarCheck, Images, Info, Map as MapIcon, PanelsTopLeft, Send } from '@lucide/vue'

// the editor's sections, in order; the desktop sidebar lists them too, so they live apart from EditView
export const EDIT_TABS = [
  { id: 'general', icon: Info },
  { id: 'panel', icon: PanelsTopLeft },
  { id: 'plan', icon: MapIcon },
  { id: 'media', icon: Images },
  { id: 'maintenance', icon: CalendarCheck },
  { id: 'publish', icon: Send },
] as const

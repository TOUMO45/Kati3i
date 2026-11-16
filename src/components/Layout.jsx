import { Link, useLocation, NavLink } from 'react-router-dom'
import { LayoutDashboard, ListChecks, Receipt, BarChart3, User, Sun, Moon, Languages } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { useLocale } from '../context/LocaleContext'
import { Avatar } from './PhotoUploader'

const NAV = [
  { to: '/',         icon: LayoutDashboard, labelKey: 'nav.home' },
  { to: '/flocks',   icon: ListChecks,      labelKey: 'nav.flocks' },
  { to: '/expenses', icon: Receipt,         labelKey: 'nav.expenses' },
  { to: '/reports',  icon: BarChart3,       labelKey: 'nav.reports' },
  { to: '/profile',  icon: User,            labelKey: 'nav.profile' },
]

export default function Layout({ children }) {
  const { user } = useAuth()
  const { theme, toggle } = useTheme()
  const { lang, toggleLang, t } = useLocale()
  const location = useLocation()

  return (
    <div className="min-h-full flex flex-col">
      <header className="safe-pad-top sticky top-0 z-30 bg-white/85 dark:bg-stone-900/85 backdrop-blur border-b border-stone-100 dark:border-stone-800">
        <div className="max-w-3xl mx-auto px-3 sm:px-4 py-2.5 sm:py-3 flex items-center justify-between gap-2">
          <Link to="/" className="flex items-center gap-2 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-brand-600 grid place-items-center text-lg shrink-0" aria-hidden="true">🐑</div>
            <div className="min-w-0">
              <div className="font-bold text-stone-900 dark:text-stone-100 leading-tight truncate text-sm sm:text-base">{t('app.name')}</div>
              <div className="text-[10px] sm:text-xs text-stone-500 dark:text-stone-400 leading-tight truncate hidden sm:block">{t('app.tagline')}</div>
            </div>
          </Link>
          <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
            {/* Language switch — always visible, one tap to flip EN <-> AR */}
            <button
              onClick={toggleLang}
              className="px-2 sm:px-2.5 py-1.5 rounded-lg text-xs font-semibold hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-200 flex items-center gap-1"
              aria-label={t('common.toggleLang')}
              title={t('common.toggleLang')}
            >
              <Languages className="w-4 h-4" />
              <span>{lang === 'ar' ? 'EN' : 'عربي'}</span>
            </button>
            <button
              onClick={toggle}
              className="flex items-center gap-1 px-2 sm:px-2.5 py-1.5 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-200"
              aria-label={t('common.toggleTheme')}
              title={theme === 'dark' ? t('theme.light') : t('theme.dark')}
            >
              {theme === 'dark'
                ? <Sun className="w-4 h-4 text-amber-400" />
                : <Moon className="w-4 h-4 text-stone-600" />}
              <span className="text-[11px] font-semibold uppercase tracking-wider hidden sm:inline">
                {theme === 'dark' ? t('theme.light') : t('theme.dark')}
              </span>
            </button>
            {/* Profile avatar — quick access to account & sign out from any page */}
            <Link
              to="/profile"
              className="hover:ring-2 hover:ring-brand-500 rounded-full transition shrink-0"
              title={user?.displayName || user?.email || 'Profile'}
            >
              <Avatar user={user} size="sm" />
            </Link>
          </div>
        </div>
      </header>

      <div className="flex-1 max-w-3xl w-full mx-auto px-3 sm:px-4 pb-32 sm:pb-28 pt-4">
        {children}
      </div>

      {/* Always-visible bottom nav (5 tabs). Works on mobile AND desktop
          so users on a laptop always have navigation reachable.
          safe-pad-bottom keeps the buttons above the iOS home indicator. */}
      <nav className="safe-pad-bottom fixed bottom-0 inset-x-0 z-30 bg-white/95 dark:bg-stone-900/95 backdrop-blur border-t border-stone-100 dark:border-stone-800">
        <div className="max-w-3xl mx-auto grid grid-cols-5">
          {NAV.map((item) => {
            const active = location.pathname === item.to ||
              (item.to !== '/' && location.pathname.startsWith(item.to))
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={`flex flex-col items-center justify-center py-2.5 text-[10px] sm:text-xs gap-0.5 min-h-[56px]
                  ${active ? 'text-brand-700 dark:text-brand-400' : 'text-stone-500 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-200'}`}
              >
                <item.icon className={`w-5 h-5 ${active ? 'stroke-[2.5]' : ''}`} />
                <span className="truncate max-w-full">{t(item.labelKey)}</span>
              </NavLink>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { Download, ArrowLeft, Loader2 } from 'lucide-react'
import {
  PieChart, Pie, Cell, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  LineChart, Line,
} from 'recharts'
import { useAuth } from '../context/AuthContext'
import { useLocale } from '../context/LocaleContext'
import {
  subscribeFlocks, subscribeExpenses, subscribeSales, subscribeWeights,
} from '../hooks/useFirestore'
import {
  totalInvested, totalExpenses, totalSheepLost, liveSheepCount,
  currentCostPerSheep, currentValue, holdingDays, roi, flockProfit, flockRevenue,
  expenseAmount,
  totalRevenue, totalRealizedProfit, currentAvgWeight, expenseBreakdown,
  EXPENSE_TYPES,
} from '../utils/calculations'
import { livestockEmoji } from '../utils/livestock'
import { formatMoney, formatDate } from '../utils/format'

export default function FlockReport() {
  const { id } = useParams()
  const { user } = useAuth()
  const { t, lang } = useLocale()
  const navigate = useNavigate()
  const [flocks, setFlocks]     = useState(null)
  const [expenses, setExpenses] = useState([])
  const [sales, setSales]       = useState([])
  const [weights, setWeights]   = useState([])

  useEffect(() => {
    if (!user) return
    const u1 = subscribeFlocks(user.uid, setFlocks)
    const u2 = subscribeExpenses(user.uid, setExpenses, id)
    const u3 = subscribeSales(user.uid, setSales, id)
    const u4 = subscribeWeights(user.uid, setWeights, id)
    return () => { u1(); u2(); u3(); u4() }
  }, [user, id])

  const [downloading, setDownloading] = useState(false)
  const back = () => navigate(`/flocks/${id}`)

  // Generate a real PDF file the user can download — works on every browser,
  // including mobile, because we don't rely on the OS print dialog.
  // Libraries load lazily so they're not in the main bundle.
  const downloadPdf = async () => {
    if (downloading) return
    setDownloading(true)
    let step = 'starting'
    let el = null
    let saved = null
    try {
      step = 'loading libraries'
      const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
        import('jspdf'),
        import('html2canvas'),
      ])

      step = 'finding report element'
      el = document.querySelector('.report-page')
      if (!el) throw new Error('report-page element not found')

      // Force the desktop layout width during capture. On phones the element
      // is only ~360px wide, so the captured image is tall and skinny —
      // scaling it to A4 width blows up fonts ~2.3× and slices text rows
      // across page breaks. Locking width to the design max (850px) gives
      // a consistent, properly-sized PDF on every device.
      step = 'forcing capture width'
      const CAPTURE_WIDTH = 850
      saved = {
        width: el.style.width,
        maxWidth: el.style.maxWidth,
        bodyOverflowX: document.body.style.overflowX,
      }
      el.style.width = `${CAPTURE_WIDTH}px`
      el.style.maxWidth = `${CAPTURE_WIDTH}px`
      // Hide the brief horizontal scroll the resize triggers on mobile.
      document.body.style.overflowX = 'hidden'

      // Wait for fonts, layout reflow, and Recharts ResponsiveContainer
      // (ResizeObserver) to pick up the new width and redraw its SVGs.
      step = 'waiting for layout'
      if (document.fonts && document.fonts.ready) {
        await document.fonts.ready
      }
      await new Promise((r) => setTimeout(r, 600))

      step = 'rendering canvas'
      const canvas = await html2canvas(el, {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true,
        allowTaint: true,
        logging: false,
        windowWidth: CAPTURE_WIDTH,
      })

      step = 'building PDF'
      const imgData = canvas.toDataURL('image/jpeg', 0.92)
      const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' })
      const pageW = pdf.internal.pageSize.getWidth()
      const pageH = pdf.internal.pageSize.getHeight()
      const imgH = (canvas.height * pageW) / canvas.width
      let heightLeft = imgH
      let position = 0
      pdf.addImage(imgData, 'JPEG', 0, position, pageW, imgH)
      heightLeft -= pageH
      while (heightLeft > 0) {
        position -= pageH
        pdf.addPage()
        pdf.addImage(imgData, 'JPEG', 0, position, pageW, imgH)
        heightLeft -= pageH
      }

      step = 'downloading'
      const safe = (flock?.name || 'flock').replace(/[^\w؀-ۿ.-]+/g, '_').slice(0, 60)
      const today = new Date().toISOString().slice(0, 10)
      const filename = `${safe}_${today}.pdf`

      // pdf.save() sometimes silently fails inside in-app webviews. Do the
      // download manually via a blob URL + <a download> so we control the path.
      const blob = pdf.output('blob')
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.rel = 'noopener'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(url), 4000)
    } catch (e) {
      console.error('PDF export failed at step:', step, e)
      alert(`${t('report.printUnsupported')}\n\n[${step}] ${e?.message || e}`)
    } finally {
      if (el && saved) {
        el.style.width = saved.width
        el.style.maxWidth = saved.maxWidth
        document.body.style.overflowX = saved.bodyOverflowX
      }
      setDownloading(false)
    }
  }

  // Still loading data — show a spinner instead of a blank/half page.
  if (flocks === null) {
    return (
      <div className="min-h-screen grid place-items-center bg-stone-100">
        <div className="text-stone-500">…</div>
      </div>
    )
  }

  const flock = flocks.find((f) => f.id === id)
  if (!flock) {
    return (
      <div className="min-h-screen grid place-items-center bg-stone-100 p-6">
        <div className="card text-center max-w-sm">
          <div className="text-stone-700 dark:text-stone-200 mb-4">{t('detail.notFound')}</div>
          <button onClick={() => navigate('/flocks')} className="btn-secondary w-full">
            <ArrowLeft className="w-4 h-4 rtl:rotate-180" /> {t('common.back')}
          </button>
        </div>
      </div>
    )
  }

  const flockExpenses = expenses.filter((e) => e.flockId === id)
  const flockSales    = sales.filter((s) => s.flockId === id)
  const flockWeights  = weights.filter((w) => w.flockId === id)

  const invested = totalInvested(flock, flockExpenses)
  const expSum   = totalExpenses(flockExpenses, flock.id)
  const lost     = totalSheepLost(flockExpenses, flock.id)
  const live     = liveSheepCount(flock, flockExpenses)
  const cps      = currentCostPerSheep(flock, flockExpenses, flockSales)
  const value    = currentValue(flock, flockExpenses, flockSales)
  const days     = holdingDays(flock)
  const flockRoi = roi(flock, flockExpenses, flockSales)
  const revenue  = flockRevenue(flock, flockSales)
  const profit   = flockProfit(flock, flockExpenses, flockSales)
  const avgWeight = currentAvgWeight(flock, flockWeights)

  const breakdown = expenseBreakdown(flockExpenses, flock.id)
    .filter((b) => b.value > 0)
  const breakdownWithLabels = breakdown.map((b) => ({
    ...b,
    label: t(`type.${b.type}`),
  }))

  const investmentParts = [
    { name: t('report.buyPrice'),    value: Number(flock.buyPrice || 0), color: '#0ea5e9' },
    ...EXPENSE_TYPES.map((et) => {
      const v = flockExpenses
        .filter((e) => e.type === et.id)
        .reduce((s, e) => s + expenseAmount(e), 0)
      return { name: t(`type.${et.id}`), value: v, color: et.color }
    }).filter((p) => p.value > 0),
  ]

  const weightSeries = [...flockWeights]
    .sort((a, b) => String(a.date).localeCompare(String(b.date)))
    .map((w) => ({ date: w.date, avg: Number(w.avgWeight || 0) }))
  if (flock.initialAvgWeight) {
    weightSeries.unshift({ date: flock.buyDate, avg: Number(flock.initialAvgWeight) })
  }

  const profitPositive = profit >= 0
  const today = new Date().toISOString().slice(0, 10)

  return (
    <div
      className="report-root min-h-screen"
      style={{ backgroundColor: '#f5f5f4', color: '#1c1917', colorScheme: 'light' }}
    >
      {/* Toolbar — hidden when generating PDF */}
      <div className="no-print sticky top-0 z-20 bg-white border-b border-stone-200 shadow-sm">
        <div className="max-w-[850px] mx-auto px-3 sm:px-6 py-2.5 sm:py-3 flex items-center gap-2">
          <button onClick={back} className="btn-secondary px-3" aria-label={t('common.back')}>
            <ArrowLeft className="w-4 h-4 rtl:rotate-180" />
            <span className="hidden sm:inline ms-1">{t('common.back')}</span>
          </button>
          <h2 className="flex-1 text-center font-semibold text-stone-700 text-sm sm:text-base truncate">
            {t('report.title')}
          </h2>
          <button onClick={downloadPdf} disabled={downloading} className="btn-primary">
            {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            <span className="hidden sm:inline ms-1">{downloading ? t('common.saving') : t('report.download')}</span>
            <span className="sm:hidden ms-1">PDF</span>
          </button>
        </div>
      </div>

      {/* Report page — text colors forced so dark-mode body color can't bleed in */}
      <div
        className="report-page max-w-[850px] mx-auto shadow-md my-4 sm:my-6 p-5 sm:p-10"
        style={{ backgroundColor: '#ffffff', color: '#1c1917' }}
      >
        {/* Brand header */}
        <header className="flex items-start justify-between gap-4 pb-5 border-b-2 border-brand-600 mb-6">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-xl bg-brand-600 grid place-items-center text-white text-xl">🐑</div>
              <div className="text-xs uppercase tracking-widest text-stone-500">{t('app.name')}</div>
            </div>
            <h1 className="text-3xl font-bold text-stone-900 mt-3 flex items-center gap-2">
              <span>{livestockEmoji(flock)}</span>
              <span>{flock.name}</span>
            </h1>
            <div className="flex items-center gap-2 mt-2 text-sm">
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                flock.status === 'sold'
                  ? 'bg-stone-200 text-stone-700'
                  : 'bg-emerald-100 text-emerald-700'
              }`}>
                {t(`status.${flock.status || 'active'}`)}
              </span>
              <span className="text-stone-500">·</span>
              <span className="text-stone-600">{t('report.boughtOn', { date: formatDate(flock.buyDate, lang === 'ar' ? 'ar' : 'en-GB') })}</span>
              <span className="text-stone-500">·</span>
              <span className="text-stone-600">{t('report.heldDays', { n: days })}</span>
            </div>
          </div>
          <div className="text-end text-xs text-stone-500">
            <div>{t('report.generated')}</div>
            <div className="font-semibold text-stone-700 mt-0.5">{today}</div>
          </div>
        </header>

        {/* KPI cards */}
        <section className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6 avoid-break">
          <KpiCard
            label={t('report.kpi.invested')}
            value={formatMoney(invested)}
            tone="brand"
          />
          <KpiCard
            label={t('report.kpi.value')}
            value={formatMoney(value)}
            tone="neutral"
          />
          <KpiCard
            label={profitPositive ? t('report.kpi.profit') : t('report.kpi.loss')}
            value={formatMoney(profit)}
            tone={profitPositive ? 'good' : 'bad'}
          />
          <KpiCard
            label={t('report.kpi.roi')}
            value={`${flockRoi.toFixed(1)}%`}
            tone={profitPositive ? 'good' : 'bad'}
          />
        </section>

        {/* Counts strip */}
        <section className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-7 avoid-break">
          <MiniStat label={t('report.count.initial')} value={Number(flock.initialCount || 0)} />
          <MiniStat label={t('report.count.live')}    value={live} />
          <MiniStat label={t('report.count.sold')}    value={Number(flock.soldCount || 0)} />
          <MiniStat label={t('report.count.dead')}    value={lost} tone={lost > 0 ? 'bad' : 'neutral'} />
        </section>

        {/* Per-animal economics */}
        <section className="mb-7 avoid-break">
          <SectionTitle>{t('report.economics.title')}</SectionTitle>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2 text-sm">
            <FactRow label={t('report.economics.buyPrice')}      value={formatMoney(flock.buyPrice)} />
            <FactRow label={t('report.economics.expenses')}      value={formatMoney(expSum)} />
            <FactRow label={t('report.economics.costPerAnimal')} value={formatMoney(cps)} highlight />
            <FactRow label={t('report.economics.revenue')}       value={formatMoney(revenue)} />
            <FactRow label={t('report.economics.avgWeight')}     value={avgWeight ? `${avgWeight.toFixed(1)} KG` : '—'} />
            <FactRow label={t('report.economics.breakEven')}     value={formatMoney(cps)} />
          </div>
        </section>

        {/* Expense breakdown — chart + table */}
        {breakdownWithLabels.length > 0 && (
          <section className="mb-7 avoid-break">
            <SectionTitle>{t('report.expense.title')}</SectionTitle>
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-5 items-center">
              <div className="sm:col-span-2 h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={breakdownWithLabels}
                      dataKey="value"
                      nameKey="label"
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={80}
                      paddingAngle={2}
                      isAnimationActive={false}
                    >
                      {breakdownWithLabels.map((entry) => (
                        <Cell key={entry.type} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="sm:col-span-3">
                <table className="w-full text-sm">
                  <tbody>
                    {breakdownWithLabels.map((b) => (
                      <tr key={b.type} className="border-b border-stone-100 last:border-0">
                        <td className="py-1.5">
                          <span className="inline-block w-2.5 h-2.5 rounded-full me-2 align-middle" style={{ background: b.color }} />
                          {b.label}
                        </td>
                        <td className="py-1.5 text-end font-semibold">{formatMoney(b.value)}</td>
                        <td className="py-1.5 text-end text-stone-500 w-12">
                          {((b.value / expSum) * 100).toFixed(0)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}

        {/* Investment composition bar */}
        {investmentParts.length > 1 && (
          <section className="mb-7 avoid-break">
            <SectionTitle>{t('report.invest.title')}</SectionTitle>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={investmentParts} margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => formatMoney(v)} />
                  <Bar dataKey="value" isAnimationActive={false}>
                    {investmentParts.map((p, i) => (
                      <Cell key={i} fill={p.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
        )}

        {/* Weight progression */}
        {weightSeries.length >= 2 && (
          <section className="mb-7 avoid-break">
            <SectionTitle>{t('report.weight.title')}</SectionTitle>
            <div className="h-[180px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={weightSeries} margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 11 }} unit=" kg" />
                  <Tooltip />
                  <Line type="monotone" dataKey="avg" stroke="#0ea5e9" strokeWidth={2} dot={{ r: 4 }} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>
        )}

        {/* Sales table */}
        {flockSales.length > 0 && (
          <section className="mb-7">
            <SectionTitle>{t('report.sales.title')}</SectionTitle>
            <div className="overflow-x-auto print:overflow-visible -mx-2 sm:mx-0">
            <table className="w-full text-sm min-w-[600px] sm:min-w-0">
              <thead>
                <tr className="bg-stone-100 text-stone-600 text-xs uppercase">
                  <th className="py-2 px-3 text-start">{t('report.col.date')}</th>
                  <th className="py-2 px-3 text-start">{t('report.col.type')}</th>
                  <th className="py-2 px-3 text-end">{t('report.col.qty')}</th>
                  <th className="py-2 px-3 text-end">{t('report.col.price')}</th>
                  <th className="py-2 px-3 text-end">{t('report.col.revenue')}</th>
                  <th className="py-2 px-3 text-end">{t('report.col.profit')}</th>
                </tr>
              </thead>
              <tbody>
                {[...flockSales]
                  .sort((a, b) => String(a.saleDate).localeCompare(String(b.saleDate)))
                  .map((s) => (
                    <tr key={s.id} className="border-b border-stone-100">
                      <td className="py-2 px-3">{formatDate(s.saleDate, lang === 'ar' ? 'ar' : 'en-GB')}</td>
                      <td className="py-2 px-3">{t(`sell.${s.saleType}`)}</td>
                      <td className="py-2 px-3 text-end">{s.quantitySold}</td>
                      <td className="py-2 px-3 text-end">{formatMoney(s.pricePerSheep)}</td>
                      <td className="py-2 px-3 text-end">{formatMoney(s.revenue)}</td>
                      <td className={`py-2 px-3 text-end font-semibold ${s.profit >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                        {formatMoney(s.profit)}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
            </div>
          </section>
        )}

        {/* Expenses table */}
        {flockExpenses.length > 0 && (
          <section className="mb-7">
            <SectionTitle>{t('report.expense.history')}</SectionTitle>
            <div className="overflow-x-auto print:overflow-visible -mx-2 sm:mx-0">
            <table className="w-full text-sm min-w-[500px] sm:min-w-0">
              <thead>
                <tr className="bg-stone-100 text-stone-600 text-xs uppercase">
                  <th className="py-2 px-3 text-start">{t('report.col.date')}</th>
                  <th className="py-2 px-3 text-start">{t('report.col.type')}</th>
                  <th className="py-2 px-3 text-end">{t('report.col.amount')}</th>
                  <th className="py-2 px-3 text-start">{t('report.col.note')}</th>
                </tr>
              </thead>
              <tbody>
                {[...flockExpenses]
                  .sort((a, b) => String(a.date).localeCompare(String(b.date)))
                  .map((e) => (
                    <tr key={e.id} className="border-b border-stone-100">
                      <td className="py-2 px-3">{formatDate(e.date, lang === 'ar' ? 'ar' : 'en-GB')}</td>
                      <td className="py-2 px-3">
                        <span className="inline-block w-2 h-2 rounded-full me-2 align-middle" style={{
                          background: EXPENSE_TYPES.find((x) => x.id === e.type)?.color || '#888',
                        }} />
                        {t(`type.${e.type}`)}
                        {e.sheepLost > 0 && (
                          <span className="ms-1.5 text-xs text-red-600">(-{e.sheepLost})</span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-end font-semibold">{formatMoney(e.amount)}</td>
                      <td className="py-2 px-3 text-stone-600 truncate max-w-[200px]">{e.note || '—'}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
            </div>
          </section>
        )}

        {/* Notes */}
        {flock.notes && (
          <section className="mb-7 avoid-break">
            <SectionTitle>{t('report.notes')}</SectionTitle>
            <p className="text-sm text-stone-700 whitespace-pre-wrap">{flock.notes}</p>
          </section>
        )}

        {/* Footer */}
        <footer className="pt-5 mt-8 border-t border-stone-200 text-xs text-stone-400 flex items-center justify-between">
          <div>{t('app.name')} · {t('report.footer')}</div>
          <div>{today}</div>
        </footer>
      </div>

      {/* Force light-theme colors inside the report so dark-mode body text
          can't bleed into elements that inherit color. */}
      <style>{`
        .report-root { color-scheme: light; }
        .report-root, .report-root .report-page { color: #1c1917; background-clip: padding-box; }
      `}</style>

      {/* Print styles */}
      <style>{`
        @media print {
          @page { size: A4; margin: 12mm; }

          /* Force colors to print — fixes gray charts. */
          *, *::before, *::after {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
          }

          /* Kill all scrollbars during print. */
          html, body {
            background: #fff !important;
            overflow: visible !important;
            height: auto !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          *::-webkit-scrollbar { display: none !important; width: 0 !important; height: 0 !important; }
          * { scrollbar-width: none !important; -ms-overflow-style: none !important; }

          .no-print { display: none !important; }
          .avoid-break { break-inside: avoid; page-break-inside: avoid; }

          .report-page {
            box-shadow: none !important;
            margin: 0 !important;
            padding: 0 !important;
            max-width: none !important;
            width: 100% !important;
            overflow: visible !important;
          }

          /* Recharts wraps its SVG in a div with overflow:hidden — let it
             render naturally during print so charts aren't clipped. */
          .recharts-wrapper, .recharts-responsive-container {
            overflow: visible !important;
            width: 100% !important;
          }

          table { page-break-inside: auto; }
          tr { page-break-inside: avoid; page-break-after: auto; }
        }
      `}</style>
    </div>
  )
}

function KpiCard({ label, value, tone = 'neutral' }) {
  const tones = {
    neutral: 'bg-stone-50 border-stone-200 text-stone-900',
    brand:   'bg-brand-50 border-brand-200 text-brand-900',
    good:    'bg-emerald-50 border-emerald-200 text-emerald-900',
    bad:     'bg-red-50 border-red-200 text-red-900',
  }
  return (
    <div className={`rounded-xl border-2 p-3 ${tones[tone]} print:border print:rounded-lg`}>
      <div className="text-[10px] uppercase tracking-wider opacity-70">{label}</div>
      <div className="text-lg font-bold mt-1 truncate">{value}</div>
    </div>
  )
}

function MiniStat({ label, value, tone = 'neutral' }) {
  const accents = {
    neutral: 'text-stone-900',
    bad: 'text-red-700',
  }
  return (
    <div className="rounded-lg bg-stone-50 print:bg-white print:border print:border-stone-200 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-stone-500">{label}</div>
      <div className={`text-base font-bold ${accents[tone]}`}>{value}</div>
    </div>
  )
}

function SectionTitle({ children }) {
  return (
    <h2 className="text-xs font-bold uppercase tracking-widest text-stone-500 mb-3 pb-1 border-b border-stone-200">
      {children}
    </h2>
  )
}

function FactRow({ label, value, highlight }) {
  return (
    <div className={`flex justify-between gap-3 py-1 ${highlight ? 'font-semibold text-stone-900' : 'text-stone-700'}`}>
      <span className="text-stone-500">{label}</span>
      <span>{value}</span>
    </div>
  )
}

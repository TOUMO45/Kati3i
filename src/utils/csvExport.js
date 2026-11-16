// Build a multi-sheet Excel workbook (.xlsx) for a single flock and trigger
// a browser download. Uses SheetJS (xlsx). Each section gets its own sheet:
// Summary, Expenses, Sales, Weights. Column widths and number formats are
// applied so the file is presentable on first open in Excel/Numbers/Sheets.
import * as XLSX from 'xlsx'
import {
  totalInvested, totalSheepLost, liveSheepCount,
  currentCostPerSheep, currentValue, holdingDays, roi, totalExpenses,
  totalRevenue, totalRealizedProfit, currentAvgWeight,
} from './calculations'

const MONEY_FMT = '#,##0.00'
const INT_FMT   = '#,##0'
const PCT_FMT   = '0.00'

function setCols(ws, widths) {
  ws['!cols'] = widths.map((w) => ({ wch: w }))
}

// Walk every cell and apply a number format to numeric cells in the columns
// passed in `numericCols` (1-based column indexes).
function formatNumericCells(ws, numericCols, format) {
  const ref = ws['!ref']
  if (!ref) return
  const range = XLSX.utils.decode_range(ref)
  for (let r = range.s.r; r <= range.e.r; r++) {
    for (const c of numericCols) {
      const addr = XLSX.utils.encode_cell({ r, c: c - 1 })
      const cell = ws[addr]
      if (cell && cell.t === 'n') cell.z = format
    }
  }
}

function buildSummarySheet(flock, flockExpenses, flockSales, flockWeights) {
  const invested = totalInvested(flock, flockExpenses)
  const expSum   = totalExpenses(flockExpenses, flock.id)
  const lost     = totalSheepLost(flockExpenses, flock.id)
  const live     = liveSheepCount(flock, flockExpenses)
  const cps      = currentCostPerSheep(flock, flockExpenses)
  const value    = currentValue(flock, flockExpenses)
  const days     = holdingDays(flock)
  const flockRoi = roi(flock, flockExpenses)
  const revenue  = totalRevenue(flockSales) +
    (flock.status === 'sold' ? Number(flock.soldPrice || 0) : 0)
  const profit   = totalRealizedProfit(flockSales) +
    (flock.status === 'sold' ? (Number(flock.soldPrice || 0) - invested) : 0)

  const rows = [
    ['Flock Report', flock.name],
    ['Exported at', new Date().toISOString().slice(0, 19).replace('T', ' ')],
    [],
    ['Field', 'Value'],
    ['Name', flock.name],
    ['Livestock type', flock.livestockType || 'sheep'],
    ['Status', flock.status || 'active'],
    ['Buy date', flock.buyDate || ''],
    ['Holding days', days],
    ['Initial count', Number(flock.initialCount || 0)],
    ['Dead', lost],
    ['Sold', Number(flock.soldCount || 0)],
    ['Live', live],
    ['Initial avg weight (KG)', Number(flock.initialAvgWeight || 0)],
    ['Current avg weight (KG)', currentAvgWeight(flock, flockWeights)],
    ['Buy price', Number(flock.buyPrice || 0)],
    ['Total expenses', expSum],
    ['Total invested', invested],
    ['Current cost per animal', cps],
    ['Current value', value],
    ['Revenue (sales)', revenue],
    ['Realized profit', profit],
    ['ROI (%)', flockRoi],
  ]
  const ws = XLSX.utils.aoa_to_sheet(rows)
  setCols(ws, [28, 22])
  formatNumericCells(ws, [2], MONEY_FMT)
  return ws
}

function buildExpensesSheet(flockExpenses) {
  const sorted = [...flockExpenses].sort((a, b) =>
    String(a.date || '').localeCompare(String(b.date || ''))
  )
  const rows = [
    ['Date', 'Type', 'Amount', 'Sheep lost', 'Note'],
    ...sorted.map((e) => [
      e.date || '',
      e.type || '',
      Number(e.amount || 0),
      Number(e.sheepLost || 0),
      e.note || '',
    ]),
  ]
  const ws = XLSX.utils.aoa_to_sheet(rows)
  setCols(ws, [12, 12, 14, 12, 40])
  formatNumericCells(ws, [3], MONEY_FMT)
  formatNumericCells(ws, [4], INT_FMT)
  return ws
}

function buildSalesSheet(flockSales) {
  const sorted = [...flockSales].sort((a, b) =>
    String(a.saleDate || '').localeCompare(String(b.saleDate || ''))
  )
  const rows = [
    ['Date', 'Type', 'Quantity', 'Price/animal', 'Total price',
      'Cost/animal at sale', 'Investment cost', 'Revenue', 'Profit', 'Notes'],
    ...sorted.map((s) => [
      s.saleDate || '',
      s.saleType || '',
      Number(s.quantitySold || 0),
      Number(s.pricePerSheep || 0),
      Number(s.totalPrice || 0),
      Number(s.costPerSheepAtSale || 0),
      Number(s.investmentCost || 0),
      Number(s.revenue || 0),
      Number(s.profit || 0),
      s.notes || '',
    ]),
  ]
  const ws = XLSX.utils.aoa_to_sheet(rows)
  setCols(ws, [12, 10, 10, 14, 16, 18, 16, 16, 16, 30])
  formatNumericCells(ws, [3], INT_FMT)
  formatNumericCells(ws, [4, 5, 6, 7, 8, 9], MONEY_FMT)
  return ws
}

function buildWeightsSheet(flockWeights) {
  const sorted = [...flockWeights].sort((a, b) =>
    String(a.date || '').localeCompare(String(b.date || ''))
  )
  const rows = [
    ['Date', 'Avg weight (KG)', 'Notes'],
    ...sorted.map((w) => [w.date || '', Number(w.avgWeight || 0), w.notes || '']),
  ]
  const ws = XLSX.utils.aoa_to_sheet(rows)
  setCols(ws, [12, 18, 40])
  formatNumericCells(ws, [2], MONEY_FMT)
  return ws
}

function safeFilename(s) {
  return String(s || 'flock').replace(/[^\w؀-ۿ.-]+/g, '_').slice(0, 60)
}

export function exportFlockCsv({ flock, expenses, sales, weights }) {
  const flockExpenses = expenses.filter((e) => e.flockId === flock.id)
  const flockSales    = sales.filter((s) => s.flockId === flock.id)
  const flockWeights  = weights.filter((w) => w.flockId === flock.id)

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, buildSummarySheet(flock, flockExpenses, flockSales, flockWeights), 'Summary')
  XLSX.utils.book_append_sheet(wb, buildExpensesSheet(flockExpenses), 'Expenses')
  XLSX.utils.book_append_sheet(wb, buildSalesSheet(flockSales), 'Sales')
  XLSX.utils.book_append_sheet(wb, buildWeightsSheet(flockWeights), 'Weights')

  const today = new Date().toISOString().slice(0, 10)
  XLSX.writeFile(wb, `${safeFilename(flock.name)}_${today}.xlsx`)
}

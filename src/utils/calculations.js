// Pure calculation helpers — no Firebase, no React. Easy to test.
//
// Data shapes:
//   flock = { id, name, initialCount, buyPrice, buyDate, status: 'active'|'sold',
//             soldPrice?, soldDate?, notes?, archived?: boolean,
//             soldCount?: number }   // cumulative sheep sold (default 0)
//   expense = { id, flockId, type, amount, date, note?, sheepLost?: number }
//   sale    = { id, flockId, flockName, saleType: 'full'|'partial',
//               quantitySold, pricePerSheep?, totalPrice?,
//               costPerSheepAtSale, investmentCost, revenue, profit,
//               saleDate, createdAt, notes? }
//
// expense.type ∈ 'food' | 'water' | 'medicine' | 'transport' | 'death' | 'other'
// 'death' expenses may also carry sheepLost (count of animals lost on that record).
//
// Labels live in src/i18n/translations.js (keyed by `type.<id>`) so they can be
// translated at the UI layer. Components call useLocale().t(`type.${type.id}`).
//
// Archived flocks (archived === true) are excluded from portfolio totals and
// from expense breakdowns — they exist only in the Archive for historical
// reference. Per-flock calculations still work for archived flocks when called
// directly with their own data.

export const EXPENSE_TYPES = [
  { id: 'food',      color: '#f59e0b', icon: 'Wheat' },
  { id: 'water',     color: '#06b6d4', icon: 'Droplet' },
  { id: 'medicine',  color: '#0ea5e9', icon: 'Pill'  },
  { id: 'transport', color: '#8b5cf6', icon: 'Truck' },
  { id: 'worker',    color: '#10b981', icon: 'HardHat' },
  { id: 'death',     color: '#ef4444', icon: 'Skull' },
  { id: 'other',     color: '#64748b', icon: 'MoreHorizontal' },
]

export function isArchived(flock) {
  return !!(flock && flock.archived)
}

export function visibleFlocks(flocks) {
  return flocks.filter((f) => !f.archived)
}

// ─────────────────────── Per-expense helpers ───────────────────────

export function totalExpenses(expenses, flockId) {
  return expenses
    .filter((e) => e.flockId === flockId)
    .reduce((sum, e) => sum + Number(e.amount || 0), 0)
}

export function totalSheepLost(expenses, flockId) {
  return expenses
    .filter((e) => e.flockId === flockId && e.type === 'death')
    .reduce((sum, e) => sum + Number(e.sheepLost || 0), 0)
}

// ─────────────────────── Sheep counts ───────────────────────

// Living animals = initialCount - deaths (via death expenses) - soldCount.
// Tracks how many are physically alive AND still in inventory (not yet sold).
export function liveSheepCount(flock, expenses) {
  if (!flock) return 0
  const lost = totalSheepLost(expenses, flock.id)
  const sold = Number(flock.soldCount || 0)
  return Math.max(0, Number(flock.initialCount || 0) - lost - sold)
}

// Cost-basis denominator per the business rule:
//   originalCount - deaths   (sold animals are NOT subtracted)
// This is what currentCostPerAnimal divides by so that selling animals
// doesn't shift the per-animal cost.
export function costBasisCount(flock, expenses) {
  if (!flock) return 0
  const lost = totalSheepLost(expenses, flock.id)
  return Math.max(0, Number(flock.initialCount || 0) - lost)
}

// ─────────────────────── Investment math ───────────────────────

// Total amount invested in the flock so far = purchase price + every expense.
// (Includes death expenses; a death is a real cost that contributes to the
//  total sunk investment in the surviving animals.)
export function totalInvested(flock, expenses) {
  return Number(flock.buyPrice || 0) + totalExpenses(expenses, flock.id)
}

// Cost per animal — business rule:
//   CostPerAnimal = (PurchasePrice + TotalExpenses) / (OriginalCount - Deaths)
//
// CRITICAL: the denominator uses costBasisCount, NOT liveSheepCount. That
// means selling animals does NOT change the cost per animal — only new
// expenses, deaths, or edits to purchase data move this number. This
// matches how a herder actually thinks: the cost spent per animal is
// locked in by the underlying economics, regardless of how many you've
// sold off.
export function currentCostPerSheep(flock, expenses) {
  const denom = costBasisCount(flock, expenses)
  if (!denom) return 0
  return totalInvested(flock, expenses) / denom
}

// Break-even price per sheep — by definition equals current cost per sheep.
// Selling at this price recovers exactly the invested amount; above is profit,
// below is loss.
export const breakEvenPrice = currentCostPerSheep

// Book value of unsold (still-living) sheep = currentCostPerSheep × livingCount.
// Algebraically equals totalInvested for a single flock, but useful as a
// semantic label on the dashboard so the user sees what capital is still tied
// up in live inventory.
export function unsoldInvestmentValue(flock, expenses) {
  return currentCostPerSheep(flock, expenses) * liveSheepCount(flock, expenses)
}

// ─────────────────────── Value & profit ───────────────────────
//
// How profit is defined everywhere in the app:
//
//   • Unsold animals are carried AT COST, so on their own they are neither a
//     profit nor a loss.
//   • Profit is therefore what the flock's recorded sales earned: the sum of
//     each sale's (revenue − cost of the animals sold).
//   • A "legacy" sold flock (status 'sold' + soldPrice, closed before the
//     sales collection existed, so it has NO sale records) falls back to
//     soldPrice − totalInvested.
//
// A flock is counted through its sale records OR through the legacy
// soldPrice path — never both. (Counting both doubled the revenue and the
// profit of every flock closed with a recorded sale.)

export function salesForFlock(sales, flockId) {
  return (sales || []).filter((s) => s.flockId === flockId)
}

function isLegacySold(flock, flockSales) {
  return flock.status === 'sold' && flockSales.length === 0
}

// Money received for this flock so far.
export function flockRevenue(flock, sales) {
  const own = salesForFlock(sales, flock.id)
  if (own.length) return totalRevenue(own)
  return isLegacySold(flock, own) ? Number(flock.soldPrice || 0) : 0
}

// Part of the investment already recovered through sales.
export function flockRecovered(flock, expenses, sales) {
  const own = salesForFlock(sales, flock.id)
  if (own.length) return totalInvestmentRecovered(own)
  return isLegacySold(flock, own) ? totalInvested(flock, expenses) : 0
}

// Investment still tied up in the flock (not yet recovered by a sale).
export function remainingInvestment(flock, expenses, sales) {
  return Math.max(0, totalInvested(flock, expenses) - flockRecovered(flock, expenses, sales))
}

// Profit the flock has made so far (negative = loss).
export function flockProfit(flock, expenses, sales) {
  const own = salesForFlock(sales, flock.id)
  if (own.length) return totalRealizedProfit(own)
  return isLegacySold(flock, own)
    ? Number(flock.soldPrice || 0) - totalInvested(flock, expenses)
    : 0
}

// For active flocks: unsold animals at cost (avg cost per animal × live count).
// For sold flocks: everything the flock was sold for.
export function currentValue(flock, expenses, sales = []) {
  if (flock.status === 'sold') return flockRevenue(flock, sales)
  return currentCostPerSheep(flock, expenses) * liveSheepCount(flock, expenses)
}

export function roi(flock, expenses, sales = []) {
  const invested = totalInvested(flock, expenses)
  if (!invested) return 0
  return (flockProfit(flock, expenses, sales) / invested) * 100
}

// ─────────────────────── Sales aggregation (new) ───────────────────────

// ─────────────────────── Generic livestock aliases ───────────────────────
//
// The app started as sheep-only and the original helpers carry "sheep" in
// their names. The app now supports goats, cows, and camels too — these
// generic-named exports point at the same functions so new code (and any
// future refactor) can use livestock-agnostic terminology without breaking
// existing call sites.

export const liveAnimalCount       = liveSheepCount
export const currentCostPerAnimal  = currentCostPerSheep
export const totalAnimalsLost      = totalSheepLost

// Sales aggregate aliases (defined below; assigned in module-level export
// statements once those functions exist).

// Sum of revenue across every sale in the array.
export function totalRevenue(sales) {
  return (sales || []).reduce((s, x) => s + Number(x.revenue || 0), 0)
}

// Sum of realized profit across every sale. This is the authoritative
// "realized profit" figure once sales are recorded in the sales collection.
export function totalRealizedProfit(sales) {
  return (sales || []).reduce((s, x) => s + Number(x.profit || 0), 0)
}

// Sum of investment cost recovered through sales.
export function totalInvestmentRecovered(sales) {
  return (sales || []).reduce((s, x) => s + Number(x.investmentCost || 0), 0)
}

// Total quantity sold across all sales in the array.
export function totalSheepSold(sales) {
  return (sales || []).reduce((s, x) => s + Number(x.quantitySold || 0), 0)
}

// Generic alias — works for any livestock type.
export const totalAnimalsSold = totalSheepSold

// ─────────────────────── Weight tracking ───────────────────────
//
// Each flock can optionally carry an `initialAvgWeight` (KG) and a chain of
// weight records in the `weights` collection. The "current average weight"
// is the most recent record's avgWeight, falling back to initialAvgWeight,
// then to 0 if neither has been set.
//
// weight = { id, flockId, avgWeight, date, notes?, createdAt }

export function currentAvgWeight(flock, weights) {
  if (!flock) return 0
  const flockWeights = (weights || []).filter((w) => w.flockId === flock.id)
  if (flockWeights.length > 0) {
    // Most recent record wins. Sort descending by date, then createdAt.
    const sorted = [...flockWeights].sort((a, b) => {
      const cmpDate = String(b.date || '').localeCompare(String(a.date || ''))
      if (cmpDate !== 0) return cmpDate
      // createdAt is a Firestore Timestamp or null. Compare millis when both
      // exist, otherwise leave order alone.
      const am = a.createdAt?.toMillis?.() || 0
      const bm = b.createdAt?.toMillis?.() || 0
      return bm - am
    })
    return Number(sorted[0].avgWeight || 0)
  }
  return Number(flock.initialAvgWeight || 0)
}

// Total live weight (KG) = currentAvgWeight × liveAnimals.
export function totalLiveWeight(flock, expenses, weights) {
  return currentAvgWeight(flock, weights) * liveSheepCount(flock, expenses)
}

// Cost per kilogram = (PurchasePrice + TotalExpenses) / TotalLiveWeight.
// Returns 0 when total live weight is 0 (no weight recorded or no animals).
export function costPerKg(flock, expenses, weights) {
  const tlw = totalLiveWeight(flock, expenses, weights)
  if (!tlw) return 0
  return totalInvested(flock, expenses) / tlw
}

// ─────────────────────── Holding period ───────────────────────

export function holdingDays(flock) {
  const start = new Date(flock.buyDate)
  const end = flock.status === 'sold' && flock.soldDate
    ? new Date(flock.soldDate)
    : new Date()
  const ms = end - start
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)))
}

// ─────────────────────── Portfolio rollup (dashboard) ───────────────────────

// Aggregates totals across all NON-ARCHIVED flocks. `sales` may be the full
// list of sales; only those belonging to the given flocks are counted.
//
//   profit     = sum of every flock's profit (see flockProfit)
//   totalValue = totalInvested + profit
//              = money received from sales + investment still tied up in
//                unsold animals
//   roi        = profit / totalInvested
export function portfolioTotals(flocks, expenses, sales = []) {
  const active = visibleFlocks(flocks)
  const ids = new Set(active.map((f) => f.id))
  const own = (sales || []).filter((s) => ids.has(s.flockId))

  let totalInvestedAll = 0
  let unsoldInvestmentAll = 0
  let revenueAll = 0
  let recoveredAll = 0
  let profitAll = 0
  let activeCount = 0
  let soldCount = 0
  let sheepTotal = 0
  let activeInvested = 0
  let activeBasis = 0

  for (const f of active) {
    totalInvestedAll += totalInvested(f, expenses)
    revenueAll       += flockRevenue(f, own)
    recoveredAll     += flockRecovered(f, expenses, own)
    profitAll        += flockProfit(f, expenses, own)
    if (f.status === 'sold') {
      soldCount++
    } else {
      activeCount++
      sheepTotal          += liveSheepCount(f, expenses)
      unsoldInvestmentAll += unsoldInvestmentValue(f, expenses)
      activeInvested      += totalInvested(f, expenses)
      activeBasis         += costBasisCount(f, expenses)
    }
  }

  const roiAll = totalInvestedAll ? (profitAll / totalInvestedAll) * 100 : 0

  // Weighted average cost per animal across flocks that are still active.
  const avgCostPerSheep = activeBasis > 0 ? activeInvested / activeBasis : 0

  return {
    totalInvested: totalInvestedAll,
    totalValue: totalInvestedAll + profitAll,
    profit: profitAll,
    realized: profitAll,
    roi: roiAll,
    activeCount,
    soldCount,
    sheepTotal,
    currentCostPerSheep: avgCostPerSheep,
    breakEvenPrice: avgCostPerSheep,
    totalRevenue: revenueAll,
    salesRecovered: recoveredAll,
    totalSheepSold: totalSheepSold(own),
    unsoldInvestmentValue: unsoldInvestmentAll,
  }
}

// ─────────────────────── Expense breakdown (reports) ───────────────────────

// Excludes expenses belonging to archived flocks.
export function expenseBreakdown(expenses, flockId) {
  const subset = flockId
    ? expenses.filter((e) => e.flockId === flockId)
    : expenses
  const map = {}
  for (const e of subset) {
    map[e.type] = (map[e.type] || 0) + Number(e.amount || 0)
  }
  return EXPENSE_TYPES.map((t) => ({
    type: t.id,
    label: t.label,
    color: t.color,
    value: map[t.id] || 0,
  }))
}
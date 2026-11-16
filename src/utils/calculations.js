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

// Money actually spent on an expense record.
//
// A death record's `amount` is the VALUE of the animals lost (animals × cost
// each at that moment). It is not money paid out: that money is already inside
// the purchase price and the feed bills. Adding it again would count the dead
// animal twice and overstate every figure built on the investment — so a death
// counts as 0 here. Its effect on the survivors comes from the head count:
// the same money is now spread over fewer animals.
export function expenseAmount(expense) {
  if (!expense || expense.type === 'death') return 0
  return Number(expense.amount || 0)
}

export function totalExpenses(expenses, flockId) {
  return expenses
    .filter((e) => e.flockId === flockId)
    .reduce((sum, e) => sum + expenseAmount(e), 0)
}

// Value of the animals lost, as recorded on the death records (for display).
export function totalDeathLoss(expenses, flockId) {
  return expenses
    .filter((e) => e.flockId === flockId && e.type === 'death')
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

// Animals the flock's money was ever spread over = originalCount − deaths.
// Used for the lifetime average of a flock that has no animals left.
export function costBasisCount(flock, expenses) {
  if (!flock) return 0
  const lost = totalSheepLost(expenses, flock.id)
  return Math.max(0, Number(flock.initialCount || 0) - lost)
}

// ─────────────────────── Investment math ───────────────────────

// Total money put into the flock so far = purchase price + every cash expense.
// Deaths add nothing here (see expenseAmount).
export function totalInvested(flock, expenses) {
  return Number(flock.buyPrice || 0) + totalExpenses(expenses, flock.id)
}

// Cost per animal — weighted-average cost of the animals still in the flock:
//
//   (total invested − cost already charged to sales) ÷ live animals
//
// How it moves:
//   • a sale at this cost leaves it unchanged — the animals leave and take
//     their share of the cost with them;
//   • a new expense raises it, spread only over the animals still here
//     (feed bought after a sale is not charged to animals already gone);
//   • a death raises it — the same money is carried by fewer animals.
//
// A flock with no animals left (fully sold) shows its lifetime average:
// total invested ÷ (original count − deaths). The same lifetime average is the
// fallback when animals are marked sold but no sale records were supplied.
export function currentCostPerSheep(flock, expenses, sales = []) {
  if (!flock) return 0
  const live = liveSheepCount(flock, expenses)
  const own = salesForFlock(sales, flock.id)
  if (live > 0 && own.length) return remainingInvestment(flock, expenses, own) / live
  const denom = costBasisCount(flock, expenses)
  return denom ? totalInvested(flock, expenses) / denom : 0
}

// Break-even price per animal — equals the cost per animal. Selling the
// remaining animals at this price recovers exactly what is still tied up in
// them; above it is profit, below it is loss.
export const breakEvenPrice = currentCostPerSheep

// Money still tied up in the unsold animals = cost per animal × live animals.
export function unsoldInvestmentValue(flock, expenses, sales = []) {
  return currentCostPerSheep(flock, expenses, sales) * liveSheepCount(flock, expenses)
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
  return unsoldInvestmentValue(flock, expenses, sales)
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

// Cost per kilogram = money still tied up in the unsold animals ÷ their total
// live weight. Returns 0 when total live weight is 0 (no weight recorded or no
// animals).
export function costPerKg(flock, expenses, weights, sales = []) {
  const tlw = totalLiveWeight(flock, expenses, weights)
  if (!tlw) return 0
  return unsoldInvestmentValue(flock, expenses, sales) / tlw
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
      unsoldInvestmentAll += unsoldInvestmentValue(f, expenses, own)
    }
  }

  const roiAll = totalInvestedAll ? (profitAll / totalInvestedAll) * 100 : 0

  // Weighted average cost per unsold animal across flocks that are still active.
  const avgCostPerSheep = sheepTotal > 0 ? unsoldInvestmentAll / sheepTotal : 0

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

// Money spent per category. Death records count as 0 (see expenseAmount).
export function expenseBreakdown(expenses, flockId) {
  const subset = flockId
    ? expenses.filter((e) => e.flockId === flockId)
    : expenses
  const map = {}
  for (const e of subset) {
    map[e.type] = (map[e.type] || 0) + expenseAmount(e)
  }
  return EXPENSE_TYPES.map((t) => ({
    type: t.id,
    label: t.label,
    color: t.color,
    value: map[t.id] || 0,
  }))
}
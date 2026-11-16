// Sample data for demo mode. Everything here is invented — no real herd, buyer
// or price list. Dates are relative to "today" so the charts always look fresh.
//
// Sales and death records are derived with the app's own calculation helpers,
// replayed in date order, so the numbers on screen stay internally consistent
// (cost per animal frozen at sale time, death loss value = animals lost × cost
// per animal at that moment).
import { currentCostPerSheep, liveSheepCount, totalInvested, totalSheepLost } from '../utils/calculations.js'

const DAY = 24 * 60 * 60 * 1000
const now = Date.now()
const iso = (daysAgo) => new Date(now - daysAgo * DAY).toISOString().slice(0, 10)
const stampAt = (daysAgo) => {
  const ms = now - daysAgo * DAY
  return { toMillis: () => ms }
}

// One entry per flock. `events` is replayed oldest-first.
const PLAN = [
  {
    id: 'flock-rams',
    livestockType: 'SHEEP',
    name: 'Ouled Djellal Rams',
    initialCount: 40,
    unitPrice: 52000,
    boughtDaysAgo: 150,
    initialAvgWeight: 38,
    notes: 'Fattening batch bought at the Adrar weekly market.',
    events: [
      { d: 148, kind: 'expense', type: 'transport', amount: 28000, note: 'Truck from the market' },
      { d: 145, kind: 'expense', type: 'medicine', amount: 16000, note: 'Vaccination + deworming' },
      { d: 140, kind: 'expense', type: 'food', amount: 96000, note: 'Barley — 20 quintals' },
      { d: 120, kind: 'weight', avgWeight: 44, notes: 'First weigh-in' },
      { d: 118, kind: 'expense', type: 'worker', amount: 35000, note: 'Shepherd — monthly wage' },
      { d: 110, kind: 'expense', type: 'food', amount: 88000, note: 'Barley + bran' },
      { d: 104, kind: 'death', sheepLost: 1, note: 'Lost one ram to bloat' },
      { d: 92, kind: 'weight', avgWeight: 51 },
      { d: 88, kind: 'expense', type: 'worker', amount: 35000, note: 'Shepherd — monthly wage' },
      { d: 80, kind: 'expense', type: 'food', amount: 104000, note: 'Corn + alfalfa hay' },
      { d: 75, kind: 'expense', type: 'water', amount: 9000, note: 'Water tanker refill' },
      { d: 62, kind: 'weight', avgWeight: 58 },
      { d: 60, kind: 'sale', mode: 'partial', quantity: 12, pricePerSheep: 86000 },
      { d: 58, kind: 'expense', type: 'worker', amount: 35000, note: 'Shepherd — monthly wage' },
      { d: 45, kind: 'expense', type: 'food', amount: 72000, note: 'Barley — 15 quintals' },
      { d: 30, kind: 'weight', avgWeight: 63, notes: 'Ready for market' },
      { d: 26, kind: 'sale', mode: 'weight', quantity: 8, avgWeight: 63, pricePerKg: 1450 },
      { d: 12, kind: 'expense', type: 'food', amount: 54000, note: 'Finishing feed' },
      { d: 4, kind: 'weight', avgWeight: 66 },
    ],
  },
  {
    id: 'flock-eid',
    livestockType: 'SHEEP',
    name: 'Eid 2027 Lambs',
    initialCount: 60,
    unitPrice: 38000,
    boughtDaysAgo: 46,
    initialAvgWeight: 24,
    notes: 'Young lambs to raise for Eid al-Adha 2027.',
    events: [
      { d: 45, kind: 'expense', type: 'transport', amount: 32000, note: 'Two trips from Timimoun' },
      { d: 43, kind: 'expense', type: 'medicine', amount: 21000, note: 'Enterotoxemia vaccine' },
      { d: 40, kind: 'expense', type: 'food', amount: 110000, note: 'Starter feed' },
      { d: 28, kind: 'expense', type: 'worker', amount: 30000, note: 'Helper — monthly wage' },
      { d: 21, kind: 'weight', avgWeight: 29 },
      { d: 15, kind: 'expense', type: 'food', amount: 118000, note: 'Barley + concentrate' },
      { d: 9, kind: 'expense', type: 'water', amount: 12000, note: 'Water tanker refill' },
      { d: 2, kind: 'weight', avgWeight: 33 },
    ],
  },
  {
    id: 'flock-goats',
    livestockType: 'GOAT',
    name: 'Sahara Goats',
    initialCount: 25,
    unitPrice: 22000,
    boughtDaysAgo: 95,
    initialAvgWeight: 21,
    notes: '',
    events: [
      { d: 94, kind: 'expense', type: 'transport', amount: 12000, note: 'Pickup rental' },
      { d: 86, kind: 'expense', type: 'food', amount: 38000, note: 'Hay + date pits' },
      { d: 70, kind: 'expense', type: 'medicine', amount: 8500, note: 'Deworming' },
      { d: 55, kind: 'weight', avgWeight: 26 },
      { d: 50, kind: 'expense', type: 'food', amount: 41000, note: 'Hay + barley' },
      { d: 38, kind: 'sale', mode: 'partial', quantity: 9, pricePerSheep: 34500 },
      { d: 20, kind: 'expense', type: 'other', amount: 6000, note: 'Pen repair' },
      { d: 8, kind: 'weight', avgWeight: 30 },
    ],
  },
  {
    id: 'flock-camels',
    livestockType: 'CAMEL',
    name: 'Tanezrouft Camels',
    initialCount: 6,
    unitPrice: 310000,
    boughtDaysAgo: 210,
    initialAvgWeight: 380,
    notes: 'Long-hold herd.',
    events: [
      { d: 205, kind: 'expense', type: 'transport', amount: 45000, note: 'Livestock trailer' },
      { d: 170, kind: 'expense', type: 'food', amount: 82000, note: 'Fodder' },
      { d: 130, kind: 'expense', type: 'medicine', amount: 24000, note: 'Vet visit' },
      { d: 96, kind: 'weight', avgWeight: 415 },
      { d: 84, kind: 'expense', type: 'food', amount: 90000, note: 'Fodder' },
      { d: 35, kind: 'expense', type: 'worker', amount: 40000, note: 'Herder' },
      { d: 14, kind: 'weight', avgWeight: 442 },
    ],
  },
  {
    id: 'flock-spring',
    livestockType: 'SHEEP',
    name: 'Spring Flock',
    initialCount: 30,
    unitPrice: 44000,
    boughtDaysAgo: 300,
    initialAvgWeight: 35,
    notes: 'Sold in one lot before summer.',
    events: [
      { d: 298, kind: 'expense', type: 'transport', amount: 20000, note: 'Truck' },
      { d: 280, kind: 'expense', type: 'food', amount: 78000, note: 'Barley' },
      { d: 250, kind: 'expense', type: 'medicine', amount: 11000, note: 'Vaccination' },
      { d: 235, kind: 'expense', type: 'food', amount: 84000, note: 'Barley + hay' },
      { d: 215, kind: 'expense', type: 'worker', amount: 60000, note: 'Shepherd — two months' },
      { d: 200, kind: 'weight', avgWeight: 54 },
      { d: 190, kind: 'sale', mode: 'full', totalPrice: 2190000 },
    ],
  },
]

export function seed() {
  const flocks = []
  const expenses = []
  const sales = []
  const weights = []
  let n = 0
  const id = (p) => `${p}-${++n}`

  for (const plan of PLAN) {
    const flock = {
      id: plan.id,
      livestockType: plan.livestockType,
      name: plan.name,
      initialCount: plan.initialCount,
      buyPrice: plan.initialCount * plan.unitPrice,
      buyDate: iso(plan.boughtDaysAgo),
      initialAvgWeight: plan.initialAvgWeight,
      notes: plan.notes,
      status: 'active',
      archived: false,
      soldCount: 0,
      createdAt: stampAt(plan.boughtDaysAgo),
      updatedAt: stampAt(plan.boughtDaysAgo),
    }
    flocks.push(flock)

    const own = () => expenses.filter((e) => e.flockId === flock.id)
    const prior = () => sales.filter((s) => s.flockId === flock.id)
    const events = [...plan.events].sort((a, b) => b.d - a.d)

    for (const ev of events) {
      const date = iso(ev.d)
      const createdAt = stampAt(ev.d)

      if (ev.kind === 'expense') {
        expenses.push({
          id: id('exp'), flockId: flock.id, type: ev.type, amount: ev.amount,
          date, note: ev.note || '', sheepLost: 0, createdAt,
        })
      } else if (ev.kind === 'death') {
        const cps = currentCostPerSheep(flock, own(), prior())
        expenses.push({
          id: id('exp'), flockId: flock.id, type: 'death',
          amount: Number((cps * ev.sheepLost).toFixed(2)),
          date, note: ev.note || '', sheepLost: ev.sheepLost, createdAt,
        })
      } else if (ev.kind === 'weight') {
        weights.push({
          id: id('weight'), flockId: flock.id, avgWeight: ev.avgWeight,
          date, notes: ev.notes || null, createdAt,
        })
      } else if (ev.kind === 'sale') {
        const live = liveSheepCount(flock, own())
        const cps = currentCostPerSheep(flock, own(), prior())
        let quantity, revenue, investment, pricePerSheep
        if (ev.mode === 'full') {
          quantity = live
          revenue = ev.totalPrice
          investment = totalInvested(flock, own()) - prior().reduce((a, s) => a + s.investmentCost, 0)
          pricePerSheep = live ? revenue / live : 0
        } else if (ev.mode === 'partial') {
          quantity = ev.quantity
          revenue = ev.quantity * ev.pricePerSheep
          investment = cps * ev.quantity
          pricePerSheep = ev.pricePerSheep
        } else {
          quantity = ev.quantity
          revenue = ev.quantity * ev.avgWeight * ev.pricePerKg
          investment = cps * ev.quantity
          pricePerSheep = revenue / ev.quantity
        }
        sales.push({
          id: id('sale'),
          flockId: flock.id,
          flockName: flock.name,
          saleType: ev.mode,
          saleMethod: ev.mode === 'weight' ? 'WEIGHT' : 'QUANTITY',
          quantitySold: quantity,
          pricePerSheep,
          totalPrice: ev.mode === 'full' ? ev.totalPrice : null,
          costPerSheepAtSale: cps,
          investmentCost: investment,
          revenue,
          profit: revenue - investment,
          saleDate: date,
          avgWeight: ev.mode === 'weight' ? ev.avgWeight : null,
          totalWeight: ev.mode === 'weight' ? ev.quantity * ev.avgWeight : null,
          pricePerKg: ev.mode === 'weight' ? ev.pricePerKg : null,
          createdAt,
        })
        flock.soldCount += quantity
        if (ev.mode === 'full' || live - quantity <= 0) {
          flock.status = 'sold'
          flock.soldDate = date
          flock.soldPrice = revenue
          flock.soldCount = flock.initialCount - totalSheepLost(own(), flock.id)
        }
      }
    }
  }

  return { flocks, expenses, sales, weights }
}

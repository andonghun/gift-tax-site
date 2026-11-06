// 증여세·상속세 계산기. src/tax.ts와 같은 식이며 test/calc.test.ts가 두 결과를 비교한다.
var EOK = 100000000
var MAN = 10000
var BRACKETS = [[1 * EOK, 10, 0], [5 * EOK, 20, 1000 * MAN], [10 * EOK, 30, 6000 * MAN], [30 * EOK, 40, 16000 * MAN], [Infinity, 50, 46000 * MAN]]
var DEDUCTION = { spouse: 6 * EOK, adultChild: 5000 * MAN, minorChild: 2000 * MAN, grandchild: 5000 * MAN, minorGrandchild: 2000 * MAN, parent: 5000 * MAN, relative: 1000 * MAN }
var FROM_ASCENDANT = { adultChild: 1, minorChild: 1, grandchild: 1, minorGrandchild: 1 }

function rateTax(base) {
  if (base <= 0) return 0
  for (var i = 0; i < BRACKETS.length; i++) {
    if (base <= BRACKETS[i][0]) return Math.floor((base * BRACKETS[i][1]) / 100) - BRACKETS[i][2]
  }
  return 0
}

function finish(amount, deduction, base, percent) {
  var computed = rateTax(base)
  var surcharge = Math.floor((computed * percent) / 100)
  var credit = Math.floor(((computed + surcharge) * 3) / 100)
  var payable = Math.floor((computed + surcharge - credit) / 10) * 10
  return { amount: amount, deduction: deduction, taxBase: base, computed: computed, surcharge: surcharge, credit: credit, payable: payable }
}

function giftTax(amount, relation, marriage) {
  var deduction = DEDUCTION[relation] + (marriage && FROM_ASCENDANT[relation] ? EOK : 0)
  var raw = Math.max(0, amount - deduction)
  var base = raw < 50 * MAN ? 0 : raw
  var percent = relation === 'grandchild' ? 30 : relation === 'minorGrandchild' ? (amount > 20 * EOK ? 40 : 30) : 0
  return finish(amount, deduction, base, percent)
}

function inheritanceTax(estate, spouse) {
  var deduction = Math.min(estate, 5 * EOK + (spouse ? 5 * EOK : 0))
  return finish(estate, deduction, estate - deduction, 0)
}

function filingDeadline(date, months) {
  var p = date.split('-')
  return new Date(Date.UTC(Number(p[0]), Number(p[1]) - 1 + months + 1, 0)).toISOString().slice(0, 10)
}

function korean(n) {
  var eok = Math.floor(n / EOK)
  var man = Math.floor((n % EOK) / MAN)
  var rest = n % MAN
  var parts = []
  if (eok) parts.push(eok.toLocaleString('ko-KR') + '억')
  if (man) parts.push(man.toLocaleString('ko-KR') + '만')
  if (rest) parts.push(rest.toLocaleString('ko-KR'))
  if (!parts.length) return '0원'
  return parts.join(' ') + (rest ? '원' : ' 원')
}

// 만 원 칸에 넣은 글자를 만 원 단위 수로 읽는다. "1억 5천", "1억5000", "2천", "15,000", "1.5", "500만" 모두 읽는다.
function parseManwon(text) {
  var s = String(text).replace(/[\s,원]/g, '').replace(/만$/, '')
  var m = s.match(/^(?:([0-9.]+)억)?(?:([0-9.]+)천)?(?:([0-9.]+)백)?([0-9.]+)?$/)
  var v = m ? (m[1] ? parseFloat(m[1]) * 10000 : 0) + (m[2] ? parseFloat(m[2]) * 1000 : 0) + (m[3] ? parseFloat(m[3]) * 100 : 0) + (m[4] ? parseFloat(m[4]) : 0) : Number(s.replace(/[^0-9.]/g, ''))
  return v > 0 ? v : 0
}

function readManwon(input) {
  return Math.round(parseManwon(input.value) * MAN)
}

// 결과 칸: 큰 금액 한 줄과 계산 단계 몇 줄. 넣는 글자는 숫자·고정 문구뿐이라 innerHTML로 그린다.
function line(label, value) {
  return '<span>' + label + '<b>' + value + '</b></span>'
}

function render(out, kind, t) {
  var name = kind === 'gift' ? '증여세' : '상속세'
  if (!t.amount) { out.innerHTML = '금액을 넣으면 계산합니다.'; return }
  var lines = [line('공제', korean(t.deduction)), line('과세표준', korean(t.taxBase)), line('산출세액', korean(t.computed))]
  if (t.surcharge) lines.push(line('세대생략 할증', korean(t.surcharge)))
  if (t.credit) lines.push(line('신고세액공제 3%', korean(t.credit)))
  out.innerHTML = '<span class="res-label">' + name + '</span><span class="res-total">' + (t.payable ? korean(t.payable) : '없음') + '</span><span class="res-lines">' + lines.join('') + '</span>'
}

function bindGift(form) {
  var update = function () {
    var e = form.elements
    render(e.result, 'gift', giftTax(readManwon(e.amount), e.relation.value, e.marriage.checked))
  }
  form.addEventListener('input', update)
  form.addEventListener('change', update)
  update()
}

function bindInherit(form) {
  var update = function () {
    var e = form.elements
    render(e.result, 'inherit', inheritanceTax(readManwon(e.amount), e.spouse.checked))
  }
  form.addEventListener('input', update)
  form.addEventListener('change', update)
  update()
}

function bindDeadline(form) {
  var update = function () {
    var d = form.elements.date.value
    form.elements.result.value = /^\d{4}-\d{2}-\d{2}$/.test(d) ? '증여세 ' + filingDeadline(d, 3) + '까지, 상속세 ' + filingDeadline(d, 6) + '까지' : '날짜를 고르면 계산합니다.'
  }
  form.addEventListener('input', update)
  form.addEventListener('change', update)
  update()
}

// 부가세 계산기. src/vat.ts와 같은 식이며 test/calc.test.ts가 두 결과를 비교한다.
var CARD_CREDIT = { 2026: { permille: 13, cap: 1000 * MAN }, 2027: { permille: 10, cap: 500 * MAN } }
var E_FILING_CREDIT = 5000
var VA_PERCENT = { retail: 15, manufacturing: 20, lodging: 25, construction: 30, professional: 40, service: 30 }
var EXEMPT_BELOW = 4800 * MAN

function fromSupply(supply) {
  var s = Math.max(0, Math.floor(supply))
  var vat = Math.round(s / 10)
  return { supply: s, vat: vat, total: s + vat }
}

function fromTotal(total) {
  var t = Math.max(0, Math.floor(total))
  var supply = Math.round((t * 10) / 11)
  return { supply: supply, vat: t - supply, total: t }
}

function deemedRate(kind, base, year) {
  if (kind === 'restaurant') return base <= 2 * EOK && year === 2026 ? [9, 109] : [8, 108]
  if (kind === 'bakery') return [6, 106]
  if (kind === 'manufacturer') return [4, 104]
  return [2, 102]
}

function deemedLimitPercent(kind, base) {
  if (kind === 'restaurant') return base <= 1 * EOK ? 75 : base <= 2 * EOK ? 70 : 60
  return base <= 2 * EOK ? 65 : 55
}

function deemedCredit(kind, purchase, base, year) {
  var rate = deemedRate(kind, base, year)
  var limitPercent = deemedLimitPercent(kind, base)
  var counted = Math.min(Math.max(0, purchase), Math.floor((base * limitPercent) / 100))
  return { purchase: purchase, counted: counted, rate: rate, limitPercent: limitPercent, credit: Math.floor((counted * rate[0]) / rate[1]) }
}

function cardCreditOf(cardSales, eligible, used, year) {
  var c = CARD_CREDIT[year]
  var raw = eligible ? Math.floor((Math.max(0, cardSales) * c.permille) / 1000) : 0
  return { raw: raw, cap: Math.max(0, c.cap - Math.max(0, used)) }
}

function generalVat(i) {
  var sales = Math.max(0, i.sales)
  var outputTax = Math.floor(sales / 10)
  var inputTax = Math.floor(Math.max(0, i.purchases) / 10)
  var deemed = i.deemed && i.deemed.purchase > 0 ? deemedCredit(i.deemed.kind, i.deemed.purchase, sales, i.year) : null
  var payable = outputTax - inputTax - (deemed ? deemed.credit : 0)
  var eFilingCredit = i.eFiling && (sales > 0 || i.purchases > 0) ? E_FILING_CREDIT : 0
  var before = Math.max(0, payable - eFilingCredit)
  var card = cardCreditOf(i.cardSales, i.cardEligible, i.cardUsed || 0, i.year)
  var credit = Math.min(card.raw, card.cap, before)
  var prepaid = Math.max(0, i.prepaid)
  return { outputTax: outputTax, inputTax: inputTax, deemed: deemed, payable: payable, eFilingCredit: eFilingCredit, cardCredit: credit, cardRaw: card.raw, prepaid: prepaid, final: payable - eFilingCredit - credit - prepaid }
}

function simplifiedVat(i) {
  var supply = Math.max(0, i.supply)
  var months = Math.min(12, Math.max(1, Math.ceil(i.months)))
  var annualized = months < 12 ? Math.floor((supply * 12) / months) : supply
  var exempt = annualized < EXEMPT_BELOW
  var prepaid = Math.max(0, i.prepaid)
  var card = cardCreditOf(i.cardSales, i.cardEligible, i.cardUsed || 0, i.year)
  if (exempt) return { annualized: annualized, exempt: exempt, computed: 0, purchaseCredit: 0, cardCredit: 0, cardRaw: card.raw, eFilingCredit: 0, payable: 0, prepaid: prepaid, final: -prepaid }
  var computed = Math.floor((supply * VA_PERCENT[i.industry]) / 1000)
  var purchaseCredit = Math.min(Math.floor((Math.max(0, i.purchases) * 5) / 1000), computed)
  var eFilingCredit = i.eFiling ? Math.min(E_FILING_CREDIT, computed - purchaseCredit) : 0
  var credit = Math.min(card.raw, card.cap, computed - purchaseCredit - eFilingCredit)
  var payable = computed - purchaseCredit - eFilingCredit - credit
  return { annualized: annualized, exempt: exempt, computed: computed, purchaseCredit: purchaseCredit, cardCredit: credit, cardRaw: card.raw, eFilingCredit: eFilingCredit, payable: payable, prepaid: prepaid, final: payable - prepaid }
}

// 개월 수: "6.5"는 6.5로 읽고 엔진이 1개월 미만 끝수를 올린다(제69조③). 비었거나 0이면 12개월.
function readMonths(input) {
  var n = parseFloat(String(input.value).replace(/[^0-9.]/g, ''))
  return n > 0 ? n : 12
}

// 원 칸에 넣은 글자를 원 단위 수로 읽는다. "1,100,000", "110만", "3.3만", "5천", "1억 2천만" 모두 읽는다.
// 억 뒤에 만이 없으면("1억 2천", "1억5000") 흔히 쓰는 대로 만 단위로 본다.
function underMan(g) {
  var m = g.match(/^(?:([0-9.]*)천)?(?:([0-9.]*)백)?([0-9.]+)?$/)
  if (!m) return NaN
  var unit = function (x, k) { return x === undefined ? 0 : (x === '' ? 1 : parseFloat(x)) * k }
  return unit(m[1], 1000) + unit(m[2], 100) + (m[3] ? parseFloat(m[3]) : 0)
}

function parseWon(text) {
  var s = String(text).replace(/[\s,원]/g, '')
  var m = s.match(/^(?:([^억]*)억)?(?:([^만]*)만)?(.*)$/)
  var group = function (x, k) { return x === undefined ? 0 : (x === '' ? k : underMan(x) * k) }
  var rest = m[1] !== undefined && m[2] === undefined ? underMan(m[3]) * MAN : underMan(m[3])
  var v = group(m[1], EOK) + group(m[2], MAN) + rest
  return v > 0 ? Math.round(v) : 0
}

function readWon(input) {
  return parseWon(input.value)
}

function totalBlock(label, amount, lines) {
  return '<span class="res-label">' + label + '</span><span class="res-total">' + amount + '</span><span class="res-lines">' + lines.join('') + '</span>'
}

function bindVatSplit(form) {
  var update = function () {
    var e = form.elements
    var n = readWon(e.amount)
    if (!n) { e.result.innerHTML = '금액을 넣으면 계산합니다.'; return }
    var s = e.kind.value === 'supply' ? fromSupply(n) : fromTotal(n)
    e.result.innerHTML = totalBlock('부가세', korean(s.vat), [line('공급가액', korean(s.supply)), line('부가세 10%', korean(s.vat)), line('합계', korean(s.total))])
  }
  form.addEventListener('input', update)
  form.addEventListener('change', update)
  update()
}

function finalLabel(final) {
  return final >= 0 ? '낼 부가세' : '환급받을 부가세'
}

function bindVatGeneral(form) {
  var update = function () {
    var e = form.elements
    var kind = e.deemedKind.value
    var deemedAmount = readManwon(e.deemed)
    var r = generalVat({
      sales: readManwon(e.sales), purchases: readManwon(e.purchases), cardSales: readManwon(e.card), cardEligible: e.cardEligible.checked,
      cardUsed: readWon(e.cardUsed), deemed: kind ? { kind: kind, purchase: deemedAmount } : undefined,
      prepaid: readWon(e.prepaid), eFiling: e.eFiling.checked, year: Number(e.year.value),
    })
    // 환급일 때는 공제와 예정고지 낸 세액이 환급을 늘리므로 +로 보여 준다.
    var sign = r.payable < 0 ? '+ ' : '− '
    var lines = [line('매출세액', korean(r.outputTax)), line('매입세액', '− ' + korean(r.inputTax))]
    if (r.deemed) lines.push(line('의제매입세액 ' + r.deemed.rate[0] + '/' + r.deemed.rate[1], '− ' + korean(r.deemed.credit)))
    lines.push(line(r.payable >= 0 ? '납부세액' : '환급세액', korean(Math.abs(r.payable))))
    if (r.eFilingCredit) lines.push(line('전자신고 공제', sign + korean(r.eFilingCredit)))
    if (r.cardCredit) lines.push(line('카드매출 세액공제', '− ' + korean(r.cardCredit)))
    if (r.prepaid) lines.push(line('예정고지 낸 세액', sign + korean(r.prepaid)))
    if (!kind && deemedAmount) lines.push(line('의제매입', '업종을 고르면 반영합니다'))
    e.result.innerHTML = totalBlock(finalLabel(r.final), r.final ? korean(Math.abs(r.final)) : '없음', lines)
  }
  form.addEventListener('input', update)
  form.addEventListener('change', update)
  update()
}

function bindVatSimple(form) {
  var update = function () {
    var e = form.elements
    var industry = e.industry.value
    var r = simplifiedVat({
      supply: readManwon(e.supply), industry: industry, purchases: readManwon(e.purchases), cardSales: readManwon(e.card), cardEligible: e.cardEligible.checked,
      months: readMonths(e.months), prepaid: readWon(e.prepaid), eFiling: e.eFiling.checked, year: Number(e.year.value),
    })
    if (r.exempt) {
      var exemptLines = [line('1년 환산 매출', korean(r.annualized)), line('납부면제 기준', '4,800만 원 미만')]
      if (r.prepaid) exemptLines.push(line('예정부과 낸 세액 환급', korean(r.prepaid)))
      e.result.innerHTML = totalBlock('간이과세자 부가세', '납부면제', exemptLines)
      return
    }
    var lines = [line('납부세액 (부가가치율 ' + VA_PERCENT[industry] + '%)', korean(r.computed))]
    if (r.purchaseCredit) lines.push(line('매입 0.5% 공제', '− ' + korean(r.purchaseCredit)))
    if (r.eFilingCredit) lines.push(line('전자신고 공제', '− ' + korean(r.eFilingCredit)))
    if (r.cardCredit) lines.push(line('카드매출 세액공제', '− ' + korean(r.cardCredit)))
    if (r.prepaid) lines.push(line('예정부과 낸 세액', '− ' + korean(r.prepaid)))
    e.result.innerHTML = totalBlock(finalLabel(r.final), r.final ? korean(Math.abs(r.final)) : '없음', lines)
  }
  form.addEventListener('input', update)
  form.addEventListener('change', update)
  update()
}

// 4대보험 계산기. src/insurance.ts와 같은 식이며 test/calc.test.ts가 두 결과를 비교한다.
var INS_RATES = {
  2026: { pensionPerMyriad: 475, pensionFloor: 410000, pensionCap: 6590000, healthPer100k: 3595, healthShareMin: 10080, healthShareMax: 4591740, ltcPerMillion: 9448, unemploymentPerMyriad: 90 },
  2027: { pensionPerMyriad: 500, pensionFloor: 410000, pensionCap: 6590000, healthPer100k: 3595, healthShareMin: 10080, healthShareMax: 4591740, ltcPerMillion: 9994, unemploymentPerMyriad: 100 },
}
var FIRM_PER_MYRIAD = { under150: 25, priority: 45, under1000: 65, large: 85 }

function floor10(n) {
  return Math.floor(n / 10) * 10
}

function insurance(i) {
  var wage = Math.max(0, Math.floor(i.wage))
  var pay = Math.max(0, wage - Math.max(0, Math.floor(i.nonTaxable)))
  if (pay === 0) return { pay: pay, pension: 0, health: 0, ltc: 0, unemployment: 0, worker: 0, stability: 0, industrial: 0, employer: 0, laborCost: wage, takeHomeBeforeTax: wage }
  var r = INS_RATES[i.year]
  var base = Math.min(r.pensionCap, Math.max(r.pensionFloor, Math.floor(pay / 1000) * 1000))
  var pension = floor10((base * r.pensionPerMyriad) / 10000)
  var health = Math.min(r.healthShareMax, Math.max(r.healthShareMin, floor10((pay * r.healthPer100k) / 100000)))
  var ltc = floor10((health * r.ltcPerMillion) / 71900)
  var unemployment = floor10((pay * r.unemploymentPerMyriad) / 10000)
  var worker = pension + health + ltc + unemployment
  var stability = floor10((pay * FIRM_PER_MYRIAD[i.firm]) / 10000)
  var industrial = floor10((pay * Math.max(0, Math.round(i.industrialPer100k))) / 100000)
  var employer = worker + stability + industrial
  return { pay: pay, pension: pension, health: health, ltc: ltc, unemployment: unemployment, worker: worker, stability: stability, industrial: industrial, employer: employer, laborCost: wage + employer, takeHomeBeforeTax: wage - worker }
}

function won(n) {
  return n.toLocaleString('ko-KR') + '원'
}

// 퍼센트 칸("1.47", "1.47%")을 십만분율로 읽는다. 비었으면 0.
function readPer100k(input) {
  var n = parseFloat(String(input.value).replace(/[^0-9.]/g, ''))
  return n > 0 ? Math.round(n * 1000) : 0
}

function bindIns(form) {
  var update = function () {
    var e = form.elements
    var year = Number(e.year.value)
    var entered = readManwon(e.wage)
    var wage = e.unit.value === 'year' ? Math.floor(entered / 12) : entered
    var r = insurance({ wage: wage, nonTaxable: readManwon(e.nonTaxable), year: year, firm: e.firm.value, industrialPer100k: readPer100k(e.industrial) })
    if (!wage) { e.result.innerHTML = '급여를 넣으면 계산합니다.'; return }
    if (!r.pay) { e.result.innerHTML = totalBlock('근로자 4대보험(한 달)', '없음', [line('보험료 매기는 보수', '비과세를 빼면 0원')]); return }
    var rate = INS_RATES[year]
    var draft = year === 2027 ? ' 의결안' : ''
    var lines = [
      line('국민연금 ' + rate.pensionPerMyriad / 100 + '%', won(r.pension)),
      line('건강보험 3.595%', won(r.health)),
      line('장기요양' + draft, won(r.ltc)),
      line('고용보험 ' + rate.unemploymentPerMyriad / 100 + '%' + (year === 2027 ? ' 정부안' : ''), won(r.unemployment)),
      line('보험료 매기는 보수', korean(r.pay)),
      line('사업주 부담(산재 포함)', won(r.employer)),
      line('한 달 인건비', won(r.laborCost)),
    ]
    e.result.innerHTML = totalBlock('근로자 4대보험(한 달)', won(r.worker), lines)
  }
  form.addEventListener('input', update)
  form.addEventListener('change', update)
  update()
}

// 연차 계산기. src/leave.ts와 같은 식이며 test/calc.test.ts가 두 결과를 비교한다.
var DAY_MS = 86400000

function daysInMonth(y, m) {
  return new Date(Date.UTC(y, m, 0)).getUTCDate()
}

function parseDate(s) {
  var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s))
  if (!m) return null
  var y = Number(m[1])
  var mo = Number(m[2])
  var d = Number(m[3])
  if (mo < 1 || mo > 12 || d < 1 || d > daysInMonth(y, mo)) return null
  return [y, mo, d]
}

function fmtDate(t) {
  return new Date(t).toISOString().slice(0, 10)
}

// 응당일. 그달에 같은 날이 없으면 다음 달 1일(기간이 그달 말일에 끝난다).
function addMonths(date, n) {
  var p = parseDate(date)
  var total = p[0] * 12 + (p[1] - 1) + n
  var y = Math.floor(total / 12)
  var m = (total % 12) + 1
  if (p[2] <= daysInMonth(y, m)) return fmtDate(Date.UTC(y, m - 1, p[2]))
  return fmtDate(Date.UTC(y, m, 1))
}

function shiftDay(date, k) {
  var p = parseDate(date)
  return fmtDate(Date.UTC(p[0], p[1] - 1, p[2]) + k * DAY_MS)
}

function dayBefore(date) { return shiftDay(date, -1) }
function dayAfter(date) { return shiftDay(date, 1) }

function annualDays(n) {
  return Math.min(25, 15 + Math.floor((n - 1) / 2))
}

function grantAt(entry, kind, n) {
  if (kind === 'monthly') return { kind: kind, n: n, days: 1, arise: addMonths(entry, n), expires: dayBefore(addMonths(entry, 12)) }
  return { kind: kind, n: n, days: annualDays(n), arise: addMonths(entry, 12 * n), expires: dayBefore(addMonths(entry, 12 * (n + 1))) }
}

function sumDays(gs) {
  var s = 0
  for (var i = 0; i < gs.length; i++) s += gs[i].days
  return s
}

function annualLeave(entry, asOf) {
  if (!parseDate(entry) || !parseDate(asOf) || asOf < entry) return { valid: false, tenureMonths: 0, totalDays: 0, monthlyDays: 0, annualDays: 0, usable: [], usableDays: 0, lastExpired: [], lastExpiredDays: 0, next: null }
  var got = []
  var next = null
  for (var i = 1; ; i++) {
    var g = i <= 11 ? grantAt(entry, 'monthly', i) : grantAt(entry, 'annual', i - 11)
    if (g.arise > asOf) { next = g; break }
    got.push(g)
  }
  var usable = got.filter(function (x) { return x.expires >= asOf })
  var expired = got.filter(function (x) { return x.expires < asOf })
  var latest = expired.reduce(function (a, x) { return x.expires > a ? x.expires : a }, '')
  var lastExpired = expired.filter(function (x) { return x.expires === latest })
  var tenureMonths = 0
  var after = dayAfter(asOf)
  while (addMonths(entry, tenureMonths + 1) <= after) tenureMonths++
  var monthly = got.filter(function (x) { return x.kind === 'monthly' })
  return {
    valid: true, tenureMonths: tenureMonths, totalDays: sumDays(got), monthlyDays: sumDays(monthly), annualDays: sumDays(got) - sumDays(monthly),
    usable: usable, usableDays: sumDays(usable), lastExpired: lastExpired, lastExpiredDays: sumDays(lastExpired), next: next,
  }
}

function dailyWage(monthly) {
  return Math.floor((Math.max(0, Math.floor(monthly)) * 8) / 209)
}

function leavePay(monthly, days) {
  return Math.floor(dailyWage(monthly) * Math.max(0, days))
}

function dotDate(iso) {
  return Number(iso.slice(0, 4)) + '. ' + Number(iso.slice(5, 7)) + '. ' + Number(iso.slice(8, 10)) + '.'
}

function todayIso() {
  var d = new Date()
  return fmtDate(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
}

function readDays(input) {
  var n = parseFloat(String(input.value).replace(/[^0-9.]/g, ''))
  return n > 0 ? n : 0
}

function tenureText(months) {
  var y = Math.floor(months / 12)
  var m = months % 12
  if (!y) return m + '개월'
  return m ? y + '년 ' + m + '개월' : y + '년'
}

function leaveLines(r, leaving, used, left, wage, asOf) {
  var lines = []
  if (!leaving && r.usable.length) lines.push(line('쓸 수 있는 마지막 날', dotDate(r.usable[0].expires)))
  if (r.usable.length && r.usable[0].kind === 'monthly') lines.push(line('입사 1년 미만 월차', r.usableDays + '일 (최대 11일)'))
  if (used) lines.push(line('이미 쓴 날', used + '일'))
  if (wage) lines.push(line(leaving ? '남은 연차수당' : '쓰지 못하면 연차수당', won(leavePay(wage, left))))
  if (leaving && r.next && r.next.arise === dayAfter(asOf)) lines.push(line('하루 더 재직하면', r.next.days + '일 더 생김'))
  if (!leaving && r.next) lines.push(line('다음 연차', dotDate(r.next.arise) + ' ' + r.next.days + '일'))
  if (r.lastExpiredDays) lines.push(line('기한이 지난 연차', r.lastExpiredDays + '일 (' + dotDate(r.lastExpired[0].expires) + '까지)'))
  lines.push(line('입사 후 생긴 연차', r.totalDays + '일'))
  lines.push(line('근속', tenureText(r.tenureMonths)))
  return lines
}

function bindLeave(form) {
  var e = form.elements
  if (!e.asOf.value) e.asOf.value = todayIso()
  var update = function () {
    var entry = e.entry.value
    var asOf = e.asOf.value
    var r = annualLeave(entry, asOf)
    if (!r.valid) { e.result.innerHTML = parseDate(entry) && parseDate(asOf) ? '계산할 날이 입사일보다 앞입니다.' : '날짜를 넣으면 계산합니다.'; return }
    var leaving = e.leaving.checked
    var used = Math.min(r.usableDays, readDays(e.used))
    var left = r.usableDays - used
    var lines = leaveLines(r, leaving, used, left, readManwon(e.wage), asOf)
    e.result.innerHTML = totalBlock(leaving ? '퇴사 때 남는 연차' : '지금 남은 연차', left + '일', lines)
  }
  form.addEventListener('input', update)
  form.addEventListener('change', update)
  update()
}

function bindLeavePay(form) {
  var update = function () {
    var e = form.elements
    var wage = readManwon(e.wage)
    var days = readDays(e.days)
    if (!wage || !days) { e.result.innerHTML = '금액과 일수를 넣으면 계산합니다.'; return }
    e.result.innerHTML = totalBlock('연차수당', won(leavePay(wage, days)), [line('1일 통상임금(월 ÷ 209 × 8)', won(dailyWage(wage))), line('연차', days + '일')])
  }
  form.addEventListener('input', update)
  form.addEventListener('change', update)
  update()
}

// 오늘(브라우저 날짜)부터 기한까지 남은 날. 기한 다음 날부터는 지났다고 쓴다.
function bindDday(el) {
  var p = el.getAttribute('data-dday').split('-')
  var due = Date.UTC(Number(p[0]), Number(p[1]) - 1, Number(p[2]))
  var now = new Date()
  var today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
  var days = Math.round((due - today) / 86400000)
  el.textContent = days > 0 ? '오늘 기준 D-' + days : days === 0 ? '오늘이 기한입니다' : '이 기한은 지났습니다'
}

// 폰에서 입력칸이 긴 계산기(부가세)는 결과 칸이 화면 밖에 있는 동안 아래에 결과 한 줄을 띄운다. 누르면 결과 칸으로 간다.
// 넓은 화면은 결과 칸이 오른쪽에 붙어 따라오므로 CSS가 이 줄을 숨긴다.
function bindPeek(form) {
  var out = form.querySelector('output')
  if (!out || typeof IntersectionObserver === 'undefined') return
  var bar = document.createElement('button')
  bar.type = 'button'
  bar.className = 'peek'
  bar.hidden = true
  var label = document.createElement('span')
  var total = document.createElement('b')
  bar.appendChild(label)
  bar.appendChild(total)
  form.appendChild(bar)
  var formSeen = false
  var outSeen = false
  var sync = function () {
    var l = out.querySelector('.res-label')
    var v = out.querySelector('.res-total')
    label.textContent = l ? l.textContent : ''
    total.textContent = v ? v.textContent : ''
    bar.hidden = !(formSeen && !outSeen && v)
  }
  new IntersectionObserver(function (es) { formSeen = es[es.length - 1].isIntersecting; sync() }).observe(form)
  new IntersectionObserver(function (es) { outSeen = es[es.length - 1].isIntersecting; sync() }, { threshold: 0.5 }).observe(out)
  form.addEventListener('input', sync)
  form.addEventListener('change', sync)
  bar.addEventListener('click', function () { out.scrollIntoView({ behavior: 'smooth', block: 'center' }) })
}

function bindAll() {
  document.querySelectorAll('form[data-gift]').forEach(bindGift)
  document.querySelectorAll('form[data-inherit]').forEach(bindInherit)
  document.querySelectorAll('form[data-deadline]').forEach(bindDeadline)
  document.querySelectorAll('form[data-vat-split]').forEach(bindVatSplit)
  document.querySelectorAll('form[data-vat-general]').forEach(bindVatGeneral)
  document.querySelectorAll('form[data-vat-simple]').forEach(bindVatSimple)
  document.querySelectorAll('form[data-ins]').forEach(bindIns)
  document.querySelectorAll('form[data-leave]').forEach(bindLeave)
  document.querySelectorAll('form[data-leave-pay]').forEach(bindLeavePay)
  document.querySelectorAll('[data-dday]').forEach(bindDday)
  // 계산기마다 input 처리기를 먼저 단 뒤에 달아야 갱신된 결과를 옮겨 적는다.
  document.querySelectorAll('form.calc.long').forEach(bindPeek)
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bindAll)
  else bindAll()
}

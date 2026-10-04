// Derives the KNX demo from the plain demo so both stay in sync: `tsx scripts/make-smart-demo.ts`
import { readFileSync, writeFileSync } from 'node:fs'
import * as yaml from 'js-yaml'

type Any = Record<string, any>
const doc = yaml.load(readFileSync('data/demo.yaml', 'utf8')) as Any
const d = doc.data as Any

d.meta.title = { ru: 'Квартира с KNX — щит ЩК-1', en: 'KNX apartment — panel DB-1', sr: 'KNX stan — tabla RT-1', es: 'Apartamento KNX — cuadro CG-1' }
d.meta.enclosure = 'Встраиваемый щит 5×18 модулей'

d.rows.push({ id: 'r5', modules: 18, items: ['GB1', 'KF1', 'QA1', 'QA2', 'KI1', { blank: 4 }] })

const knx = (address: string | undefined, channels: Any[] = []) => ({ system: 'knx', ...(address ? { address } : {}), channels })
d.devices.push(
  {
    id: 'GB1',
    type: 'bus-psu',
    label: { ru: 'Блок питания шины KNX', en: 'KNX bus power supply', sr: 'KNX napajanje magistrale', es: 'Fuente de bus KNX' },
    upstream: 'QF14',
    brand: 'MDT',
    model: 'STV-0640.01',
    smart: knx(undefined),
    tags: ['knx'],
  },
  {
    id: 'KF1',
    type: 'bus-gateway',
    label: { ru: 'IP-роутер KNX', en: 'KNX IP router', sr: 'KNX IP ruter', es: 'Router IP KNX' },
    brand: 'MDT',
    model: 'SCN-IP100.03',
    smart: knx('1.1.1'),
    tags: ['knx'],
    notes: [{ author: 'Иван', date: '2026-09-14', text: 'Подключён к слаботочному шкафу, VLAN умного дома. Проект ETS лежит в документах.' }],
  },
  {
    id: 'QA1',
    type: 'actuator',
    label: { ru: 'Актуатор освещения 4 канала', en: 'Lighting actuator, 4 channels', sr: 'Aktuator rasvete, 4 kanala', es: 'Actuador de iluminación, 4 canales' },
    upstream: 'QF9',
    poles: 2,
    brand: 'MDT',
    model: 'AKS-0416.03',
    smart: knx('1.1.2', [
      { id: 'A', function: 'switch', group: '1/1/1', points: ['l-light'] },
      { id: 'B', function: 'dimmer', group: '1/1/2', points: ['l-light2'] },
      { id: 'C', function: 'switch', group: '1/2/1', points: ['b-light'] },
      { id: 'D', function: 'switch', group: '1/3/1', points: ['g-light'] },
    ]),
    tags: ['knx', 'свет'],
  },
  {
    id: 'QA2',
    type: 'actuator',
    label: { ru: 'Актуатор отопления', en: 'Heating actuator', sr: 'Aktuator grejanja', es: 'Actuador de calefacción' },
    upstream: 'QFD4',
    poles: 2,
    brand: 'MDT',
    model: 'AKH-0400.03',
    smart: knx('1.1.3', [
      { id: 'A', function: 'heating', group: '3/1/1', points: ['bt-heat'] },
      { id: 'B', function: 'heating', group: '3/1/2', label: { ru: 'Резерв', en: 'Spare' }, points: [] },
    ]),
    tags: ['knx', 'отопление'],
  },
  {
    id: 'KI1',
    type: 'bus-io',
    label: { ru: 'Модуль входов (датчики)', en: 'Binary input module', sr: 'Modul ulaza', es: 'Módulo de entradas' },
    brand: 'MDT',
    model: 'BE-04000.02',
    smart: knx('1.1.4', [{ id: 'A', function: 'input', group: '0/0/1', label: { ru: 'Датчик протечки — ванная', en: 'Leak sensor — bathroom' }, points: ['bt-leak'] }]),
    tags: ['knx'],
  },
)

const relink: Record<string, string> = { 'l-light': 'QA1', 'l-light2': 'QA1', 'b-light': 'QA1', 'g-light': 'QA1', 'bt-heat': 'QA2' }
for (const p of d.points) if (relink[p.id]) p.device = relink[p.id]

d.points.push(
  { id: 'h-panel', kind: 'panel', room: 'hallway', x: 360, y: 600, heightMm: 1300, label: { ru: 'Центральная панель у входа', en: 'Main panel by the entrance' }, controls: ['1/1/1', '1/1/2', '1/2/1', '1/3/1', '3/1/1', '0/0/1'] },
  { id: 'l-panel', kind: 'panel', room: 'living', x: 360, y: 430, heightMm: 1300, label: { ru: 'Сенсорная панель гостиной', en: 'Living room touch panel' }, controls: ['1/1/1', '1/1/2'] },
  { id: 'b-panel', kind: 'panel', room: 'bedroom', x: 580, y: 430, heightMm: 1300, label: { ru: 'Панель спальни', en: 'Bedroom panel' }, controls: ['1/2/1'] },
  { id: 'bt-panel', kind: 'panel', room: 'hallway', x: 300, y: 560, heightMm: 1300, label: { ru: 'Терморегулятор ванной', en: 'Bathroom thermostat' }, controls: ['3/1/1'] },
  { id: 'bt-leak', kind: 'sensor', room: 'bathroom', x: 90, y: 730, device: 'KI1', label: { ru: 'Датчик протечки под стиральной машиной', en: 'Leak sensor under the washer' }, controls: ['0/0/1'] },
)

const bus = (id: string, points: number[][], note: Any) => ({ id, kind: 'bus', points, note, safeWidth: 10, mount: 'ceiling' })
d.routes.push(
  bus('bus-1', [[325, 740], [325, 600], [360, 600]], { ru: 'KNX TP, зелёный кабель J-Y(St)Y 2×2×0.8', en: 'KNX TP, green J-Y(St)Y 2×2×0.8' }),
  bus('bus-2', [[360, 600], [360, 430]], { ru: 'KNX TP до панели гостиной', en: 'KNX TP to the living room panel' }),
  bus('bus-3', [[360, 430], [580, 430]], { ru: 'KNX TP шлейфом до спальни', en: 'KNX TP daisy-chained to the bedroom' }),
  bus('bus-4', [[325, 600], [300, 560]], { ru: 'KNX TP до терморегулятора', en: 'KNX TP to the thermostat' }),
  bus('bus-5', [[315, 740], [90, 745], [90, 730]], { ru: 'Шлейф датчика протечки', en: 'Leak sensor loop' }),
)

d.maintenance.tasks.push({
  id: 'knx-backup',
  title: { ru: 'Резервная копия проекта ETS', en: 'Back up the ETS project', sr: 'Rezervna kopija ETS projekta', es: 'Copia del proyecto ETS' },
  intervalDays: 365,
  devices: ['KF1'],
  howTo: { ru: 'Выгрузить .knxproj и положить в документы. Без него перепрограммировать систему очень дорого.', en: 'Export the .knxproj and store it with the documents. Reprogramming without it is very expensive.' },
})

const header = '# Generated from demo.yaml by scripts/make-smart-demo.ts, do not edit by hand.\n'
writeFileSync('data/demo-smart.yaml', header + yaml.dump(doc, { lineWidth: -1, noRefs: true, flowLevel: 4 }))
console.log('data/demo-smart.yaml written')

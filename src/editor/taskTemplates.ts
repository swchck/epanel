import type { DeviceType, LocalizedText, PanelData } from '@/domain/model'

export interface TaskTemplate {
  // doubles as the task id, so a second RCD joins the task the first one created
  id: string
  types: DeviceType[]
  intervalDays: number
  title: LocalizedText
  howTo: LocalizedText
}

const TASK_TEMPLATES: TaskTemplate[] = [
  {
    id: 'rcd-test',
    types: ['rcd', 'rcbo'],
    intervalDays: 30,
    title: { ru: 'Нажать кнопку «Тест» на УЗО и дифавтоматах', en: 'Press the TEST button on all RCDs and RCBOs', sr: 'Pritisnuti TEST na svim FID sklopkama', es: 'Pulsar TEST en todos los diferenciales' },
    howTo: {
      ru: 'Нажмите «Т». Устройство должно отключиться. Включите обратно. Если не отключилось, устройство неисправно: звоните электрику.',
      en: 'Press T. The device must trip. Switch it back on. If it does not trip, it is faulty: call an electrician.',
      sr: 'Pritisnite T. Uređaj mora da se isključi. Uključite ga ponovo. Ako se ne isključi, neispravan je: zovite električara.',
      es: 'Pulsa T. El aparato debe dispararse. Vuelve a subirlo. Si no se dispara, está averiado: llama a un electricista.',
    },
  },
  {
    id: 'spd-check',
    types: ['spd'],
    intervalDays: 180,
    title: { ru: 'Проверить индикатор УЗИП', en: 'Check the surge protector indicator', sr: 'Proveriti indikator prenaponske zaštite', es: 'Revisar el indicador del protector' },
    howTo: {
      ru: 'Окошко должно быть зелёным. Красное значит, что картридж отработал и его нужно заменить.',
      en: 'The window must be green. Red means the cartridge is spent and must be replaced.',
      sr: 'Prozorčić mora biti zelen. Crven znači da je uložak istrošen i treba ga zameniti.',
      es: 'La ventanilla debe estar verde. Roja significa que el cartucho se ha agotado y hay que cambiarlo.',
    },
  },
  {
    id: 'meter-reading',
    types: ['meter'],
    intervalDays: 30,
    title: { ru: 'Передать показания счётчика', en: 'Submit meter readings', sr: 'Prijaviti stanje brojila', es: 'Enviar la lectura del contador' },
    howTo: {
      ru: 'Перепишите показания (у многотарифного счётчика по каждой зоне) и передайте через сайт или приложение энергосбыта.',
      en: 'Write down the reading (each tariff zone on a multi-rate meter) and submit it on the utility website or app.',
      sr: 'Zapišite stanje (za svaku tarifu na dvotarifnom brojilu) i prijavite ga preko sajta ili aplikacije elektrodistribucije.',
      es: 'Apunta la lectura (cada periodo en un contador con discriminación horaria) y envíala en la web o app de la compañía.',
    },
  },
]

export function templateFor(type: DeviceType): TaskTemplate | undefined {
  return TASK_TEMPLATES.find((x) => x.types.includes(type))
}

export function joinTemplateTask(d: PanelData, template: TaskTemplate, deviceId: string) {
  const task = d.maintenance.tasks.find((x) => x.id === template.id)
  if (task) {
    if (!task.devices.includes(deviceId)) task.devices.push(deviceId)
    return
  }
  d.maintenance.tasks.push({ id: template.id, title: structuredClone(template.title), howTo: structuredClone(template.howTo), intervalDays: template.intervalDays, devices: [deviceId] })
}

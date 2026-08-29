import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { Plus, Send, Users, Megaphone, Phone, CheckSquare, Square, History } from 'lucide-react'
import { useData } from '../context/DataContext.jsx'
import { useLanguage } from '../context/LanguageContext.jsx'
import { OFFERS_TEXT } from '../i18n/offers.js'
import { formatDate, todayISO } from '../utils/format.js'
import Modal from '../components/Modal.jsx'
import EmptyState from '../components/EmptyState.jsx'
import DataTable from '../components/DataTable.jsx'
import { SkeletonTable } from '../components/Skeleton.jsx'
import useSimulatedLoading from '../hooks/useSimulatedLoading.js'
import { Field, Input, Textarea, PrimaryButton, SecondaryButton } from '../components/FormControls.jsx'
import { CallIcon, WhatsAppIcon, openWhatsAppChat } from '../components/BrandIcons.jsx'
import AppTooltip from '../components/AppTooltip.jsx'

const customerEmptyForm = { name: '', phone: '' }

function buildTemplates(station) {
  const shortLocation = station.location.split(',')[0]
  const mobiles = station.mobiles.join(' / ')
  return [
    {
      id: 'tamil-bulk-1',
      label: 'Tamil · Bulk Offer (Short)',
      text: `⛽ *${station.name} – ${shortLocation}*\n\nBulk பெட்ரோல் & டீசல் வாங்கினால்\n🎁 *FREE ஆயில்* + சிறப்பு விலை!\n\n📞 ${mobiles} - தொடர்புக்கு அழைக்கவும்.`,
    },
    {
      id: 'tamil-bulk-2',
      label: 'Tamil · Bulk Offer (Detailed)',
      text: `⛽ *${station.name} – ${shortLocation}*\n\n🎉 Bulk பெட்ரோல் & டீசல் ஆர்டர்களுக்கு சிறப்பு சலுகை!\n🎁 குறிப்பிட்ட அளவு வாங்கினால் *FREE ஆயில்*.\n💰 சிறந்த விலை • 🚚 விரைவான சேவை\n\n📞 மேலும் தகவலுக்கு தொடர்பு கொள்ளுங்கள்: ${mobiles}`,
    },
    {
      id: 'english-bulk',
      label: 'English · Bulk Offer',
      text: `⛽ ${station.name}, ${shortLocation}\n\nSpecial offer on bulk Petrol & Diesel orders!\n🎁 Get FREE engine oil on qualifying purchases.\n💰 Best rates • 🚚 Fast service\n\n📞 Call us: ${mobiles}`,
    },
    {
      id: 'loyalty-credit',
      label: 'English · Loyalty / Credit Reminder',
      text: `⛽ ${station.name}\n\nThank you for being a valued customer! 🙏\nClear your outstanding balance this week and get 2% cashback on your next fill-up.\n\n📞 ${mobiles}`,
    },
  ]
}

export default function Offers() {
  const { creditCustomers, addCustomer, station } = useData()
  const { language } = useLanguage()
  const t = OFFERS_TEXT[language]
  const loading = useSimulatedLoading(600)

  const [selectedCustomers, setSelectedCustomers] = useState([])
  const [message, setMessage] = useState('')
  const [sentLog, setSentLog] = useState([])

  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState(customerEmptyForm)
  const [errors, setErrors] = useState({})

  const templates = useMemo(() => buildTemplates(station), [station])

  function openAdd() {
    setForm(customerEmptyForm)
    setErrors({})
    setModalOpen(true)
  }

  function validate() {
    const e = {}
    if (!form.name.trim()) e.name = t.errorNameRequired
    if (!form.phone.trim()) e.phone = t.errorPhoneRequired
    else if (!/^\d{10}$/.test(form.phone.trim())) e.phone = t.errorPhoneInvalid
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function handleAddCustomer(e) {
    e.preventDefault()
    if (!validate()) return
    addCustomer({ name: form.name, phone: form.phone, openingBalance: 0, notes: '', ledger: [] })
    toast.success(t.toastCustomerAdded)
    setModalOpen(false)
  }

  function selectAll() {
    setSelectedCustomers(creditCustomers)
  }

  function clearSelection() {
    setSelectedCustomers([])
  }

  function sendToSingle(customer) {
    if (!message.trim()) {
      toast.error(t.errorNoMessage)
      return
    }
    toast.success(t.toastSentToOne(customer.name))
    setSentLog((prev) => [{ id: `${Date.now()}-${customer.id}`, recipients: [customer.name], message, sentAt: todayISO() }, ...prev])
  }

  function sendToWhatsApp(customer) {
    if (!message.trim()) {
      toast.error(t.errorNoMessage)
      return
    }
    openWhatsAppChat(customer.phone, message)
    toast.success(t.toastSentToOne(customer.name))
    setSentLog((prev) => [{ id: `${Date.now()}-${customer.id}`, recipients: [customer.name], message, sentAt: todayISO() }, ...prev])
  }

  function handleSendOffer() {
    if (!message.trim()) {
      toast.error(t.errorNoMessage)
      return
    }
    if (selectedCustomers.length === 0) {
      toast.error(t.errorNoRecipients)
      return
    }
    toast.success(
      selectedCustomers.length === 1
        ? t.toastSentToOne(selectedCustomers[0].name)
        : t.toastSentToMany(selectedCustomers.length),
    )
    setSentLog((prev) => [
      { id: `${Date.now()}`, recipients: selectedCustomers.map((c) => c.name), message, sentAt: todayISO() },
      ...prev,
    ])
  }

  const columns = [
    {
      field: 'name',
      header: t.colCustomer,
      sortable: true,
      filter: true,
      style: { width: '78%' },
      body: (c) => (
        <>
          <p className="font-medium text-slate-800">{c.name}</p>
          <p className="flex items-center gap-1 text-xs font-medium text-slate-400">
            <Phone size={11} /> {c.phone}
          </p>
        </>
      ),
    },
    {
      header: t.colQuickSend,
      align: 'right',
      style: { width: '26%' },
      body: (c) => (
        <div className="flex items-center justify-end gap-1.5">
          <AppTooltip title={t.tooltipPhone}>
            <motion.button
              type="button"
              onClick={() => sendToSingle(c)}
              aria-label={t.sendToThisCustomer}
              whileHover={{ scale: 1.15 }}
              whileTap={{ scale: 0.9 }}
              className="inline-flex items-center justify-center rounded-lg p-1"
            >
              <CallIcon size={26} />
            </motion.button>
          </AppTooltip>
          <AppTooltip title={t.tooltipWhatsApp}>
            <motion.button
              type="button"
              onClick={() => sendToWhatsApp(c)}
              aria-label={t.sendViaWhatsApp}
              whileHover={{ scale: 1.15, rotate: [0, -8, 8, -4, 0] }}
              whileTap={{ scale: 0.9 }}
              transition={{ duration: 0.4 }}
              className="inline-flex items-center justify-center rounded-lg p-1"
            >
              <WhatsAppIcon size={26} />
            </motion.button>
          </AppTooltip>
        </div>
      ),
    },
  ]

  if (loading) {
    return <SkeletonTable rows={6} cols={3} />
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-2">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="rounded-xl border border-slate-200 bg-white shadow-card"
        >
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
              <Users size={15} className="text-slate-400" /> {t.recipients}
            </h3>
            <div className="flex gap-2">
              <button
                onClick={selectAll}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50"
              >
                <CheckSquare size={13} /> {t.selectAll}
              </button>
              <button
                onClick={clearSelection}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50"
              >
                <Square size={13} /> {t.clear}
              </button>
            </div>
          </div>

          {creditCustomers.length === 0 ? (
            <div className="p-5">
              <EmptyState
                icon={Users}
                title={t.emptyTitle}
                description={t.emptyDesc}
                action={
                  <PrimaryButton onClick={openAdd}>
                    <Plus size={16} /> {t.addCustomer}
                  </PrimaryButton>
                }
              />
            </div>
          ) : (
            <DataTable
              columns={columns}
              data={creditCustomers}
              rowKey="id"
              globalFilterFields={['name', 'phone']}
              searchPlaceholder={t.searchPlaceholder}
              defaultSortField="name"
              scrollable={false}
              selectable
              selection={selectedCustomers}
              onSelectionChange={setSelectedCustomers}
              exportFilename="offer-customers"
              dense
              toolbarActions={
                <PrimaryButton onClick={openAdd} className="px-3.5 py-2 text-xs">
                  <Plus size={14} /> {t.addCustomer}
                </PrimaryButton>
              }
            />
          )}
          {/* <p className="border-t border-slate-100 px-5 py-2.5 text-xs text-slate-500">
            {selectedCustomers.length === 0
              ? 'No customers selected — tick rows above, or use "Select All".'
              : `${selectedCustomers.length} of ${creditCustomers.length} customer(s) selected.`}
          </p> */}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.08 }}
          className="rounded-xl border border-slate-200 bg-white p-5 shadow-card"
        >
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800">
            <Megaphone size={15} className="text-slate-400" /> {t.offerContent}
          </h3>

          <div className="mb-3 flex flex-wrap gap-2">
            {templates.map((tpl) => (
              <button
                key={tpl.id}
                onClick={() => setMessage(tpl.text)}
                className="rounded-full border border-brand-200 bg-brand-50 px-3 py-1.5 text-xs font-medium text-brand-700 transition-colors hover:bg-brand-100"
              >
                {tpl.label}
              </button>
            ))}
          </div>

          <Field label={t.fieldMessage}>
            <Textarea
              rows={9}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={t.placeholderMessage}
              className="font-sans"
            />
          </Field>

          <PrimaryButton onClick={handleSendOffer} className="mt-4 w-full">
            <Send size={16} /> {t.sendOfferTo(selectedCustomers.length || 0)}
          </PrimaryButton>
        </motion.div>
      </div>

      {sentLog.length > 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.15 }}
          className="rounded-xl border border-slate-200 bg-white p-5 shadow-card"
        >
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800">
            <History size={15} className="text-slate-400" /> {t.recentlySent}
          </h3>
          <ul className="space-y-2">
            {sentLog.slice(0, 5).map((log) => (
              <li key={log.id} className="rounded-lg bg-slate-50 px-3 py-2.5 text-xs">
                <p className="font-medium text-slate-700">
                  {formatDate(log.sentAt)} &middot;{' '}
                  {log.recipients.length === 1 ? t.sentToOne(log.recipients[0]) : t.sentToMany(log.recipients.length)}
                </p>
                <p className="mt-1 truncate text-slate-500">{log.message.split('\n')[0]}</p>
              </li>
            ))}
          </ul>
        </motion.div>
      ) : null}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={t.editCustomerTitle}>
        <form onSubmit={handleAddCustomer} className="space-y-4">
          <Field label={t.fieldCustomerName} required error={errors.name}>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={t.placeholderCustomerName} error={errors.name} />
          </Field>
          <Field label={t.fieldPhone} required error={errors.phone}>
            <Input
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })}
              placeholder={t.placeholderPhone}
              inputMode="numeric"
              error={errors.phone}
            />
          </Field>
          <div className="flex justify-end gap-2 pt-1">
            <SecondaryButton type="button" onClick={() => setModalOpen(false)}>
              {t.cancel}
            </SecondaryButton>
            <PrimaryButton type="submit">{t.addCustomer}</PrimaryButton>
          </div>
        </form>
      </Modal>
    </div>
  )
}

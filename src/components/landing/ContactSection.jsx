import { useState } from 'react'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { Phone, Mail, Send } from 'lucide-react'
import { Field, Input, Textarea, PrimaryButton } from '../FormControls.jsx'

const emptyForm = { name: '', contact: '', message: '' }

export default function ContactSection({ station }) {
  const [form, setForm] = useState(emptyForm)
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)

  function validate() {
    const e = {}
    if (!form.name.trim()) e.name = 'Name is required'
    if (!form.contact.trim()) e.contact = 'Email or phone is required'
    if (!form.message.trim()) e.message = 'Please add a short message'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function handleSubmit(ev) {
    ev.preventDefault()
    if (!validate()) return
    setSubmitting(true)
    setTimeout(() => {
      setSubmitting(false)
      setForm(emptyForm)
      toast.success("Message sent! We'll get back to you soon.")
    }, 500)
  }

  return (
    <section id="contact" className="relative bg-brand-50 px-6 py-16 sm:py-20">
      <div className="mx-auto max-w-5xl">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.5 }}
          className="mb-8 text-center"
        >
          <h2 className="font-heading bg-gradient-to-r from-slate-900 via-slate-700 to-brand-600 bg-clip-text text-xl font-black text-transparent sm:text-2xl">Get in Touch</h2>
          <p className="mt-2 text-sm text-slate-600 sm:text-base">Questions about bulk orders, credit accounts, or anything else? Reach out.</p>
        </motion.div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
          <motion.form
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.5 }}
            onSubmit={handleSubmit}
            className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-card sm:p-8 lg:col-span-3"
          >
            <Field label="Your Name" required error={errors.name}>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Karthik" error={errors.name} />
            </Field>
            <Field label="Email or Phone" required error={errors.contact}>
              <Input
                value={form.contact}
                onChange={(e) => setForm({ ...form, contact: e.target.value })}
                placeholder="you@example.com or 98765 43210"
                error={errors.contact}
              />
            </Field>
            <Field label="Message" required error={errors.message}>
              <Textarea
                rows={4}
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
                placeholder="How can we help?"
                error={errors.message}
              />
            </Field>
            <PrimaryButton type="submit" disabled={submitting} className="w-full sm:w-auto">
              {submitting ? 'Sending…' : (
                <>
                  <Send size={15} /> Send Message
                </>
              )}
            </PrimaryButton>
          </motion.form>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="flex flex-col justify-center gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-card sm:p-8 lg:col-span-2"
          >
            <p className="text-sm font-semibold text-slate-800">Prefer to call or write directly?</p>
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                <Phone size={17} />
              </div>
              <p className="text-sm text-slate-700">{station.mobiles.join('  /  ')}</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-green-50 text-green-600">
                <Mail size={17} />
              </div>
              <p className="break-all text-sm text-slate-700">{station.email}</p>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}

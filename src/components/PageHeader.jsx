import { motion } from 'framer-motion'

export default function PageHeader({ description, action }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
    >
      {description ? <div className="text-sm text-slate-500">{description}</div> : <div />}
      {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
    </motion.div>
  )
}

export default function CountUp({ value, formatter, className }) {
  const fmt = formatter || ((v) => Math.round(v).toLocaleString('en-IN'))
  return <span className={className}>{fmt(Number(value) || 0)}</span>
}

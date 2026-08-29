export function CallIcon({ size = 18, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="call-grad" x1="1" y1="4" x2="19" y2="22" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#00C2FF" />
          <stop offset="1" stopColor="#4F46E5" />
        </linearGradient>
        <linearGradient id="call-wave-grad" x1="11" y1="0" x2="24" y2="13" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#BAE6FD" />
          <stop offset="1" stopColor="#0EA5E9" />
        </linearGradient>
      </defs>
      <path
        fill="url(#call-grad)"
        d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"
      />
      <path d="M13.2 1.2a9.6 9.6 0 0 1 8.6 8.6" fill="none" stroke="url(#call-wave-grad)" strokeWidth="1.5" strokeLinecap="round" opacity="0.35" />
      <path d="M13.6 4.9a6.2 6.2 0 0 1 5.5 5.5" fill="none" stroke="url(#call-wave-grad)" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
      <path d="M14 8.5a2.9 2.9 0 0 1 2.6 2.6" fill="none" stroke="url(#call-wave-grad)" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

export function WhatsAppIcon({ size = 18, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden="true">
      <defs>
        <radialGradient id="wa-grad" cx="35%" cy="25%" r="85%">
          <stop offset="0" stopColor="#6EE787" />
          <stop offset="0.55" stopColor="#2CC352" />
          <stop offset="1" stopColor="#128C3E" />
        </radialGradient>
      </defs>
      <circle cx="12" cy="12" r="11.5" fill="url(#wa-grad)" />
      <svg x="5" y="5" width="14" height="14" viewBox="0 0 24 24">
        <path
          fill="#FFFFFF"
          d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.671.15-.198.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.766-1.653-2.062-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.008-.57-.008-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.076 4.487.709.306 1.262.489 1.694.625.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347zM12.017 24h-.004a11.987 11.987 0 01-6.096-1.665l-6.393 1.917 1.964-6.171A11.94 11.94 0 010 12.017C0 5.383 5.383 0 12.017 0c3.194 0 6.194 1.24 8.442 3.489a11.94 11.94 0 013.53 8.494c-.003 6.634-5.386 12.017-12.017 12.017z"
        />
      </svg>
    </svg>
  )
}

export function buildWhatsAppLink(phone, message) {
  const digits = (phone || '').replace(/\D/g, '')
  const withCountryCode = digits.length === 10 ? `91${digits}` : digits
  return `https://wa.me/${withCountryCode}?text=${encodeURIComponent(message)}`
}

export function openWhatsAppChat(phone, message) {
  window.open(buildWhatsAppLink(phone, message), '_blank', 'noopener,noreferrer')
}

import { addLocale } from 'primereact/api'

// Registers a Tamil locale for PrimeReact's own built-in strings (column
// filter menu, paginator aria-labels, etc.) — separate from our app-level
// translation dictionaries, since PrimeReact renders these itself.
export function registerPrimeReactLocale() {
  addLocale('ta', {
    accept: 'ஆம்',
    reject: 'இல்லை',
    choose: 'தேர்வு செய்',
    upload: 'பதிவேற்று',
    cancel: 'ரத்து செய்',
    today: 'இன்று',
    clear: 'அழி',
    filter: 'வடிகட்டி',
    apply: 'பயன்படுத்து',
    matchAll: 'அனைத்தும் பொருந்த வேண்டும்',
    matchAny: 'ஏதேனும் ஒன்று பொருந்த வேண்டும்',
    addRule: 'விதியைச் சேர்',
    removeRule: 'விதியை அகற்று',
    contains: 'கொண்டுள்ளது',
    notContains: 'கொண்டில்லை',
    startsWith: 'இதில் தொடங்குகிறது',
    endsWith: 'இதில் முடிகிறது',
    equals: 'சமமானது',
    notEquals: 'சமமற்றது',
    noFilter: 'வடிகட்டி இல்லை',
    lt: 'குறைவானது',
    lte: 'குறைவானது அல்லது சமமானது',
    gt: 'அதிகமானது',
    gte: 'அதிகமானது அல்லது சமமானது',
    dateIs: 'தேதி இது',
    dateIsNot: 'தேதி இது இல்லை',
    dateBefore: 'தேதி இதற்கு முன்',
    dateAfter: 'தேதி இதற்குப் பின்',
    custom: 'தனிப்பயன்',
    emptyMessage: 'விருப்பங்கள் இல்லை',
    emptyFilterMessage: 'முடிவுகள் இல்லை',
    emptySearchMessage: 'முடிவுகள் இல்லை',
    dayNames: ['ஞாயிறு', 'திங்கள்', 'செவ்வாய்', 'புதன்', 'வியாழன்', 'வெள்ளி', 'சனி'],
    dayNamesShort: ['ஞாயி', 'திங்', 'செவ்', 'புத', 'வியா', 'வெள்', 'சனி'],
    dayNamesMin: ['ஞா', 'தி', 'செ', 'பு', 'வி', 'வெ', 'ச'],
    monthNames: [
      'ஜனவரி', 'பிப்ரவரி', 'மார்ச்', 'ஏப்ரல்', 'மே', 'ஜூன்',
      'ஜூலை', 'ஆகஸ்ட்', 'செப்டம்பர்', 'அக்டோபர்', 'நவம்பர்', 'டிசம்பர்',
    ],
    monthNamesShort: ['ஜன', 'பிப்', 'மார்', 'ஏப்', 'மே', 'ஜூன்', 'ஜூலை', 'ஆக', 'செப்', 'அக்', 'நவ', 'டிச'],
    weekHeader: 'வா',
    firstDayOfWeek: 0,
  })
}

export const DATA_TABLE_TEXT = {
  en: {
    exportCsv: 'Export CSV',
    searchPlaceholder: 'Search...',
    emptyMessage: 'No records found.',
    currentPageReport: '{first}-{last} of {totalRecords}',
    searchColumn: (header) => `Search ${header || ''}`.trim(),
  },
  ta: {
    exportCsv: 'CSV ஏற்றுமதி',
    searchPlaceholder: 'தேடு...',
    emptyMessage: 'பதிவுகள் இல்லை.',
    currentPageReport: '{first}-{last} / {totalRecords}',
    searchColumn: (header) => `${header || ''} தேடு`.trim(),
  },
}

import Tooltip from '@mui/material/Tooltip'

// Thin wrapper around MUI's Tooltip with the app's arrow + black-background
// look baked in, so every call site just passes `title` instead of repeating
// the same slotProps override everywhere.
export default function AppTooltip({ title, children, ...props }) {
  if (!title) return children

  return (
    <Tooltip
      title={title}
      arrow
      slotProps={{
        tooltip: {
          sx: {
            bgcolor: '#000000',
            color: '#ffffff',
            fontSize: '0.7rem',
            fontWeight: 600,
            borderRadius: '6px',
            px: 1.25,
            py: 0.6,
          },
        },
        arrow: {
          sx: { color: '#000000' },
        },
      }}
      {...props}
    >
      {children}
    </Tooltip>
  )
}

import { createTheme } from '@mui/material/styles'

// Peach palette lifted from the Tailwind `brand` scale (tailwind.config.js) so every
// MUI component (DatePicker focus rings, selected day, etc.) matches the app's theme.
const muiTheme = createTheme({
  palette: {
    primary: {
      light: '#e8a877',
      main: '#c46f36',
      dark: '#9c5629',
      contrastText: '#ffffff',
    },
  },
  typography: {
    fontFamily: '"Plus Jakarta Sans", ui-sans-serif, system-ui, sans-serif',
  },
  shape: {
    borderRadius: 10,
  },
})

export default muiTheme

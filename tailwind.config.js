/** @type {import('tailwindcss').Config} */
/**
 * Convención de paleta:
 *   verde (primary #2B5D3A)  = marca / acción primaria (botones principales)
 *   azul (secondary / info)  = elementos informativos, badges info, links secundarios
 *   naranja (accent/warning) = solo advertencias
 *   rojo (danger)            = peligro / acciones destructivas
 *   success                  = confirmación / estados OK
 */
module.exports = {
	darkMode: ['class'],
	content: [
		'./pages/**/*.{ts,tsx}',
		'./components/**/*.{ts,tsx}',
		'./app/**/*.{ts,tsx}',
		'./src/**/*.{ts,tsx}',
	],
	theme: {
		container: {
			center: true,
			padding: '2rem',
			screens: {
				'2xl': '1400px',
			},
		},
		extend: {
			colors: {
				border: 'hsl(var(--border))',
				input: 'hsl(var(--input))',
				ring: 'hsl(var(--ring))',
				background: 'hsl(var(--background))',
				foreground: 'hsl(var(--foreground))',
				primary: {
					DEFAULT: '#2B5D3A',
					foreground: 'hsl(var(--primary-foreground))',
				},
				secondary: {
					DEFAULT: '#4A90E2',
					foreground: 'hsl(var(--secondary-foreground))',
				},
				accent: {
					DEFAULT: '#F5A623',
					foreground: 'hsl(var(--accent-foreground))',
				},
				success: {
					DEFAULT: '#16a34a',
				},
				warning: {
					DEFAULT: '#d97706',
				},
				info: {
					DEFAULT: '#2563eb',
				},
				danger: {
					DEFAULT: '#dc2626',
				},
				destructive: {
					DEFAULT: 'hsl(var(--destructive))',
					foreground: 'hsl(var(--destructive-foreground))',
				},
				muted: {
					DEFAULT: 'hsl(var(--muted))',
					foreground: 'hsl(var(--muted-foreground))',
				},
				popover: {
					DEFAULT: 'hsl(var(--popover))',
					foreground: 'hsl(var(--popover-foreground))',
				},
				card: {
					DEFAULT: 'hsl(var(--card))',
					foreground: 'hsl(var(--card-foreground))',
				},
			},
			borderRadius: {
				lg: 'var(--radius)',
				md: 'calc(var(--radius) - 2px)',
				sm: 'calc(var(--radius) - 4px)',
			},
			keyframes: {
				'accordion-down': {
					from: { height: 0 },
					to: { height: 'var(--radix-accordion-content-height)' },
				},
				'accordion-up': {
					from: { height: 'var(--radix-accordion-content-height)' },
					to: { height: 0 },
				},
				// Modal entry — scale from 0.95 + fade (nothing appears from nothing)
				'modal-in': {
					from: { opacity: '0', transform: 'scale(0.95) translateY(8px)' },
					to:   { opacity: '1', transform: 'scale(1)    translateY(0)'   },
				},
				// Backdrop fade in
				'backdrop-in': {
					from: { opacity: '0' },
					to:   { opacity: '1' },
				},
				// Slide panel from right
				'slide-in-right': {
					from: { transform: 'translateX(100%)' },
					to:   { transform: 'translateX(0)'    },
				},
				// Toast slide in from right edge
				'toast-in': {
					from: { opacity: '0', transform: 'translateX(calc(100% + 1rem))' },
					to:   { opacity: '1', transform: 'translateX(0)'                 },
				},
				// Fade up — for page entry and list items
				'fade-up': {
					from: { opacity: '0', transform: 'translateY(6px)' },
					to:   { opacity: '1', transform: 'translateY(0)'   },
				},
			},
			animation: {
				'accordion-down':  'accordion-down 0.2s ease-out',
				'accordion-up':    'accordion-up 0.2s ease-out',
				'modal-in':        'modal-in 240ms cubic-bezier(0.23,1,0.32,1) both',
				'backdrop-in':     'backdrop-in 200ms ease-out both',
				'slide-in-right':  'slide-in-right 300ms cubic-bezier(0.32,0.72,0,1) both',
				'toast-in':        'toast-in 280ms cubic-bezier(0.23,1,0.32,1) both',
				'fade-up':         'fade-up 220ms cubic-bezier(0.23,1,0.32,1) both',
			},
		},
	},
	plugins: [require('tailwindcss-animate')],
}

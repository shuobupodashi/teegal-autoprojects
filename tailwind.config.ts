import type { Config } from "tailwindcss";

export default {
	darkMode: ["class"],
	content: [
		"./pages/**/*.{ts,tsx}",
		"./components/**/*.{ts,tsx}",
		"./app/**/*.{ts,tsx}",
		"./src/**/*.{ts,tsx}",
	],
	prefix: "",
	theme: {
		container: {
			center: true,
			padding: '2rem',
			screens: {
				'2xl': '1400px'
			}
		},
		extend: {
			fontFamily: {
				sans: ['-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', '"PingFang SC"', '"Hiragino Sans GB"', '"Microsoft YaHei"', 'system-ui', 'sans-serif'],
			},
			colors: {
				border: 'hsl(var(--border))',
				input: 'hsl(var(--input))',
				ring: 'hsl(var(--ring))',
				background: 'hsl(var(--background))',
				foreground: 'hsl(var(--foreground))',
				primary: {
					DEFAULT: 'hsl(var(--primary))',
					foreground: 'hsl(var(--primary-foreground))'
				},
				secondary: {
					DEFAULT: 'hsl(var(--secondary))',
					foreground: 'hsl(var(--secondary-foreground))'
				},
				destructive: {
					DEFAULT: 'hsl(var(--destructive))',
					foreground: 'hsl(var(--destructive-foreground))'
				},
				muted: {
					DEFAULT: 'hsl(var(--muted))',
					foreground: 'hsl(var(--muted-foreground))'
				},
				accent: {
					DEFAULT: 'hsl(var(--accent))',
					foreground: 'hsl(var(--accent-foreground))'
				},
				popover: {
					DEFAULT: 'hsl(var(--popover))',
					foreground: 'hsl(var(--popover-foreground))'
				},
				card: {
					DEFAULT: 'hsl(var(--card))',
					foreground: 'hsl(var(--card-foreground))'
				},
				sidebar: {
					DEFAULT: 'hsl(var(--sidebar-background))',
					foreground: 'hsl(var(--sidebar-foreground))',
					primary: 'hsl(var(--sidebar-primary))',
					'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
					accent: 'hsl(var(--sidebar-accent))',
					'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
					border: 'hsl(var(--sidebar-border))',
					ring: 'hsl(var(--sidebar-ring))'
				},
				combees: {
					purple: {
						DEFAULT: '#9b87f5',
						dark: '#7E69AB',
						darkest: '#6E59A5',
						light: '#E5DEFF',
					},
					gray: {
						DEFAULT: '#8E9196',
						light: '#F1F0FB',
					}
				},
				tech: {
					purple: {
						50: '#f3f1ff',
						100: '#e9e5ff',
						200: '#d4ccff',
						300: '#b8a8ff',
						400: '#9b87f5',
						500: '#7c3aed',
						600: '#6d28d9',
						700: '#5b21b6',
						800: '#4c1d95',
						900: '#3c1677',
						950: '#1e0a4b'
					},
					neon: {
						50: '#f0fdf9',
						100: '#e6fffa',
						200: '#a7f3d0',
						300: '#6ee7b7',
						400: '#34d399',
						500: '#10b981',
						600: '#059669',
						700: '#047857',
						800: '#065f46',
						900: '#064e3b',
						950: '#022c22'
					},
					dark: {
						50: '#f8fafc',
						100: '#f1f5f9',
						200: '#e2e8f0',
						300: '#cbd5e1',
						400: '#94a3b8',
						500: '#64748b',
						600: '#475569',
						700: '#334155',
						800: '#1e293b',
						900: '#0f172a',
						950: '#020617'
					},
					cyber: {
						50: '#eff6ff',
						100: '#dbeafe',
						200: '#bfdbfe',
						300: '#93c5fd',
						400: '#60a5fa',
						500: '#3b82f6',
						600: '#2563eb',
						700: '#1d4ed8',
						800: '#1e40af',
						900: '#1e3a8a',
						950: '#172554'
					}
				}
			},
			backgroundImage: {
				'tech-gradient': 'linear-gradient(135deg, #7c3aed 0%, #10b981 100%)',
				'tech-gradient-reverse': 'linear-gradient(135deg, #10b981 0%, #7c3aed 100%)',
				'tech-dark-gradient': 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
				'cyber-glow': 'radial-gradient(circle at center, rgba(124, 58, 237, 0.3) 0%, transparent 70%)',
				'neon-glow': 'radial-gradient(circle at center, rgba(16, 185, 129, 0.2) 0%, transparent 70%)'
			},
			boxShadow: {
				'tech-glow': '0 0 20px rgba(124, 58, 237, 0.3)',
				'neon-glow': '0 0 20px rgba(16, 185, 129, 0.3)',
				'cyber-deep': '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 30px rgba(124, 58, 237, 0.15)',
				'tech-card': '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(124, 58, 237, 0.06)',
			},
			borderRadius: {
				lg: 'var(--radius)',
				md: 'calc(var(--radius) - 2px)',
				sm: 'calc(var(--radius) - 4px)'
			},
			keyframes: {
				'accordion-down': {
					from: {
						height: '0'
					},
					to: {
						height: 'var(--radix-accordion-content-height)'
					}
				},
				'accordion-up': {
					from: {
						height: 'var(--radix-accordion-content-height)'
					},
					to: {
						height: '0'
					}
				},
				'tech-pulse': {
					'0%, 100%': {
						opacity: '1'
					},
					'50%': {
						opacity: '0.7'
					}
				},
				'neon-flicker': {
					'0%, 100%': {
						textShadow: '0 0 5px rgba(16, 185, 129, 0.8), 0 0 10px rgba(16, 185, 129, 0.6)'
					},
					'50%': {
						textShadow: '0 0 2px rgba(16, 185, 129, 0.5), 0 0 5px rgba(16, 185, 129, 0.3)'
					}
				},
				'cyber-scan': {
					'0%': {
						transform: 'translateX(-100%)'
					},
					'100%': {
						transform: 'translateX(100%)'
					}
				},
				'sweep': {
					'0%': {
						transform: 'translateX(-100%)'
					},
					'100%': {
						transform: 'translateX(100%)'
					}
				}
			},
			animation: {
				'accordion-down': 'accordion-down 0.2s ease-out',
				'accordion-up': 'accordion-up 0.2s ease-out',
				'tech-pulse': 'tech-pulse 2s ease-in-out infinite',
				'neon-flicker': 'neon-flicker 1.5s ease-in-out infinite',
				'cyber-scan': 'cyber-scan 2s linear infinite',
				'sweep': 'sweep 2s linear infinite'
			}
		}
	},
	plugins: [require("tailwindcss-animate"), require("@tailwindcss/typography")],
} satisfies Config;

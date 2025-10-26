/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Academic theme colors
        primary: {
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
        },
        secondary: {
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
        academic: {
          blue: '#1e40af',
          green: '#059669',
          yellow: '#d97706',
          red: '#dc2626',
          purple: '#7c3aed',
          indigo: '#4338ca'
        },
        collaboration: {
          user1: '#ef4444',
          user2: '#3b82f6',
          user3: '#10b981',
          user4: '#f59e0b',
          user5: '#8b5cf6',
          user6: '#06b6d4'
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
        academic: ['Crimson Text', 'Georgia', 'serif']
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
        '128': '32rem'
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-down': 'slideDown 0.3s ease-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'typing': 'typing 1s ease-in-out infinite alternate',
        'collaboration-cursor': 'collaborationCursor 1s ease-in-out infinite'
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' }
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' }
        },
        slideDown: {
          '0%': { transform: 'translateY(-10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' }
        },
        typing: {
          '0%': { opacity: '0.4' },
          '100%': { opacity: '1' }
        },
        collaborationCursor: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.3' }
        }
      },
      boxShadow: {
        'notebook': '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        'collaboration': '0 0 0 2px rgba(59, 130, 246, 0.5)',
        'academic': '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)'
      },
      backdropBlur: {
        xs: '2px'
      },
      gridTemplateColumns: {
        'notebook': '250px 1fr',
        'editor': '1fr 300px',
        'dashboard': 'repeat(auto-fit, minmax(300px, 1fr))'
      },
      maxWidth: {
        'notebook': '1400px'
      },
      zIndex: {
        'modal': '50',
        'dropdown': '40',
        'sidebar': '30',
        'header': '20'
      }
    }
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/typography'),
    require('@tailwindcss/aspect-ratio'),
    
    // Custom plugin for academic styles
    function({ addUtilities, theme }) {
      const newUtilities = {
        '.text-balance': {
          'text-wrap': 'balance'
        },
        '.academic-paper': {
          'font-family': theme('fontFamily.academic'),
          'line-height': '1.8',
          'font-size': '16px'
        },
        '.collaboration-indicator': {
          'position': 'relative',
          '&::after': {
            'content': '""',
            'position': 'absolute',
            'top': '-2px',
            'right': '-2px',
            'width': '8px',
            'height': '8px',
            'background-color': theme('colors.green.500'),
            'border-radius': '50%',
            'animation': theme('animation.pulse-slow')
          }
        },
        '.notebook-grid': {
          'display': 'grid',
          'grid-template-columns': 'repeat(auto-fill, minmax(300px, 1fr))',
          'gap': theme('spacing.6')
        },
        '.glass-morphism': {
          'background': 'rgba(255, 255, 255, 0.25)',
          'backdrop-filter': 'blur(10px)',
          'border': '1px solid rgba(255, 255, 255, 0.18)'
        }
      };
      
      addUtilities(newUtilities);
    }
  ],
  
  // Dark mode configuration
  darkMode: 'class'
};

/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
        "./components/**/*.{js,ts,jsx,tsx}",
        "./App.tsx",
        "./main.tsx"
    ],
    theme: {
        extend: {
            fontFamily: {
                sans: ['Inter', 'sans-serif'],
            },
            colors: {
                indigo: {
                    50: '#f4f6f8',
                    100: '#e2e8f0',
                    200: '#cbd5e1',
                    300: '#94a3b8',
                    400: '#64748b',
                    500: '#475569',
                    600: '#1A202C', // Primary Brand Color
                    700: '#161b25',
                    800: '#11151c',
                    900: '#0d0f14',
                }
            }
        },
    },
    plugins: [],
}

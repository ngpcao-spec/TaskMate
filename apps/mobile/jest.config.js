module.exports = {
  preset: 'jest-expo',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^lucide-react-native$': require('path').resolve(__dirname, '../../node_modules/lucide-react-native/dist/cjs/lucide-react-native.js'),
  },
  transformIgnorePatterns: [
    '/node_modules/(?!(.pnpm|react-native|@react-native|@react-native-community|expo|@expo|@expo-google-fonts|react-navigation|@react-navigation|@sentry/react-native|native-base|standard-navigation|lucide-react-native|react-native-svg|react-native-qrcode-svg))',
    '/node_modules/react-native-reanimated/plugin/',
    '/node_modules/@react-native/babel-preset/',
  ],
  collectCoverageFrom: ['src/domain/**/*.ts', '!**/*.test.ts'],
  coverageThreshold: { 'src/domain/': { statements: 90, branches: 90, functions: 90, lines: 90 } },
};

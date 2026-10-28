module.exports = {
  displayName: 'api',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  // Os testes de integração precisam de DATABASE_URL e JWT_ACCESS_SECRET; sem
  // isto cada spec teria de carregar o .env por conta própria.
  setupFiles: ['<rootDir>/jest.setup.ts'],
  // @nestjs/config e @nestjs/jwt sao ESM puro ("type": "module", sem export
  // require). O Jest roda em CJS, entao estes dois precisam passar pelo
  // ts-jest em vez de serem ignorados como o resto de node_modules.
  transformIgnorePatterns: ['/node_modules/(?!@nestjs/(config|jwt)/)'],
  coverageDirectory: '../../coverage/apps/api',
};

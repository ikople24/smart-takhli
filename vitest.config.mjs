import path from 'node:path';
import { defineConfig } from 'vitest/config';

// เทสต์ของโปรเจกต์นี้ครอบเฉพาะ logic ล้วนใน lib/ (ไม่มี React/DOM/Mongo)
// — environment 'node' จึงพอ และไม่ต้องติดตั้ง jsdom
export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(process.cwd()) },
  },
  test: {
    environment: 'node',
    include: ['lib/**/__tests__/**/*.test.js', 'lib/**/*.test.ts'],
  },
});

import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import { terser } from 'rollup-plugin-terser';

export default {
  input: 'src/main.mjs',
  output: {
    dir: 'dist',
    format: 'es',
    sourcemap: true,
  },
  plugins: [
    nodeResolve({
      preferBuiltins: true,
      exportConditions: ['node'], // 适配 Node.js 环境
    }),
    commonjs(),
    json(),
    terser(), // 生产环境代码压缩
  ],
  external: [
    'undici',
    'child_process',
    'fs/promises',
  ],
};
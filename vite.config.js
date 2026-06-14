import { defineConfig } from 'vite';

export default defineConfig({
  base: '/race/', // GitHub Pagesのリポジトリ名に合わせる
  server: {
    host: true, // 外部（スマホなど）からアクセスできるようにする
    port: 3000
  }
});

import { defineConfig } from 'vite';

export default defineConfig({
  base: './', // VercelやGitHub Pagesなど様々な環境にデプロイできるように相対パスにする
  server: {
    host: true, // 外部（スマホなど）からアクセスできるようにする
    port: 3000
  }
});

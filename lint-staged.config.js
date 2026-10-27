export default {
  '*.{js,mjs,cjs,jsx,ts,mts,cts,tsx,vue}': [
    'eslint --fix --max-warnings 0 --no-warn-ignored',
    'prettier --write',
  ],
  '*.{json,jsonc,css,scss,less,html,md,mdx,yaml,yml}': 'prettier --write',
};

import js from '@eslint/js'
import pluginVue from 'eslint-plugin-vue'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...pluginVue.configs['flat/recommended'],
  {
    files: ['**/*.{ts,vue}'],
    languageOptions: {
      parserOptions: {
        parser: tseslint.parser,
        extraFileExtensions: ['.vue'],
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
    rules: {
      'vue/multi-word-component-names': 'off',
    },
  },
  {
    files: [
      'src/components/MarkdownContent.vue',
      'src/components/MarkdownRenderer.vue',
    ],
    rules: {
      // v-html is intentional; HTML is sanitized in markdownToSafeHtml (DOMPurify).
      'vue/no-v-html': 'off',
    },
  }
)

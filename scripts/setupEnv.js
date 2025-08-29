// Setup environment for Node.js to run ESM modules with import.meta

globalThis.import = {
  meta: {
    env: {
      BASE_URL: '/',
      DEV: false,
      PROD: true
    },
    url: 'file:///mnt/c/Users/giraf/Documents/projects/fftool/scripts/testDraftSimFinal.ts'
  }
};
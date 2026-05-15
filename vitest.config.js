module.exports = {
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 10000,
    hookTimeout: 10000,
    fileParallelism: false,
    pool: 'forks',
    maxForks: 1,
    minForks: 1,
    reporters: ['verbose'],
  },
};

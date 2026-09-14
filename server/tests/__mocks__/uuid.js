let counter = 0;

module.exports = {
  v4: () => {
    counter += 1;
    const suffix = counter.toString().padStart(12, '0');
    return `00000000-0000-4000-8000-${suffix}`;
  },
};

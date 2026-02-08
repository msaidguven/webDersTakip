type LogArgs = unknown[];

const isDev = process.env.NODE_ENV !== 'production';

export const logger = {
  log: (...args: LogArgs) => {
    if (isDev) console.log(...args);
  },
  warn: (...args: LogArgs) => {
    if (isDev) console.warn(...args);
  },
  error: (...args: LogArgs) => {
    if (isDev) console.error(...args);
  },
};

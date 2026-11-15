export interface SerialQueue {
  run: <Result>(task: () => Promise<Result>) => Promise<Result>;
}

export const createSerialQueue = (): SerialQueue => {
  let tail: Promise<unknown> = Promise.resolve();
  return {
    run: (task) => {
      const result = tail.catch(() => undefined).then(task);
      tail = result;
      return result;
    },
  };
};

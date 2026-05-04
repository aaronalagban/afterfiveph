import pLimit from "p-limit";

export const createConcurrencyLimit = (limit: number) => {
  return pLimit(limit);
};

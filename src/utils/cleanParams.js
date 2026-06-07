export const cleanParams = (params) => {
  const cleaned = {};

  Object.keys(params).forEach((key) => {
    const value = params[key];

    if (
      value !== undefined &&
      value !== null &&
      value !== ""
    ) {
      cleaned[key] = value;
    }
  });

  return cleaned;
};

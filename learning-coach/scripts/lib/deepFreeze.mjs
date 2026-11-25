const checkIsPlainContainer = (value) => {
    if (Array.isArray(value)) return true;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
};

export const deepFreeze = (value) => {
    if (value === null || typeof value !== 'object' || !checkIsPlainContainer(value)) {
        return value;
    }
    Object.values(value).forEach(deepFreeze);
    return Object.freeze(value);
};

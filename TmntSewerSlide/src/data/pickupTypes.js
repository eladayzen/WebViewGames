// Pizza pickup data (§5.6, §6). Not present in POC.

export const PICKUP_TYPES = {
  pizza: {
    key: 'pizza',
    width: 0.85,
    height: 0.71, // matches pizza.webp's ~512x428 aspect
    toleranceRad: 0.11, // smaller than obstacle tolerance is fine per §5.6
    color: 0xffb23c,
    textureUrl: new URL('../assets/pizza.webp', import.meta.url).href,
  },
};

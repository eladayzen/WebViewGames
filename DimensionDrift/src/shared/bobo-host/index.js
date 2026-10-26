/**
 * bobo-host — public entry point. A game imports THIS, never `host.js`.
 *
 * This is the composition root: it is the one place the protocol shim
 * (`host.js`, zero dependencies) is joined to the tilt pipeline (`tilt.js`,
 * BRIDGE.md §5). Keeping the join here is what lets the protocol be tested
 * without the pipeline and the pipeline be swapped for an A/B without editing
 * either file.
 */

import { BoboHost, usePipeline } from './host.js';
import { TiltPipeline } from './tilt.js';

usePipeline((cfg) => new TiltPipeline(cfg));

export { BoboHost, TiltPipeline };
export { HANDLER, GAME_API, REQUIRES_HOST_API, DEV_TAKEOVER_MS } from './host.js';

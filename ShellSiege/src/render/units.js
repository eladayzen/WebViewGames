// THE SIM IS STILL IN PIXELS. The renderer is the only thing that knows metres.
//
// TMNT Survivor's numbers were tuned against a real board over a week -- the
// 520 px/s walk, the 620 px range, the 200 px/s horde, the 0.7 global pace and
// every ratio argued out in core/pace.js. Re-expressing them in metres would
// throw all of that away and leave a set of constants whose relationships
// nobody chose. So the simulation keeps working in exactly the units it was
// tuned in, and the scene divides by one number on the way to the screen.
//
// 100 was picked so the design frame (1920x1080, the size every game in this
// repo draws against) is 19.2 x 10.8 units, which puts a 1.55-unit Raphael at
// about a seventh of the screen height -- the same proportion the reference
// footage reads at.
export const PX = 100;

/** Sim pixels -> scene units. */
export const u = (px) => px / PX;

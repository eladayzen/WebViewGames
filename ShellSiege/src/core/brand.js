// THE GAME'S NAME, in ONE place (Elad, 24 Nov: the working title is going to change).
//
// It is deliberately not shown on the lobby any more. Where it still appears:
//   - document.title, set from here by main.js (index.html carries a neutral placeholder)
//   - the save key in systems/save.js ('shellsiege.progress') is NOT the name's business: renaming a
//     storage key orphans every saved game, so it stays as it is whatever the game is called
//   - the shipped Unity folder is TurtlesActionGame, which is the permanent save key on the device
//   - the comment at the top of main.js, and the repo folder name (ShellSiege/)
export const GAME_TITLE = 'Shell Siege';

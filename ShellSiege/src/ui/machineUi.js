// DONNIE'S POPUP: a small Donnie speech bubble in the bottom-left for a few seconds.

export function createMachineUi(camera) {
  const pop = document.getElementById('donnie-pop');
  let lastId = -1;
  if (pop) pop.innerHTML = `<div class="face"><img src="tex/donnie_head.png" alt=""></div><div class="say"><b></b><span></span></div>`;

  function sync(w) {
    const m = w.mach;
    if (pop) {
      const p = m && m.popup;
      if (p && p.id !== lastId) {
        lastId = p.id;
        pop.querySelector('b').textContent = p.title; pop.querySelector('span').textContent = p.text;
        pop.classList.remove('hidden'); pop.classList.remove('show'); void pop.offsetWidth; pop.classList.add('show');
      }
      if (!p) pop.classList.add('hidden');
    }
  }
  return { sync };
}

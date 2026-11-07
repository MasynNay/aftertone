// Portfolio introduction; intentionally separate from the actual AFTERTONE app.
const welcome = document.getElementById('portfolio-welcome');
const dismiss = document.getElementById('explore-project');
const direct = document.getElementById('launch-from-welcome');
const KEY = 'aftertone:portfolio-intro:v1';
function seen() { try { return sessionStorage.getItem(KEY) === 'yes'; } catch { return false; } }
function remember() { try { sessionStorage.setItem(KEY, 'yes'); } catch { /* private browsing */ } }
if (welcome instanceof HTMLDialogElement) {
  dismiss.addEventListener('click', () => { remember(); welcome.close(); });
  direct.addEventListener('click', remember);
  welcome.addEventListener('cancel', remember);
  if (!seen()) welcome.showModal();
}

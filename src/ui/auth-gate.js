import { me } from '../lib/store.js';
import { navigate, here } from '../lib/router.js';
import { toast } from '../lib/util.js';
import { closeAll } from './modal.js';

// call before any write; sends visitors to the login page and brings them back afterwards
export function requireAuth() {
  if (me.user) return true;
  closeAll();
  toast('سجّل دخولك أول');
  navigate('/login?next=' + encodeURIComponent(here().path + here().search));
  return false;
}

// Separate entry (loaded from index.html) so the update toast sits outside App.svelte.
import { mount } from 'svelte';
import UpdateToast from './UpdateToast.svelte';

const target = document.createElement('div');
target.id = 'pwa-toast';
document.body.appendChild(target);
mount(UpdateToast, { target });

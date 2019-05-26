/* eslint-disable no-new */
import App from './App.svelte';
import './styles/global.scss';

new App({
  target: document.getElementById('app'),
  hydrate: true,
});

import { render } from 'preact';
import { App } from './app';
import './index.css';
import './api-client/config';

render(<App />, document.getElementById('app')!); 
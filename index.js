// /**
//  * @format
//  */

// import { AppRegistry } from 'react-native';
// import App from './App';
// import { name as appName } from './app.json';

// AppRegistry.registerComponent(appName, () => App);

// Silence React Native Firebase v22+ modular deprecation warnings globally
globalThis.RNFB_SILENCE_MODULAR_DEPRECATION_WARNINGS = true;

import 'react-native-url-polyfill/auto';
import {AppRegistry} from 'react-native';
import App from './App';
import {name as appName} from './app.json';

AppRegistry.registerComponent(appName, () => App);

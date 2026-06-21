import 'react-native-gesture-handler';
import { registerRootComponent } from 'expo';

import App from './App';

// Silence noisy debug logging in production builds (runs before the app mounts).
// console.warn / console.error are kept so real problems still reach device logs
// and crash reporting.
if (!__DEV__) {
  console.log = () => {};
  console.info = () => {};
  console.debug = () => {};
}

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);

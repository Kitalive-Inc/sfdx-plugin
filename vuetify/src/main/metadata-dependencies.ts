// Plugins
import { registerPlugins } from '@/plugins';

// Components
import App from '@/app/MetadataDependencies.vue';

// Composables
import { createApp } from 'vue';

const app = createApp(App);

registerPlugins(app);

app.mount('#app');

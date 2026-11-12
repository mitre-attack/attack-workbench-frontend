import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';
import { loadRuntimeConfiguration } from './configuration/runtime-configuration';

async function bootstrap() {
  await loadRuntimeConfiguration();
  const { AppModule } = await import('./app/app.module');
  await platformBrowserDynamic().bootstrapModule(AppModule);
}

bootstrap().catch(error => {
  console.error(error);
  const message = document.createElement('p');
  message.textContent = `Workbench could not start: ${error.message}`;
  document.body.replaceChildren(message);
});

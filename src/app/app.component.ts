import { Component, OnInit } from '@angular/core';
import { IonApp, IonRouterOutlet } from '@ionic/angular/standalone';
import { SettingsService } from '@app/core/services/settings.service';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  imports: [IonApp, IonRouterOutlet],
})
export class AppComponent implements OnInit {
  constructor(private settingsService: SettingsService) {}

  ngOnInit() {
    // Suscribirse a los cambios de tema para aplicarlos globalmente
    this.settingsService.theme$.subscribe(theme => {
      (this.settingsService as any).applyTheme(theme);
    });
     // 🔹 Aplicar idioma global (si usas i18n)
    // this.settingsService.language$.subscribe(lang => {
    //   this.translate.use(lang);
    // });

    // 🔹 Reaccionar a cambios de moneda globalmente si lo deseas
    // this.settingsService.currency$.subscribe(currency => {
    //   console.log('Moneda actual:', currency);
    // });
  }
}
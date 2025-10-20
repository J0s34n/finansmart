import { Component, OnInit } from '@angular/core';
import { IonApp, IonRouterOutlet } from '@ionic/angular/standalone';
import { SettingsService } from '@app/core/services/settings.service';
import { addIcons } from 'ionicons';
import { 
  wallet, 
  ellipsisHorizontalOutline, 
  addCircleOutline, 
  cashOutline 
} from 'ionicons/icons';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  imports: [IonApp, IonRouterOutlet],
})
export class AppComponent implements OnInit {
  constructor(private settingsService: SettingsService) {
    this.registerIcons();
  }

  private registerIcons(){
      addIcons({
      'wallet': wallet,
      'ellipsis-horizontal-outline': ellipsisHorizontalOutline,
      'add-circle-outline': addCircleOutline,
      'cash-outline': cashOutline,
    });
  }

  ngOnInit() {
    // Suscribirse a los cambios de tema para aplicarlos globalmente
    this.settingsService.theme$.subscribe(theme => {
      this.settingsService.applyTheme(theme);
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

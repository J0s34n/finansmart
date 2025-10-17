import { bootstrapApplication } from '@angular/platform-browser';
import { RouteReuseStrategy, provideRouter, withPreloading, PreloadAllModules } from '@angular/router';
import { IonicRouteStrategy, provideIonicAngular } from '@ionic/angular/standalone';
import { provideHttpClient } from '@angular/common/http';

// Firebase
import { provideFirebaseApp, initializeApp } from '@angular/fire/app';
import { provideAuth, getAuth } from '@angular/fire/auth';
import { provideFirestore, getFirestore } from '@angular/fire/firestore';
import { provideStorage, getStorage } from '@angular/fire/storage';

import { routes } from './app/app.routes';
import { AppComponent } from './app/app.component';
import { environment } from './environments/environment';

bootstrapApplication(AppComponent, {
  providers: [
    // ========================================
    // ROUTE REUSE STRATEGY (Ionic)
    // ========================================
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },

    // ========================================
    // IONIC ANGULAR
    // ========================================
    provideIonicAngular(),

    // ========================================
    // ROUTER CON PRELOADING
    // ========================================
    provideRouter(routes, withPreloading(PreloadAllModules)),

    // ========================================
    // HTTP CLIENT
    // ========================================
    provideHttpClient(),

    // ========================================
    // FIREBASE PROVIDERS
    // ========================================
    provideFirebaseApp(() => initializeApp(environment.firebaseConfig)),
    provideAuth(() => getAuth()),
    provideFirestore(() => getFirestore()),
    provideStorage(() => getStorage()),
  ],
}).catch((err) => console.error(err));
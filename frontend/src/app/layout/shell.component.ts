import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SidebarComponent } from '../shared/components/sidebar/sidebar.component';
import { NavbarComponent } from '../shared/components/navbar/navbar.component';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, SidebarComponent, NavbarComponent],
  template: `
    <div class="flex h-screen w-full bg-enterprise-bg overflow-hidden text-gray-800 font-sans selection:bg-enterprise-primary selection:text-white">
      <app-sidebar class="flex-shrink-0 h-full shadow-2xl z-20 relative" />
      <div class="flex flex-col flex-1 relative overflow-hidden transition-all duration-300 relative">
        <app-navbar class="z-10 relative" />
        <main class="flex-1 overflow-y-auto w-full custom-scrollbar">
          <router-outlet />
        </main>
      </div>
    </div>
  `,
})
export class ShellComponent {}

import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { Toasts } from './ui/toasts';

@Component({
  imports: [RouterModule, Toasts],
  selector: 'nb-root',
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected readonly title = 'Norbit';
}
